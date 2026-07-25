"""Il banco di prova dei modelli.

Non è una chat: esercita i due job veri del prodotto — leggere una foto e
proporre outfit — così che «provo un altro modello» significhi cambiare una
riga, e «questo modello è meglio» sia una frase con dei numeri sotto.

L'orchestrazione sta qui, pura, e prende il provider come argomento: aggiungere
Gemini non tocca questo file.
"""

from __future__ import annotations

from datetime import datetime

from domain.errors import ErroreDominio
from domain.models import (
    SOGLIA_SCARTO,
    AttributoCapo,
    Capo,
    EsecuzionePlayground,
    EsitoEsecuzione,
    EsitoPlayground,
    JobIa,
    LetturaCapo,
    PresetPrompt,
    RichiestaPlayground,
    Suggerimento,
    UsoToken,
)
from domain.ports import ImmagineLlm, ProviderLlm
from domain.stylist import (
    SYSTEM_PROMPT_SUGGERIMENTO,
    interpreta_suggerimenti,
    richiesta_suggerimento,
)
from domain.vision import SYSTEM_PROMPT_ANALISI, interpreta_lettura, richiesta_analisi

PRESETS: tuple[PresetPrompt, ...] = (
    PresetPrompt(
        id="analisi-foto-capo",
        etichetta="Analisi foto capo",
        job=JobIa.ANALISI_CAPO,
        system_prompt=SYSTEM_PROMPT_ANALISI,
        temperatura=0.2,
        max_token=900,
    ),
    PresetPrompt(
        id="suggeritore-mattina",
        etichetta="Suggeritore mattina",
        job=JobIa.SUGGERIMENTO,
        system_prompt=SYSTEM_PROMPT_SUGGERIMENTO,
        temperatura=0.45,
        max_token=1200,
    ),
)


def preset(preset_id: str) -> PresetPrompt | None:
    return next((p for p in PRESETS if p.id == preset_id), None)


def calcola_costo(
    uso: UsoToken,
    *,
    costo_input_eur_mtok: float | None,
    costo_output_eur_mtok: float | None,
) -> float | None:
    """Costo in euro della singola chiamata, o None se il prezzo non lo sappiamo.

    Un modello locale costa zero, ed è un'informazione; un modello di cui non
    abbiamo il listino costa None, che è un'altra informazione. Non confonderle.
    """
    if costo_input_eur_mtok is None and costo_output_eur_mtok is None:
        return None
    per_milione = 1_000_000
    costo = (uso.token_input / per_milione) * (costo_input_eur_mtok or 0.0)
    costo += (uso.token_output / per_milione) * (costo_output_eur_mtok or 0.0)
    return round(costo, 6)


def valuta_lettura(lettura: LetturaCapo, soglia: int = SOGLIA_SCARTO) -> EsitoEsecuzione:
    """«Vago» è il verdetto più utile: ha risposto, ma non abbastanza da fidarsi."""
    letti = 0
    for attributo in AttributoCapo:
        valore = getattr(lettura, attributo.value, None)
        confidenza = lettura.confidenze.get(attributo, 0)
        if valore is not None and confidenza >= soglia:
            letti += 1
    return EsitoEsecuzione.OK if letti >= 4 else EsitoEsecuzione.VAGO


def valuta_suggerimenti(suggerimenti: list[Suggerimento]) -> EsitoEsecuzione:
    if not suggerimenti:
        return EsitoEsecuzione.VAGO
    motivi_deboli = sum(1 for s in suggerimenti if len(s.perche) < 2)
    if motivi_deboli > len(suggerimenti) // 2:
        return EsitoEsecuzione.VAGO
    if max(s.match for s in suggerimenti) < 60:
        return EsitoEsecuzione.VAGO
    return EsitoEsecuzione.OK


def esegui(
    richiesta: RichiestaPlayground,
    provider: ProviderLlm,
    *,
    immagine: ImmagineLlm | None = None,
    capi: list[Capo] | None = None,
    costo_input_eur_mtok: float | None = None,
    costo_output_eur_mtok: float | None = None,
) -> EsitoPlayground:
    """Esegue un job sul provider dato e riporta esito, tempi, costo.

    Non solleva: un provider che fallisce è un risultato del test, non un
    incidente. Lo storico serve proprio a vedere chi fallisce e quando.
    """
    if richiesta.job is JobIa.ANALISI_CAPO:
        if immagine is None:
            return _fallito(richiesta, "il job analisi_capo richiede una foto")
        chiamata = richiesta_analisi(
            immagine,
            richiesta.modello,
            system_prompt=richiesta.system_prompt,
            temperatura=richiesta.temperatura,
            max_token=richiesta.max_token,
        )
    else:
        if richiesta.contesto is None:
            return _fallito(richiesta, "il job suggerimento richiede un contesto")
        chiamata = richiesta_suggerimento(
            richiesta.contesto,
            richiesta.modello,
            system_prompt=richiesta.system_prompt,
            temperatura=richiesta.temperatura,
            max_token=richiesta.max_token,
        )

    try:
        risposta = provider.completa(chiamata)
    except ErroreDominio as exc:
        return _fallito(richiesta, str(exc))

    costo = calcola_costo(
        risposta.uso,
        costo_input_eur_mtok=costo_input_eur_mtok,
        costo_output_eur_mtok=costo_output_eur_mtok,
    )

    try:
        if richiesta.job is JobIa.ANALISI_CAPO:
            lettura = interpreta_lettura(risposta.testo)
            return EsitoPlayground(
                ok=True,
                esito=valuta_lettura(lettura),
                provider=provider.nome,
                modello=risposta.modello,
                latenza_ms=risposta.latenza_ms,
                uso=risposta.uso,
                costo_eur=costo,
                testo=risposta.testo,
                lettura=lettura,
            )

        suggerimenti = interpreta_suggerimenti(risposta.testo, capi or [])
        return EsitoPlayground(
            ok=True,
            esito=valuta_suggerimenti(suggerimenti),
            provider=provider.nome,
            modello=risposta.modello,
            latenza_ms=risposta.latenza_ms,
            uso=risposta.uso,
            costo_eur=costo,
            testo=risposta.testo,
            suggerimenti=suggerimenti,
        )
    except ErroreDominio as exc:
        # Il modello ha risposto ma fuori formato: teniamo il testo grezzo, è la
        # cosa che serve davvero quando si confrontano due provider.
        return EsitoPlayground(
            ok=False,
            esito=EsitoEsecuzione.ERRORE,
            provider=provider.nome,
            modello=risposta.modello,
            latenza_ms=risposta.latenza_ms,
            uso=risposta.uso,
            costo_eur=costo,
            testo=risposta.testo,
            errore=str(exc),
        )


def _fallito(richiesta: RichiestaPlayground, motivo: str) -> EsitoPlayground:
    return EsitoPlayground(
        ok=False,
        esito=EsitoEsecuzione.ERRORE,
        provider=richiesta.provider,
        modello=richiesta.modello,
        latenza_ms=0,
        errore=motivo,
    )


def traccia(
    richiesta: RichiestaPlayground,
    esito: EsitoPlayground,
    *,
    esecuzione_id: str,
    adesso: datetime,
    preset_id: str | None = None,
) -> EsecuzionePlayground:
    return EsecuzionePlayground(
        id=esecuzione_id,
        eseguita_il=adesso,
        job=richiesta.job,
        provider=esito.provider,
        modello=esito.modello,
        temperatura=richiesta.temperatura,
        latenza_ms=esito.latenza_ms,
        costo_eur=esito.costo_eur,
        esito=esito.esito,
        preset=preset_id,
    )
