"""Il banco di valutazione: confronta una lettura del modello di visione con
la verità nota di un campione, e riduce i risultati a una tabella per modello.

Non è `domain.playground`: quello giudica «il modello ha risposto con
abbastanza sicurezza?» (`valuta_lettura`), non «ha risposto giusto?». Qui la
domanda è la seconda, e per porla serve una verità nota scritta a mano — vedi
`tests/fixtures/campioni/GUIDA.md`. Tutto puro: nessuna chiamata a un
provider, nessun accesso al repository.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime

from domain.models import (
    SOGLIA_INCERTEZZA,
    SOGLIA_SCARTO,
    AttributoCapo,
    Calibrazione,
    CampioneValutazione,
    Colore,
    EsitoAttributo,
    EsitoEsecuzione,
    EsitoPlayground,
    GiudizioAttributo,
    LetturaCapo,
    RigaAggregata,
    Valutazione,
    VeritaAttributo,
)
from domain.wardrobe import ATTRIBUTI_DI_CAMPO

# Tipo e colore pesano il doppio: sono gli `ATTRIBUTI_INDISPENSABILI` di
# `domain.vision` — senza di loro `crea_capo` rifiuta il capo, quindi
# sbagliarli conta più di sbagliare un materiale o una fantasia.
_PESI: dict[AttributoCapo, float] = {
    AttributoCapo.TIPO: 2.0,
    AttributoCapo.COLORE: 2.0,
}

_PUNTEGGIO: dict[EsitoAttributo, float] = {
    EsitoAttributo.ESATTO: 1.0,
    EsitoAttributo.VICINO: 0.5,
    EsitoAttributo.SBAGLIATO: 0.0,
    EsitoAttributo.MANCANTE: 0.0,
    EsitoAttributo.INVENTATO: 0.0,
}


def campioni_da_json(grezzo: list[object]) -> list[CampioneValutazione]:
    """I campioni del banco, da `campioni.json` già deserializzato.

    La lettura del file resta fuori dal dominio: qui arriva solo la lista già
    parsata da `json.loads`, da uno script o da un test — così lo stesso
    caricamento serve sia al banco a pagamento (`scripts/valuta_modelli.py`)
    sia al test di formato, senza due copie che possono divergere.
    """
    return [CampioneValutazione.model_validate(c) for c in grezzo]


def normalizza(testo: str) -> frozenset[str]:
    """Minuscolo, senza accenti, senza punteggiatura: token comparabili.

    «Lino 100%» e «100% lino» diventano lo stesso insieme di token: non
    puniamo un modello per l'ordine delle parole o per un accento.
    """
    decomposto = unicodedata.normalize("NFKD", testo.lower())
    senza_accenti = "".join(c for c in decomposto if not unicodedata.combining(c))
    pulito = re.sub(r"[^a-z0-9\s]", " ", senza_accenti)
    return frozenset(pulito.split())


def distanza_hex(a: str, b: str) -> float:
    """Distanza euclidea in RGB fra due colori esadecimali (`#RRGGBB`)."""
    ra, ga, ba = int(a[1:3], 16), int(a[3:5], 16), int(a[5:7], 16)
    rb, gb, bb = int(b[1:3], 16), int(b[3:5], 16), int(b[5:7], 16)
    return float(((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2) ** 0.5)


def _testo_valore(valore: object) -> str | None:
    """Il valore di un campo di `LetturaCapo`, come testo confrontabile.

    Il colore diventa il suo nome, non l'hex: l'hex ha un confronto a sé
    (`distanza_hex`), e per gli altri attributi «assente» si giudica su
    questo testo, non su un oggetto Pydantic stampato a caso.
    """
    if valore is None:
        return None
    if isinstance(valore, Colore):
        return valore.nome
    if hasattr(valore, "value"):
        return str(valore.value)
    return str(valore)


def confronta_attributo(
    attributo: AttributoCapo,
    verita: VeritaAttributo | None,
    valore: object,
    confidenza: int | None,
) -> GiudizioAttributo:
    """Il giudizio su un singolo attributo di un singolo campione.

    Ordine dei casi, dal più al meno specifico: nessuna verità scritta →
    `NON_VALUTATO`; verità «assente» → `ESATTO` se il modello ha taciuto,
    `INVENTATO` se ha risposto lo stesso; il modello ha taciuto dove una
    risposta era attesa → `MANCANTE`; il colore con un hex di riferimento si
    giudica sulla distanza RGB; tutto il resto sul confronto di token.
    """
    ottenuto = _testo_valore(valore)

    if verita is None:
        return GiudizioAttributo(
            attributo=attributo,
            esito=EsitoAttributo.NON_VALUTATO,
            ottenuto=ottenuto,
            confidenza=confidenza,
        )

    if verita.assente:
        esito = EsitoAttributo.ESATTO if ottenuto is None else EsitoAttributo.INVENTATO
        return GiudizioAttributo(
            attributo=attributo, esito=esito, ottenuto=ottenuto, confidenza=confidenza
        )

    atteso_leggibile = ", ".join(verita.attesi) or None

    if ottenuto is None:
        return GiudizioAttributo(
            attributo=attributo,
            esito=EsitoAttributo.MANCANTE,
            atteso=atteso_leggibile,
            confidenza=confidenza,
        )

    if attributo is AttributoCapo.COLORE and verita.hex is not None:
        colore_hex = valore.hex if isinstance(valore, Colore) else None
        if colore_hex is None:
            esito = EsitoAttributo.SBAGLIATO
        else:
            distanza = distanza_hex(verita.hex, colore_hex)
            if distanza <= verita.tolleranza_hex:
                esito = EsitoAttributo.ESATTO
            elif distanza <= verita.tolleranza_hex * 2:
                esito = EsitoAttributo.VICINO
            else:
                esito = EsitoAttributo.SBAGLIATO
        return GiudizioAttributo(
            attributo=attributo,
            esito=esito,
            atteso=verita.hex,
            ottenuto=colore_hex,
            confidenza=confidenza,
        )

    token_ottenuto = normalizza(ottenuto)
    token_attesi = [normalizza(a) for a in verita.attesi]
    if any(atteso <= token_ottenuto or token_ottenuto <= atteso for atteso in token_attesi):
        # Sottoinsieme in una direzione o nell'altra: «lino» dentro «lino
        # 100%», o un modello più verboso della verità scritta a mano.
        esito = EsitoAttributo.ESATTO
    elif any(normalizza(vicino) & token_ottenuto for vicino in verita.vicini):
        esito = EsitoAttributo.VICINO
    else:
        esito = EsitoAttributo.SBAGLIATO

    return GiudizioAttributo(
        attributo=attributo,
        esito=esito,
        atteso=atteso_leggibile,
        ottenuto=ottenuto,
        confidenza=confidenza,
    )


def confronta(lettura: LetturaCapo, campione: CampioneValutazione) -> list[GiudizioAttributo]:
    """Un giudizio per ciascuno dei sette attributi di `AttributoCapo`."""
    return [
        confronta_attributo(
            attributo,
            campione.verita.get(attributo),
            getattr(lettura, ATTRIBUTI_DI_CAMPO[attributo]),
            lettura.confidenze.get(attributo),
        )
        for attributo in AttributoCapo
    ]


def accuratezza(giudizi: list[GiudizioAttributo]) -> float:
    """Percentuale (0..1) pesata: `ESATTO` vale 1, `VICINO` 0.5, il resto 0.

    `NON_VALUTATO` esce dal denominatore, non entra come zero: un campione
    che non permette di giudicare il materiale non deve abbassare il
    punteggio di chi il materiale non l'ha nemmeno provato a indovinare.
    """
    valutati = [g for g in giudizi if g.esito is not EsitoAttributo.NON_VALUTATO]
    if not valutati:
        return 0.0
    pesi = sum(_PESI.get(g.attributo, 1.0) for g in valutati)
    punti = sum(_PESI.get(g.attributo, 1.0) * _PUNTEGGIO[g.esito] for g in valutati)
    return round(punti / pesi, 4)


def calibrazione(
    giudizi: list[GiudizioAttributo],
    *,
    soglia_incertezza: int = SOGLIA_INCERTEZZA,
    soglia_scarto: int = SOGLIA_SCARTO,
) -> Calibrazione:
    """Se la confidenza dichiarata è coerente con l'essere giusto.

    Due conteggi, non un punteggio unico: `sicuri_e_sbagliati` è il danno
    peggiore che il prodotto possa fare (mostra come affidabile un dato che
    non lo è), `timidi_e_giusti` è lo spreco opposto (`applica_soglie` butta
    via un dato buono). Un modello con molti `sicuri_e_sbagliati` dice
    «alza `SOGLIA_INCERTEZZA` per questo modello», non «cambia modello».
    """
    valutati = [
        g
        for g in giudizi
        if g.esito is not EsitoAttributo.NON_VALUTATO and g.confidenza is not None
    ]
    sicuri_e_sbagliati = sum(
        1
        for g in valutati
        if g.confidenza is not None
        and g.confidenza >= soglia_incertezza
        and g.esito not in (EsitoAttributo.ESATTO, EsitoAttributo.VICINO)
    )
    timidi_e_giusti = sum(
        1
        for g in valutati
        if g.confidenza is not None
        and g.confidenza < soglia_scarto
        and g.esito is EsitoAttributo.ESATTO
    )

    scarto: float | None = None
    if valutati:
        media_confidenza = sum(g.confidenza for g in valutati if g.confidenza is not None) / len(
            valutati
        )
        scarto = round(media_confidenza - accuratezza(valutati) * 100, 2)

    return Calibrazione(
        sicuri_e_sbagliati=sicuri_e_sbagliati,
        timidi_e_giusti=timidi_e_giusti,
        scarto_confidenza=scarto,
    )


def valuta(
    esito: EsitoPlayground,
    campione: CampioneValutazione,
    *,
    valutazione_id: str,
    run_id: str,
    eseguita_il: datetime,
    modello: str | None = None,
) -> Valutazione:
    """Trasforma l'esito grezzo di un'esecuzione (`domain.playground.esegui`)
    in un verdetto contro la verità nota del campione.

    Un esito fallito (provider caduto, JSON irrecuperabile) diventa una riga
    `ERRORE` senza giudizi: è un dato del banco quanto un giudizio riuscito —
    un modello che fallisce spesso è un risultato, non un buco nella tabella.

    `modello`, se dato, sovrascrive `esito.modello` nella riga salvata: alcuni
    provider (Anthropic) rispondono con lo snapshot datato invece dell'alias
    richiesto (`claude-haiku-4-5-20251001` invece di `claude-haiku-4-5`), e il
    banco deve raggruppare per l'alias — è quello che si sceglie in
    `MODELLO_STILISTA`, non uno snapshot che ruota da solo.
    """
    modello_riga = modello or esito.modello
    if not esito.ok or esito.lettura is None:
        return Valutazione(
            id=valutazione_id,
            run_id=run_id,
            eseguita_il=eseguita_il,
            campione_id=campione.id,
            provider=esito.provider,
            modello=modello_riga,
            latenza_ms=esito.latenza_ms,
            costo_eur=esito.costo_eur,
            esito=EsitoEsecuzione.ERRORE,
            errore=esito.errore,
        )

    giudizi = confronta(esito.lettura, campione)
    return Valutazione(
        id=valutazione_id,
        run_id=run_id,
        eseguita_il=eseguita_il,
        campione_id=campione.id,
        provider=esito.provider,
        modello=modello_riga,
        latenza_ms=esito.latenza_ms,
        costo_eur=esito.costo_eur,
        esito=esito.esito,
        accuratezza=accuratezza(giudizi),
        giudizi=giudizi,
        calibrazione=calibrazione(giudizi),
    )


def aggrega(valutazioni: list[Valutazione]) -> list[RigaAggregata]:
    """Riduce le righe di un run a una tabella: una riga per modello.

    Ordinata per accuratezza decrescente — è la prima cosa che si vuole
    leggere quando si confrontano provider diversi.
    """
    per_modello: dict[tuple[str, str], list[Valutazione]] = {}
    for valutazione in valutazioni:
        per_modello.setdefault((valutazione.provider, valutazione.modello), []).append(valutazione)

    righe: list[RigaAggregata] = []
    for (provider, modello), gruppo in per_modello.items():
        costi = [v.costo_eur for v in gruppo if v.costo_eur is not None]
        scarti = [
            v.calibrazione.scarto_confidenza
            for v in gruppo
            if v.calibrazione.scarto_confidenza is not None
        ]
        latenze_ordinate = sorted(v.latenza_ms for v in gruppo)

        esatti_per_attributo: dict[AttributoCapo, float] = {}
        for attributo in AttributoCapo:
            giudizi_attributo = [
                giudizio
                for v in gruppo
                for giudizio in v.giudizi
                if giudizio.attributo is attributo
                and giudizio.esito is not EsitoAttributo.NON_VALUTATO
            ]
            if giudizi_attributo:
                esatti = sum(1 for g in giudizi_attributo if g.esito is EsitoAttributo.ESATTO)
                esatti_per_attributo[attributo] = round(esatti / len(giudizi_attributo), 4)

        righe.append(
            RigaAggregata(
                provider=provider,
                modello=modello,
                campioni=len(gruppo),
                accuratezza_media=round(sum(v.accuratezza for v in gruppo) / len(gruppo), 4),
                esatti_per_attributo=esatti_per_attributo,
                tasso_vago=round(
                    sum(1 for v in gruppo if v.esito is EsitoEsecuzione.VAGO) / len(gruppo), 4
                ),
                tasso_errore=round(
                    sum(1 for v in gruppo if v.esito is EsitoEsecuzione.ERRORE) / len(gruppo), 4
                ),
                inventati=sum(
                    1 for v in gruppo for g in v.giudizi if g.esito is EsitoAttributo.INVENTATO
                ),
                sicuri_e_sbagliati=sum(v.calibrazione.sicuri_e_sbagliati for v in gruppo),
                timidi_e_giusti=sum(v.calibrazione.timidi_e_giusti for v in gruppo),
                scarto_confidenza=round(sum(scarti) / len(scarti), 2) if scarti else None,
                costo_medio_eur=round(sum(costi) / len(costi), 6) if costi else None,
                latenza_mediana_ms=latenze_ordinate[len(latenze_ordinate) // 2],
            )
        )

    return sorted(righe, key=lambda riga: (-riga.accuratezza_media, riga.provider, riga.modello))
