"""POST /chat, GET /chat, /chat/conversazioni — la chat vera dello stilista.

Sullo stesso armadio vero di /suggerimenti, ma con memoria e con la voce:
ogni messaggio si aggiunge alla cronologia della sua conversazione, il
modello la rivede prima di rispondere, e può rispondere a parole — non solo
con una lista di outfit. Più conversazioni per utente, dalla decisione
registrata in docs/adr/0006-lo-storico-della-chat.md — prima ce n'era una
sola, continua.
"""

from __future__ import annotations

import os

from domain.chat import (
    MAX_TOKEN_CHAT,
    SYSTEM_PROMPT_CHAT,
    TEMPERATURA_CHAT,
    interpreta_risposta_chat,
    richiesta_chat,
    titolo_da_primo_messaggio,
)
from domain.errors import ConversazioneNonTrovata
from domain.models import (
    ConversazioneChat,
    ElencoConversazioniChat,
    ElencoMessaggiChat,
    MessaggioChat,
    RichiestaMessaggioChat,
    RispostaChat,
    RuoloChat,
)
from domain.stylist import costruisci_contesto
from handlers._container import generatore_id, orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, utente_id

PROVIDER_DEFAULT = os.environ.get("PROVIDER_STILISTA", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_STILISTA", "")


@endpoint
def elenca(evento: Evento) -> Risposta:
    """GET /chat — l'ultima conversazione, con i suoi messaggi. Vuota se
    l'utente non ne ha ancora nessuna."""
    utente = utente_id(evento)
    conversazioni = repository().elenca_conversazioni_chat(utente)
    if not conversazioni:
        return ok(ElencoMessaggiChat(messaggi=[], conversazione=None))

    ultima = conversazioni[0].conversazione
    messaggi = repository().elenca_messaggi_chat(utente, ultima.id)
    return ok(ElencoMessaggiChat(messaggi=messaggi, conversazione=ultima))


@endpoint
def elenca_conversazioni(evento: Evento) -> Risposta:
    """GET /chat/conversazioni — l'elenco delle conversazioni, dalla più recente."""
    utente = utente_id(evento)
    return ok(ElencoConversazioniChat(conversazioni=repository().elenca_conversazioni_chat(utente)))


@endpoint
def leggi_conversazione(evento: Evento) -> Risposta:
    """GET /chat/conversazioni/{conversazioneId} — i messaggi di una
    conversazione specifica. 404 se non esiste o non è di chi chiama."""
    utente = utente_id(evento)
    conversazione_id = parametro(evento, "conversazioneId")
    conversazione = repository().leggi_conversazione_chat(utente, conversazione_id)
    if conversazione is None:
        raise ConversazioneNonTrovata(conversazione_id)

    messaggi = repository().elenca_messaggi_chat(utente, conversazione_id)
    return ok(ElencoMessaggiChat(messaggi=messaggi, conversazione=conversazione))


@endpoint
def elimina_conversazione(evento: Evento) -> Risposta:
    """DELETE /chat/conversazioni/{conversazioneId} — la conversazione e i
    suoi turni, insieme."""
    utente = utente_id(evento)
    conversazione_id = parametro(evento, "conversazioneId")
    conversazione = repository().leggi_conversazione_chat(utente, conversazione_id)
    if conversazione is None:
        raise ConversazioneNonTrovata(conversazione_id)

    repository().elimina_conversazione_chat(utente, conversazione_id)
    return ok(None, 204)


@endpoint
def invia(evento: Evento) -> Risposta:
    """POST /chat — un messaggio, una risposta vera del modello, entrambi salvati.

    Il modello viene interpellato e la sua risposta validata PRIMA di salvare
    qualunque turno — compresa la conversazione stessa, quando `conversazione_id`
    è assente: se il modello risponde fuori formato o il provider non è
    configurato, non deve restare nell'elenco una conversazione vuota che
    l'utente scoprirebbe di dover cancellare a mano. Se il modello risponde
    fuori formato, la cronologia resta esattamente come l'utente l'ha
    lasciata — niente domanda senza risposta che confonderebbe il turno
    successivo (due «utente» consecutivi sono legali per ogni provider, ma è
    la forma che li disorienta di più).
    """
    from adapters.llm.registry import provider_per_nome

    richiesta = corpo(evento, RichiestaMessaggioChat)
    utente = utente_id(evento)

    conversazione_esistente: ConversazioneChat | None = None
    if richiesta.conversazione_id:
        conversazione_esistente = repository().leggi_conversazione_chat(
            utente, richiesta.conversazione_id
        )
        if conversazione_esistente is None:
            raise ConversazioneNonTrovata(richiesta.conversazione_id)

    capi = repository().elenca_capi(utente)
    profilo = repository().leggi_profilo(utente)
    precedenti = (
        repository().elenca_messaggi_chat(utente, conversazione_esistente.id)
        if conversazione_esistente
        else []
    )

    contesto = costruisci_contesto(
        capi,
        oggi=orologio().oggi(),
        meteo=richiesta.meteo,
        agenda=richiesta.agenda,
        preferenze=profilo.preferenze if profilo else None,
        richiesta_utente=richiesta.testo,
    )

    provider = provider_per_nome(PROVIDER_DEFAULT)
    modello = MODELLO_DEFAULT or provider.modelli()[0].id

    risposta_llm = provider.completa(
        richiesta_chat(
            contesto,
            precedenti,
            modello,
            system_prompt=SYSTEM_PROMPT_CHAT,
            temperatura=TEMPERATURA_CHAT,
            max_token=MAX_TOKEN_CHAT,
        )
    )
    # Da qui in poi la risposta è valida: è il punto oltre il quale è sicuro
    # scrivere, sia la conversazione sia i suoi due turni.
    risposta_stilista = interpreta_risposta_chat(risposta_llm.testo, capi)

    adesso = orologio().adesso()
    conversazione = repository().salva_conversazione_chat(
        utente,
        (
            conversazione_esistente.model_copy(update={"ultimo_turno_il": adesso})
            if conversazione_esistente
            else ConversazioneChat(
                id=generatore_id().nuovo(),
                titolo=titolo_da_primo_messaggio(richiesta.testo),
                creata_il=adesso,
                ultimo_turno_il=adesso,
            )
        ),
    )

    messaggio_utente = MessaggioChat(
        id=generatore_id().nuovo(),
        ruolo=RuoloChat.UTENTE,
        testo=richiesta.testo,
        creato_il=adesso,
    )
    repository().salva_messaggio_chat(utente, conversazione.id, messaggio_utente)

    messaggio_wardrobe = MessaggioChat(
        id=generatore_id().nuovo(),
        ruolo=RuoloChat.WARDROBE,
        testo=risposta_stilista.risposta,
        suggerimenti=risposta_stilista.proposte,
        creato_il=adesso,
    )
    repository().salva_messaggio_chat(utente, conversazione.id, messaggio_wardrobe)

    return ok(
        RispostaChat(
            utente=messaggio_utente,
            wardrobe=messaggio_wardrobe,
            conversazione=conversazione,
            contesto=contesto,
            provider=provider.nome,
            modello=risposta_llm.modello,
            latenza_ms=risposta_llm.latenza_ms,
        )
    )
