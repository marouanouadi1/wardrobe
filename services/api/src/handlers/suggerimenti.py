"""POST /suggerimenti — lo stilista.

Questo handler sta nella VPC (legge l'armadio) ma non parla con Internet: la
chiamata al modello la delega alla Lambda `llm-worker`, che vive fuori. È il
motivo per cui questo progetto non ha un NAT Gateway.
"""

from __future__ import annotations

import os

from domain.models import RichiestaSuggerimenti, RispostaSuggerimenti
from domain.ports import ProviderLlm
from domain.stylist import costruisci_contesto, interpreta_suggerimenti, richiesta_suggerimento
from handlers._container import orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id

PROVIDER_DEFAULT = os.environ.get("PROVIDER_STILISTA", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_STILISTA", "")


def _provider(nome: str) -> ProviderLlm:
    """In cloud il modello lo chiama un'altra Lambda; altrove lo chiamiamo noi.

    Questa funzione sta in VPC e non ha uscita su Internet: per questo delega a
    `llm-worker`, che vive fuori (vedi docs/adr/0001). Senza `LLM_WORKER_ARN`
    (locale, o un VPS senza VPC) non c'è nessun worker da invocare, quindi
    parliamo direttamente col provider — altrimenti la feature di punta non
    sarebbe provabile senza un deploy.
    """
    if not os.environ.get("LLM_WORKER_ARN"):
        from adapters.llm.registry import provider_per_nome

        return provider_per_nome(nome)

    from adapters.llm.remoto import ProviderRemoto

    return ProviderRemoto(nome_provider=nome, funzione_arn=os.environ["LLM_WORKER_ARN"])


@endpoint
def proponi(evento: Evento) -> Risposta:
    richiesta = corpo(evento, RichiestaSuggerimenti)
    utente = utente_id(evento)

    capi = repository().elenca_capi(utente)
    profilo = repository().leggi_profilo(utente)

    contesto = costruisci_contesto(
        capi,
        oggi=orologio().oggi(),
        meteo=richiesta.meteo,
        agenda=richiesta.agenda,
        preferenze=profilo.preferenze if profilo else None,
        richiesta_utente=richiesta.richiesta_utente,
        numero_proposte=richiesta.numero_proposte,
    )

    provider = _provider(richiesta.provider or PROVIDER_DEFAULT)
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
