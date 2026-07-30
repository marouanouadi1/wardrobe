"""La chat vera dello stilista: stesso lavoro di /suggerimenti, ma con memoria.

Non è un job a sé: usa lo stesso contesto e lo stesso contratto di risposta
JSON del suggerimento (vedi `domain.stylist`). L'unica differenza è che ogni
richiesta porta con sé i turni precedenti, così «fa più freddo, cambia» si
appoggia a quello che il modello ha già proposto invece di ripartire da zero.

Il preset (system prompt, temperatura, max token) non è una costante: arriva
da chi chiama, che l'ha già letto — di fabbrica o salvato dal playground — con
`domain.playground.preset_effettivo`. Tenerlo fuori da qui evita a questo
modulo di dipendere dal repository.
"""

from __future__ import annotations

from domain.models import ContestoSuggerimento, MessaggioChat, RuoloChat
from domain.ports import MessaggioLlm, RichiestaLlm
from domain.stylist import PROMPT_SUGGERIMENTO, payload_contesto

# Oltre questo numero di turni tagliamo la coda più vecchia: la memoria della
# chat serve a non perdere il filo di stamattina, non a ricordare tutto
# l'anno, e ogni turno in più è contesto pagato a ogni messaggio successivo.
MASSIMO_TURNI_CRONOLOGIA = 20


def cronologia_da_messaggi(
    messaggi: list[MessaggioChat], *, limite: int = MASSIMO_TURNI_CRONOLOGIA
) -> list[MessaggioLlm]:
    recenti = messaggi[-limite:] if limite > 0 else messaggi
    return [
        MessaggioLlm(
            ruolo="utente" if messaggio.ruolo is RuoloChat.UTENTE else "assistente",
            testo=messaggio.testo,
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
        prompt=PROMPT_SUGGERIMENTO.format(
            numero=contesto.numero_proposte, contesto=payload_contesto(contesto)
        ),
        temperatura=temperatura,
        max_token=max_token,
        forza_json=True,
    )
