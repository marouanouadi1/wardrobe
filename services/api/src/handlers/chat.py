"""POST /chat, GET /chat — la chat vera dello stilista.

Sullo stesso armadio vero di /suggerimenti, ma con memoria e con la voce:
ogni messaggio si aggiunge a una cronologia persistita per utente, il modello
la rivede prima di rispondere, e può rispondere a parole — non solo con una
lista di outfit. Una chat per utente, continua — non ci sono sessioni da
aprire o chiudere.

Il system prompt non è una costante: è quello effettivo
(`domain.playground.preset_effettivo`) del preset "chat-stilista", che
riflette l'ultima versione salvata nel playground. Cambiare il prompt lì
cambia anche questa chat, senza deploy.
"""

from __future__ import annotations

import os

from domain.chat import interpreta_risposta_chat, richiesta_chat
from domain.models import MessaggioChat, RichiestaMessaggioChat, RispostaChat, RuoloChat
from domain.playground import preset_effettivo
from domain.ports import ProviderLlm
from domain.stylist import costruisci_contesto
from handlers._container import generatore_id, in_sviluppo, orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id

PROVIDER_DEFAULT = os.environ.get("PROVIDER_STILISTA", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_STILISTA", "")

ID_PRESET_STILISTA = "chat-stilista"


def _provider(nome: str) -> ProviderLlm:
    """Stessa scelta di `handlers.suggerimenti`: in VPC si delega al worker."""
    if in_sviluppo():
        from adapters.llm.registry import provider_per_nome

        return provider_per_nome(nome)

    from adapters.llm.remoto import ProviderRemoto

    return ProviderRemoto(nome_provider=nome, funzione_arn=os.environ["LLM_WORKER_ARN"])


@endpoint
def elenca(evento: Evento) -> Risposta:
    """GET /chat — la cronologia intera: non si azzera aprendo l'app."""
    utente = utente_id(evento)
    messaggi = repository().elenca_messaggi_chat(utente)
    return ok({"messaggi": [m.model_dump(mode="json") for m in messaggi]})


@endpoint
def invia(evento: Evento) -> Risposta:
    """POST /chat — un messaggio, una risposta vera del modello, entrambi salvati.

    Il modello viene interpellato e la sua risposta validata PRIMA di salvare
    qualunque turno. Se il modello risponde fuori formato, la cronologia resta
    esattamente come l'utente l'ha lasciata — niente domanda senza risposta
    che confonderebbe il turno successivo (due «utente» consecutivi sono
    legali per ogni provider, ma è la forma che li disorienta di più).
    """
    richiesta = corpo(evento, RichiestaMessaggioChat)
    utente = utente_id(evento)

    capi = repository().elenca_capi(utente)
    profilo = repository().leggi_profilo(utente)
    precedenti = repository().elenca_messaggi_chat(utente)

    contesto = costruisci_contesto(
        capi,
        oggi=orologio().oggi(),
        meteo=richiesta.meteo,
        agenda=richiesta.agenda,
        preferenze=profilo.preferenze if profilo else None,
        richiesta_utente=richiesta.testo,
    )

    preset = preset_effettivo(ID_PRESET_STILISTA, repository().leggi_preset(ID_PRESET_STILISTA))
    provider = _provider(PROVIDER_DEFAULT)
    modello = MODELLO_DEFAULT or provider.modelli()[0].id

    risposta_llm = provider.completa(
        richiesta_chat(
            contesto,
            precedenti,
            modello,
            system_prompt=preset.system_prompt,
            temperatura=preset.temperatura,
            max_token=preset.max_token,
        )
    )
    risposta_stilista = interpreta_risposta_chat(risposta_llm.testo, capi)

    adesso = orologio().adesso()
    messaggio_utente = MessaggioChat(
        id=generatore_id().nuovo(),
        ruolo=RuoloChat.UTENTE,
        testo=richiesta.testo,
        creato_il=adesso,
    )
    repository().salva_messaggio_chat(utente, messaggio_utente)

    messaggio_tela = MessaggioChat(
        id=generatore_id().nuovo(),
        ruolo=RuoloChat.TELA,
        testo=risposta_stilista.risposta,
        suggerimenti=risposta_stilista.proposte,
        creato_il=adesso,
    )
    repository().salva_messaggio_chat(utente, messaggio_tela)

    return ok(
        RispostaChat(
            utente=messaggio_utente,
            tela=messaggio_tela,
            contesto=contesto,
            provider=provider.nome,
            modello=risposta_llm.modello,
            latenza_ms=risposta_llm.latenza_ms,
        )
    )
