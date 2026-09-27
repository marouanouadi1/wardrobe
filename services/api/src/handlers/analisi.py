"""POST /capi/analisi — la foto è già nello Storage, qui parte la lettura.

Due fasi nello stesso processo: `analizza` legge la foto e interroga il
modello, `salva` crea il capo. La risposta arriva quando sono finite entrambe,
ma con la forma di un avvio asincrono (202 + id): l'esito vive in
`analisi_esiti`, e l'app lo legge da sé da Supabase. Si scrive **una volta sola**,
a lavoro finito: «completata» con il suo capo, o «fallita» con il motivo. Un esito
aperto prima e chiuso dopo resterebbe «in corso» per sempre a ogni analisi
interrotta — da un deploy, da una seconda scrittura che non arriva.

Tutto come l'utente (ADR 0010): la foto si legge con il suo token, e una foto
che non è sua per lo Storage non esiste. È quello che chiude `T-47`.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Any

from domain.accesso import Sessione, basta_per_un_lavoro_lungo, percorso_dell_utente
from domain.errors import ErroreDominio, NonAutenticato, RichiestaNonValida
from domain.models import (
    AnalisiAvviata,
    Capo,
    EsitoAnalisi,
    LetturaCapo,
    RichiestaAnalisi,
    StatoAnalisi,
)
from domain.ports import ImmagineLlm
from domain.vision import crea_capo, interpreta_lettura, richiesta_analisi
from handlers._container import (
    BUCKET_FOTO,
    archivio,
    generatore_id,
    orologio,
    repository,
    servizio_scontorno,
)
from handlers._http import Evento, Risposta, corpo, endpoint, ok, sessione

PROVIDER_DEFAULT = os.environ.get("PROVIDER_VISIONE", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_VISIONE", "")

logger = logging.getLogger("wardrobe")


@endpoint
def avvia(evento: Evento) -> Risposta:
    chi = sessione(evento)
    richiesta = corpo(evento, RichiestaAnalisi)
    if not percorso_dell_utente(chi.utente_id, richiesta.chiave_foto):
        raise RichiestaNonValida("la foto non è nella tua cartella")
    # Un token che scade a metà lascerebbe il capo e l'esito impossibili da scrivere.
    if not basta_per_un_lavoro_lungo(chi, orologio().adesso()):
        raise NonAutenticato("la sessione sta per scadere: rinnovala e riprova")

    deposito = repository(chi)
    esecuzione = generatore_id().nuovo()
    try:
        capo = salva(chi, analizza(chi, richiesta))
        esito = EsitoAnalisi(esecuzione_id=esecuzione, stato=StatoAnalisi.COMPLETATA, capo=capo)
    except ErroreDominio as exc:
        esito = EsitoAnalisi(esecuzione_id=esecuzione, stato=StatoAnalisi.FALLITA, errore=str(exc))
    except Exception:
        # Qualunque altra eccezione (SDK del provider, rete, risposta non
        # parsabile) non deve uscire come un 500 anonimo: il dettaglio resta
        # nei log, non arriva al client.
        logger.exception("analisi fallita per %s", richiesta.chiave_foto)
        esito = EsitoAnalisi(
            esecuzione_id=esecuzione,
            stato=StatoAnalisi.FALLITA,
            errore="L'analisi non è riuscita: riprova con più luce.",
        )
    deposito.registra_esito_analisi(esito)
    return ok(AnalisiAvviata(esecuzione_id=esecuzione, stato=esito.stato), 202)


def analizza(chi: Sessione, richiesta: RichiestaAnalisi) -> dict[str, Any]:
    """Prima fase — scontorna (se configurato), legge la foto, interroga il modello."""
    from adapters.llm.registry import provider_per_nome

    foto = archivio(chi, BUCKET_FOTO)
    contenuto, media_type = foto.leggi(richiesta.chiave_foto)

    # Lo scontorno è un miglioramento, non un requisito: vedi docs/adr/0004,
    # è il passo naturale prima della lettura — un capo già isolato dallo
    # sfondo è anche una foto più facile da leggere per il modello. Ma
    # provare l'app non deve dipendere dall'avere già una seconda chiave
    # oltre a quella del provider di visione, quindi se non è configurato o
    # fallisce si prosegue sulla foto originale.
    chiave_scontornata: str | None = None
    scontorno = servizio_scontorno()
    if scontorno is not None:
        try:
            scontornata = scontorno.scontorna(contenuto, media_type)
            chiave_scontornata = f"{richiesta.chiave_foto}-scontornata"
            foto.salva(chiave_scontornata, scontornata, "image/png")
            contenuto, media_type = scontornata, "image/png"
        except ErroreDominio as exc:
            logger.warning("scontorno non riuscito: %s", exc)
            chiave_scontornata = None

    immagine = ImmagineLlm(
        media_type=media_type, base64=base64.b64encode(contenuto).decode("ascii")
    )

    provider = provider_per_nome(richiesta.provider or PROVIDER_DEFAULT)
    modello = richiesta.modello or MODELLO_DEFAULT or provider.modelli()[0].id
    risposta = provider.completa(richiesta_analisi(immagine, modello))
    lettura = interpreta_lettura(risposta.testo)

    return {
        "chiave_foto": richiesta.chiave_foto,
        "chiave_scontornata": chiave_scontornata,
        "provider": provider.nome,
        "modello": modello,
        "lettura": lettura.model_dump(mode="json"),
    }


def salva(chi: Sessione, letto: dict[str, Any]) -> Capo:
    """Seconda fase — trasforma la lettura in capo e lo crea."""
    capo = crea_capo(
        LetturaCapo.model_validate(letto["lettura"]),
        capo_id=generatore_id().nuovo(),
        chiave_foto=letto["chiave_foto"],
        chiave_scontornata=letto["chiave_scontornata"],
        provider=letto["provider"],
        modello=letto["modello"],
        adesso=orologio().adesso(),
    )
    return repository(chi).crea_capo(capo)
