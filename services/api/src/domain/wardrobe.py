"""Le regole dell'armadio che servono all'IA: slot, disponibilità, vestizioni.

Tutto puro. `oggi` e `adesso` arrivano sempre come argomento, mai da
`datetime.now()`.

Le altre regole sui dati — correggere un attributo, segnare un capo come
indossato, un outfit indossabile — stanno nel database, dove valgono per ogni
client (supabase/migrations/, ADR 0010). Quelle di presentazione — filtri,
riepilogo, capi che dormono, colori di un outfit — stanno nell'app. Qui resta
solo quello che lo stilista e la visione usano davvero; `slot_da_tipo` e
`vestizione_indossabile` esistono anche nel database, e `verifica_database.py`
li confronta.
"""

from __future__ import annotations

from datetime import date

from domain.models import (
    Capo,
    CapoSintetico,
    SlotAvatar,
    StatoCapo,
    TipoCapo,
    Vestizione,
)

_SLOT_PER_TIPO: dict[TipoCapo, SlotAvatar] = {
    TipoCapo.TOP: SlotAvatar.TOP,
    TipoCapo.PANTALONI: SlotAvatar.BOTTOM,
    TipoCapo.SCARPE: SlotAvatar.SHOES,
    TipoCapo.CAPOSPALLA: SlotAvatar.OUTER,
    TipoCapo.ABITO: SlotAvatar.DRESS,
    # Gli accessori non hanno posto sul manichino: restano in armadio e l'avatar
    # li ignora, invece di far crescere il modello 3D di una sesta mesh.
    TipoCapo.ACCESSORIO: SlotAvatar.TOP,
}


def slot_da_tipo(tipo: TipoCapo) -> SlotAvatar:
    return _SLOT_PER_TIPO[tipo]


def capi_disponibili(capi: list[Capo]) -> list[Capo]:
    """Solo il pulito: suggerire una camicia che è in lavatrice è un bug."""
    return [capo for capo in capi if capo.stato == StatoCapo.PULITO]


def indossati_da(capi: list[Capo], oggi: date, giorni: int = 3) -> list[Capo]:
    limite = date.fromordinal(oggi.toordinal() - giorni)
    return [capo for capo in capi if capo.ultimo_uso is not None and capo.ultimo_uso >= limite]


def sintetizza(capo: Capo) -> CapoSintetico:
    """La versione da mandare al modello: stesse informazioni, meno token."""
    return CapoSintetico(
        id=capo.id,
        nome=capo.nome,
        tipo=capo.tipo,
        slot=capo.slot,
        colore=capo.colore.nome,
        hex=capo.colore.hex,
        materiale=capo.materiale,
        stagione=capo.stagione,
        stato=capo.stato,
        # Le etichette sono l'unico modo in cui l'utente può dire allo
        # stilista qualcosa che il modello di visione non può leggere da una
        # foto — «da lavoro», «da cerimonia» — quindi entrano nel contesto.
        # Gli appunti no: sono per l'utente, non aggiungono segnale per un
        # outfit e costerebbero token per ogni capo in armadio.
        etichette=capo.etichette,
    )


def vestizione_da_capi(
    capo_ids: list[str], per_id: dict[str, Capo]
) -> tuple[Vestizione, list[str]]:
    """Assegna ogni capo al suo slot.

    Restituisce anche gli scartati: se due capi si contendono lo stesso slot, il
    secondo non entra. L'avatar ha cinque posti, non sei, e uno slot sovrascritto
    in silenzio è un outfit che l'utente non ha mai chiesto.
    """
    posti: dict[str, str] = {}
    scartati: list[str] = []

    for capo_id in capo_ids:
        capo = per_id.get(capo_id)
        if capo is None:
            scartati.append(capo_id)
            continue
        chiave = capo.slot.value
        if chiave in posti:
            scartati.append(capo_id)
            continue
        posti[chiave] = capo_id

    return Vestizione.model_validate(posti), scartati


def vestizione_indossabile(vestizione: Vestizione) -> bool:
    """Un abito da solo basta; altrimenti servono sopra e sotto."""
    if vestizione.dress is not None:
        return True
    return vestizione.top is not None and vestizione.bottom is not None


def per_id(capi: list[Capo]) -> dict[str, Capo]:
    return {capo.id: capo for capo in capi}


def ids_vestizione(vestizione: Vestizione) -> list[str]:
    """Gli id dei capi occupati, negli slot dell'avatar in ordine fisso."""
    return [
        capo_id for slot in SlotAvatar if (capo_id := getattr(vestizione, slot.value)) is not None
    ]
