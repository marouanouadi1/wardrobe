"""POST /suggerimenti — lo stilista, sull'armadio di chi chiama (letto con il
suo token: ADR 0010)."""

from __future__ import annotations

import logging
import os

from domain.models import RichiestaSuggerimenti, RispostaSuggerimenti
from domain.stylist import (
    costruisci_contesto,
    interpreta_suggerimenti,
    payload_contesto,
    richiesta_suggerimento,
)
from handlers._container import orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, sessione

logger = logging.getLogger("wardrobe")

PROVIDER_DEFAULT = os.environ.get("PROVIDER_STILISTA", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_STILISTA", "")


@endpoint
def proponi(evento: Evento) -> Risposta:
    from adapters.llm.registry import provider_per_nome

    chi = sessione(evento)
    richiesta = corpo(evento, RichiestaSuggerimenti)

    deposito = repository(chi)
    capi = deposito.elenca_capi()
    profilo = deposito.leggi_profilo()

    contesto = costruisci_contesto(
        capi,
        oggi=orologio().oggi(),
        meteo=richiesta.meteo,
        agenda=richiesta.agenda,
        preferenze=profilo.preferenze if profilo else None,
        richiesta_utente=richiesta.richiesta_utente,
        numero_proposte=richiesta.numero_proposte,
    )
    # Il primo posto da guardare se un suggerimento esce strano (vedi il
    # docstring di `payload_contesto`): non era mai stato loggato.
    logger.debug("contesto suggerimenti: %s", payload_contesto(contesto))

    provider = provider_per_nome(richiesta.provider or PROVIDER_DEFAULT)
    modello = richiesta.modello or MODELLO_DEFAULT or provider.modelli()[0].id
    risposta = provider.completa(richiesta_suggerimento(contesto, modello))

    return ok(
        RispostaSuggerimenti(
            suggerimenti=interpreta_suggerimenti(risposta.testo, capi),
            contesto=contesto,
            provider=provider.nome,
            modello=risposta.modello,
            latenza_ms=risposta.latenza_ms,
        )
    )
