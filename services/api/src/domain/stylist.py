"""Lo stilista: come si costruisce il contesto e come si valida quel che torna.

Il vincolo che regge tutta la feature è uno: il modello può proporre solo capi
che esistono davvero nell'armadio. Un suggerimento con un capo inventato non è
un suggerimento debole, è un bug — e viene fermato qui.
"""

from __future__ import annotations

from datetime import date

from domain.errors import SuggerimentoNonValido
from domain.models import (
    Capo,
    ContestoSuggerimento,
    ImpegnoAgenda,
    Meteo,
    PreferenzeStile,
    Suggerimento,
)
from domain.ports import RichiestaLlm
from domain.vision import estrai_json
from domain.wardrobe import (
    capi_disponibili,
    indossati_da,
    per_id,
    sintetizza,
    vestizione_da_capi,
    vestizione_indossabile,
)

SYSTEM_PROMPT_SUGGERIMENTO = """\
Sei lo stilista personale di Tela. Parli italiano, dai del tu, sei breve.

Proponi outfit usando SOLO i capi presenti in "capi_disponibili". Ogni capo va
citato con il suo "id" esatto. Non inventare capi, non suggerire acquisti, non
nominare capi che sono in lavaggio.

Restituisci SOLO un oggetto JSON, senza testo intorno:

{
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
- Ogni proposta deve essere indossabile: o un abito, o almeno un capo sopra e
  uno sotto. Le scarpe mettile quasi sempre.
- Massimo tre motivi per proposta, una riga ciascuno. Parla di cose vere:
  temperatura, impegni della giornata, cosa ha già indossato di recente, accordi
  di colore. Mai «fa tendenza».
- "match" è quanto ci credi. Se l'armadio non ha il capo giusto per l'occasione,
  abbassalo e dillo in un motivo: onesto batte entusiasta.
- Ordina le proposte dalla più convinta alla meno.
"""

PROMPT_SUGGERIMENTO = "Ecco il contesto di oggi in JSON. Proponi {numero} outfit.\n\n{contesto}"


def costruisci_contesto(
    capi: list[Capo],
    *,
    oggi: date,
    meteo: Meteo | None = None,
    agenda: list[ImpegnoAgenda] | None = None,
    preferenze: PreferenzeStile | None = None,
    richiesta_utente: str | None = None,
    numero_proposte: int = 3,
    giorni_di_riposo: int = 3,
) -> ContestoSuggerimento:
    """Mette insieme quello che il modello può sapere.

    Nota cosa NON entra: i capi sporchi restano fuori dai disponibili, ma il
    loro nome entra in `in_lavaggio`. Serve al modello per dire «il lino lo
    lascio lì» invece di ignorarlo senza spiegazioni — è la differenza fra un
    suggerimento e un suggerimento che convince.
    """
    puliti = capi_disponibili(capi)
    sporchi = [capo for capo in capi if capo not in puliti]

    return ContestoSuggerimento(
        capi_disponibili=[sintetizza(capo) for capo in puliti],
        meteo=meteo,
        agenda=agenda or [],
        in_lavaggio=[capo.nome for capo in sporchi],
        indossati_di_recente=[capo.nome for capo in indossati_da(capi, oggi, giorni_di_riposo)],
        preferenze=preferenze or PreferenzeStile(),
        richiesta_utente=richiesta_utente,
        numero_proposte=numero_proposte,
    )


def payload_contesto(contesto: ContestoSuggerimento) -> str:
    """Il contesto come lo vede il modello, indentato per essere leggibile.

    È esattamente ciò che il playground mostra sotto «Contesto iniettato»: se un
    suggerimento esce strano, si guarda questo prima di incolpare il modello.
    """
    return contesto.model_dump_json(indent=2, exclude_none=True)


def richiesta_suggerimento(
    contesto: ContestoSuggerimento,
    modello: str,
    *,
    system_prompt: str | None = None,
    temperatura: float = 0.45,
    max_token: int = 1200,
) -> RichiestaLlm:
    return RichiestaLlm(
        modello=modello,
        system=system_prompt or SYSTEM_PROMPT_SUGGERIMENTO,
        prompt=PROMPT_SUGGERIMENTO.format(
            numero=contesto.numero_proposte, contesto=payload_contesto(contesto)
        ),
        temperatura=temperatura,
        max_token=max_token,
        forza_json=True,
    )


def interpreta_suggerimenti(testo: str, capi: list[Capo]) -> list[Suggerimento]:
    """Valida le proposte contro l'armadio vero.

    Tre livelli di severità, in ordine:
    1. capo inventato -> errore, la risposta è inutilizzabile;
    2. proposta non indossabile (manca sopra o sotto) -> proposta scartata;
    3. nessuna proposta sopravvive -> errore.

    Scartare la singola proposta zoppa e tenere le altre è deliberato: un
    modello su tre proposte ne sbaglia una, e buttare via anche le due buone
    farebbe pagare all'utente un problema nostro.
    """
    dati = estrai_json(testo)
    grezze = dati.get("proposte")
    if not isinstance(grezze, list) or not grezze:
        raise SuggerimentoNonValido("nessuna proposta nella risposta", testo)

    indice = per_id(capi)
    proposte: list[Suggerimento] = []

    for grezza in grezze:
        if not isinstance(grezza, dict):
            raise SuggerimentoNonValido("proposta non è un oggetto", testo)

        capo_ids = grezza.get("capi")
        if not isinstance(capo_ids, list) or not capo_ids:
            raise SuggerimentoNonValido("proposta senza capi", testo)

        inventati = [str(x) for x in capo_ids if str(x) not in indice]
        if inventati:
            raise SuggerimentoNonValido(
                f"capi che non esistono nell'armadio: {', '.join(inventati)}", testo
            )

        vestizione, scartati = vestizione_da_capi([str(x) for x in capo_ids], indice)
        if scartati:
            raise SuggerimentoNonValido(
                f"più capi per lo stesso slot dell'avatar: {', '.join(scartati)}", testo
            )
        if not vestizione_indossabile(vestizione):
            continue

        motivi = [str(m).strip() for m in grezza.get("perche", []) if str(m).strip()]
        proposte.append(
            Suggerimento(
                titolo=str(grezza.get("titolo") or "Proposta").strip(),
                match=max(0, min(100, int(grezza.get("match", 70)))),
                vestizione=vestizione,
                perche=motivi[:3],
            )
        )

    if not proposte:
        raise SuggerimentoNonValido("nessuna proposta indossabile", testo)

    return proposte
