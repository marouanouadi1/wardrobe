"""Le regole dell'armadio: filtri, incertezze, capi che dormono, vestizioni.

Tutto puro. `oggi` e `adesso` arrivano sempre come argomento, mai da
`datetime.now()`: «fermo da sei mesi» deve essere verificabile in un test che
dura un millisecondo.
"""

from __future__ import annotations

from datetime import date, datetime

from domain.models import (
    SOGLIA_INCERTEZZA,
    AttributoCapo,
    Capo,
    CapoSintetico,
    FiltroArmadio,
    RiepilogoArmadio,
    SlotAvatar,
    StatoCapo,
    TipoCapo,
    Vestizione,
    VestizioneColori,
)

# Un capo fermo da più di sei mesi è denaro immobile: è l'osservazione su cui si
# regge la schermata del calendario.
MESI_PER_DORMIENTE = 6

ATTRIBUTI_DI_CAMPO: dict[AttributoCapo, str] = {
    AttributoCapo.TIPO: "tipo",
    AttributoCapo.COLORE: "colore",
    AttributoCapo.MATERIALE: "materiale",
    AttributoCapo.FANTASIA: "fantasia",
    AttributoCapo.STAGIONE: "stagione",
    AttributoCapo.VESTIBILITA: "vestibilita",
    AttributoCapo.LAVAGGIO: "lavaggio",
}

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


def mesi_fa(riferimento: date, mesi: int) -> date:
    """Sottrae mesi restando su un giorno esistente (28 febbraio incluso)."""
    totale = (riferimento.year * 12 + riferimento.month - 1) - mesi
    anno, mese = divmod(totale, 12)
    mese += 1
    giorni_nel_mese = [31, 29 if _bisestile(anno) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(anno, mese, min(riferimento.day, giorni_nel_mese[mese - 1]))


def _bisestile(anno: int) -> bool:
    return anno % 4 == 0 and (anno % 100 != 0 or anno % 400 == 0)


def filtra(capi: list[Capo], filtro: FiltroArmadio) -> list[Capo]:
    """Gli stessi filtri della schermata Armadio, in un posto solo.

    La ricerca testuale guarda nome, colore, materiale, brand e tipo: chi cerca
    «lino» vuole la camicia anche se «lino» non è nel nome.
    """
    testo = (filtro.testo or "").strip().lower()

    def passa(capo: Capo) -> bool:
        if filtro.tipo is not None and capo.tipo != filtro.tipo:
            return False
        if filtro.stato is not None and capo.stato != filtro.stato:
            return False
        if filtro.solo_preferiti and not capo.preferito:
            return False
        if not testo:
            return True
        cercabile = " ".join(
            pezzo
            for pezzo in (
                capo.nome,
                capo.colore.nome,
                capo.materiale,
                capo.brand,
                capo.tipo.value,
                capo.sottotipo,
            )
            if pezzo
        ).lower()
        return testo in cercabile

    return [capo for capo in capi if passa(capo)]


def attributi_incerti(capo: Capo, soglia: int = SOGLIA_INCERTEZZA) -> list[AttributoCapo]:
    """Gli attributi che l'app deve mostrare in corallo, da confermare.

    Un attributo corretto a mano non è più incerto, per definizione.
    """
    if capo.analisi is None:
        return []
    return sorted(
        (
            attributo
            for attributo, confidenza in capo.analisi.confidenze.items()
            if confidenza < soglia and attributo not in capo.analisi.corretti_a_mano
        ),
        key=lambda attributo: attributo.value,
    )


def correggi_attributo(
    capo: Capo, attributo: AttributoCapo, valore: object, adesso: datetime
) -> Capo:
    """Applica la correzione dell'utente e porta quella confidenza a 100.

    La correzione è il dato più prezioso che l'utente ci dà: è da qui che nasce
    la valutazione vera dei provider, non dall'impressione a occhio.

    Due dettagli che non sono dettagli: correggere il tipo ricalcola lo slot
    dell'avatar (un capospalla non può restare appeso allo slot «top»), e il
    risultato viene rivalidato — `model_copy` non valida, e un colore scritto a
    mano sbagliato entrerebbe in silenzio.
    """
    campo = ATTRIBUTI_DI_CAMPO[attributo]
    aggiornamento: dict[str, object] = {campo: valore, "aggiornato_il": adesso}

    if attributo is AttributoCapo.TIPO and isinstance(valore, TipoCapo):
        aggiornamento["slot"] = slot_da_tipo(valore)

    if capo.analisi is not None:
        confidenze = dict(capo.analisi.confidenze)
        confidenze[attributo] = 100
        corretti = sorted({*capo.analisi.corretti_a_mano, attributo}, key=lambda a: a.value)
        aggiornamento["analisi"] = capo.analisi.model_copy(
            update={"confidenze": confidenze, "corretti_a_mano": corretti}
        )

    return Capo.model_validate(capo.model_copy(update=aggiornamento).model_dump())


def dormienti(capi: list[Capo], oggi: date, mesi: int = MESI_PER_DORMIENTE) -> list[Capo]:
    """Capi mai usati, o fermi da più di `mesi`."""
    limite = mesi_fa(oggi, mesi)
    return [capo for capo in capi if capo.ultimo_uso is None or capo.ultimo_uso < limite]


def riepilogo(capi: list[Capo], oggi: date) -> RiepilogoArmadio:
    return RiepilogoArmadio(
        totale=len(capi),
        da_lavare=sum(1 for capo in capi if capo.stato != StatoCapo.PULITO),
        dormienti=len(dormienti(capi, oggi)),
    )


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


def segna_stato(capo: Capo, stato: StatoCapo, adesso: datetime) -> Capo:
    return capo.model_copy(update={"stato": stato, "aggiornato_il": adesso})


def segna_indossato(capo: Capo, giorno: date, adesso: datetime) -> Capo:
    """Indossare un capo lo consuma: aumenta il contatore e sporca il capo."""
    return capo.model_copy(
        update={
            "ultimo_uso": giorno,
            "volte_indossato": capo.volte_indossato + 1,
            "stato": StatoCapo.DA_LAVARE,
            "aggiornato_il": adesso,
        }
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


def colori_vestizione(vestizione: Vestizione, per_id: dict[str, Capo]) -> VestizioneColori:
    """Risolve la vestizione in colori: è l'unica cosa che il manichino capisce."""
    return VestizioneColori.model_validate(
        {
            slot.value: per_id[capo_id].colore.hex
            for slot in SlotAvatar
            if (capo_id := getattr(vestizione, slot.value)) is not None and capo_id in per_id
        }
    )


def per_id(capi: list[Capo]) -> dict[str, Capo]:
    return {capo.id: capo for capo in capi}


def ids_vestizione(vestizione: Vestizione) -> list[str]:
    """Gli id dei capi occupati, negli slot dell'avatar in ordine fisso."""
    return [
        capo_id for slot in SlotAvatar if (capo_id := getattr(vestizione, slot.value)) is not None
    ]
