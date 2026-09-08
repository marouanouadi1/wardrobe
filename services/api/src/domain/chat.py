"""La chat vera dello stilista: stesso armadio di /suggerimenti, ma con
memoria e con la voce.

Non usa lo stesso contratto di risposta di `/suggerimenti`: quella rotta deve
sempre tornare una lista di outfit, la chat deve poter anche solo
*rispondere* — «fa più freddo? non granché» non è un outfit, ed è comunque
una risposta valida. Per questo la risposta ha sempre un campo "risposta" in
prosa libera, e "proposte" solo quando proporne uno è la cosa giusta da fare.
"""

from __future__ import annotations

from domain.errors import SuggerimentoNonValido
from domain.models import Capo, ContestoSuggerimento, MessaggioChat, RispostaStilista, RuoloChat
from domain.ports import MessaggioLlm, RichiestaLlm
from domain.stylist import payload_contesto, proposte_tolleranti
from domain.vision import estrai_json
from domain.wardrobe import ids_vestizione

# Oltre questo numero di turni tagliamo la coda più vecchia: la memoria della
# chat serve a non perdere il filo di stamattina, non a ricordare tutto
# l'anno, e ogni turno in più è contesto pagato a ogni messaggio successivo.
MASSIMO_TURNI_CRONOLOGIA = 20

# Stessi valori del preset "chat-stilista" che viveva nel playground, prima
# che la selezione a UI del prompt/temperatura/max token venisse rimossa: il
# prompt si cambia ora solo con un deploy.
TEMPERATURA_CHAT = 0.5
MAX_TOKEN_CHAT = 1400

SYSTEM_PROMPT_CHAT = """\
Sei lo stilista personale di Wardrobe. Parli italiano, dai del tu, sei breve.

Rispondi SEMPRE con un oggetto JSON di questa forma, senza testo intorno:

{
  "risposta": "quello che diresti a voce: una o due frasi, in italiano",
  "proposte": [
    {
      "titolo": "massimo 4 parole, concreto, niente gergo da rivista",
      "match": 0-100,
      "capi": ["id", "id", "id"],
      "perche": ["motivo breve", "motivo breve", "motivo breve"]
    }
  ]
}

Regole:
- "risposta" c'è sempre: è la prima cosa che l'utente legge.
- Metti "proposte" SOLO quando proporre un outfit è la cosa giusta da fare
  ora. Se la domanda non lo richiede (un saluto, un ringraziamento, «fa
  ancora freddo?»), lascia "proposte" vuoto — null o lista vuota, mai un
  outfit finto per riempire il campo.
- Quando proponi, usa SOLO i capi presenti in "capi_disponibili", citati con
  il loro "id" esatto. Non inventare capi, non suggerire acquisti, non
  nominare capi che sono in lavaggio.
- Ogni proposta deve essere indossabile: o un abito, o almeno un capo sopra e
  uno sotto. Le scarpe mettile quasi sempre.
- Massimo tre motivi per proposta, una riga ciascuna. Parla di cose vere:
  temperatura, impegni della giornata, cosa ha già indossato di recente,
  accordi di colore. Mai «fa tendenza».
- "match" è quanto ci credi. Se l'armadio non ha il capo giusto per
  l'occasione, abbassalo e dillo in un motivo: onesto batte entusiasta.
"""

PROMPT_CHAT = (
    "Ecco il contesto di oggi in JSON. Il messaggio dell'utente è in "
    '"richiesta_utente". Rispondi.\n\n{contesto}'
)


def _testo_per_cronologia(messaggio: MessaggioChat) -> str:
    """Il turno come lo rivede il modello: la prosa, più gli id proposti.

    `MessaggioChat.testo` di Wardrobe è prosa libera, non più il JSON grezzo: da
    sola perderebbe gli id dei capi appena proposti, e «fa più freddo,
    cambia» si appoggerebbe al nulla. Si aggiungono qui, non nel dato salvato
    — lo storico resta leggibile a schermo, il modello resta informato.
    """
    if messaggio.ruolo is not RuoloChat.WARDROBE or not messaggio.suggerimenti:
        return messaggio.testo
    righe = [messaggio.testo]
    for suggerimento in messaggio.suggerimenti:
        ids = ", ".join(ids_vestizione(suggerimento.vestizione))
        righe.append(f"[proposta: {suggerimento.titolo}] {ids}")
    return "\n".join(righe)


def cronologia_da_messaggi(
    messaggi: list[MessaggioChat], *, limite: int = MASSIMO_TURNI_CRONOLOGIA
) -> list[MessaggioLlm]:
    recenti = messaggi[-limite:] if limite > 0 else messaggi
    return [
        MessaggioLlm(
            ruolo="utente" if messaggio.ruolo is RuoloChat.UTENTE else "assistente",
            testo=_testo_per_cronologia(messaggio),
        )
        for messaggio in recenti
    ]


def richiesta_chat(
    contesto: ContestoSuggerimento,
    cronologia: list[MessaggioChat],
    modello: str,
    *,
    system_prompt: str,
    temperatura: float,
    max_token: int,
) -> RichiestaLlm:
    return RichiestaLlm(
        modello=modello,
        system=system_prompt,
        cronologia=cronologia_da_messaggi(cronologia),
        prompt=PROMPT_CHAT.format(contesto=payload_contesto(contesto)),
        temperatura=temperatura,
        max_token=max_token,
        forza_json=True,
    )


def interpreta_risposta_chat(testo: str, capi: list[Capo]) -> RispostaStilista:
    """Valida la risposta della chat: "risposta" è obbligatoria, "proposte" no.

    A differenza di `stylist.interpreta_suggerimenti`, qui una proposta rotta
    o assente non fa fallire il turno — il testo libero resta comunque una
    risposta da mostrare. Solo un JSON irrecuperabile, o senza "risposta", è
    un errore: è l'unico caso in cui non c'è niente di utilizzabile da dare
    all'utente.
    """
    dati = estrai_json(testo)
    risposta = dati.get("risposta")
    if not isinstance(risposta, str) or not risposta.strip():
        raise SuggerimentoNonValido("risposta assente o vuota", testo)

    return RispostaStilista(
        risposta=risposta.strip(),
        proposte=proposte_tolleranti(dati, capi, testo),
    )
