"""POST /chat — la chat vera dello stilista.

Sullo stesso armadio vero di /suggerimenti, ma con memoria e con la voce:
ogni messaggio si aggiunge alla cronologia della sua conversazione, il
modello la rivede prima di rispondere, e può rispondere a parole — non solo
con una lista di outfit. Più conversazioni per utente, dalla decisione
registrata in docs/adr/0006-lo-storico-della-chat.md.

Lo storico e l'elenco delle conversazioni l'app li legge da sé da Supabase
(ADR 0010); qui resta solo il turno che chiede il modello, e lo si scrive con il
token di chi chiama: una conversazione di un altro, per lui, non esiste.
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
    MessaggioChat,
    RichiestaMessaggioChat,
    RispostaChat,
    RuoloChat,
)
from domain.stylist import costruisci_contesto
from handlers._container import generatore_id, orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, sessione

PROVIDER_DEFAULT = os.environ.get("PROVIDER_STILISTA", "anthropic")
MODELLO_DEFAULT = os.environ.get("MODELLO_STILISTA", "")


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

    chi = sessione(evento)
    richiesta = corpo(evento, RichiestaMessaggioChat)
    deposito = repository(chi)
    # L'ora in cui la domanda arriva, prima del modello: il turno dell'utente
    # porta questa, quello dello stilista l'ora della risposta. Con la stessa
    # ora per entrambi, l'ordine dei due nello storico sarebbe un pareggio.
    arrivata_il = orologio().adesso()

    conversazione_esistente: ConversazioneChat | None = None
    if richiesta.conversazione_id:
        conversazione_esistente = deposito.leggi_conversazione_chat(richiesta.conversazione_id)
        if conversazione_esistente is None:
            raise ConversazioneNonTrovata(richiesta.conversazione_id)

    capi = deposito.elenca_capi()
    profilo = deposito.leggi_profilo()
    precedenti = (
        deposito.elenca_messaggi_chat(conversazione_esistente.id) if conversazione_esistente else []
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

    risposta_il = orologio().adesso()
    conversazione = conversazione_esistente or deposito.crea_conversazione_chat(
        ConversazioneChat(
            id=generatore_id().nuovo(),
            titolo=titolo_da_primo_messaggio(richiesta.testo),
            creata_il=arrivata_il,
            ultimo_turno_il=arrivata_il,
        )
    )

    messaggio_utente, messaggio_wardrobe = deposito.salva_messaggi_chat(
        conversazione.id,
        [
            MessaggioChat(
                id=generatore_id().nuovo(),
                ruolo=RuoloChat.UTENTE,
                testo=richiesta.testo,
                creato_il=arrivata_il,
            ),
            MessaggioChat(
                id=generatore_id().nuovo(),
                ruolo=RuoloChat.WARDROBE,
                testo=risposta_stilista.risposta,
                suggerimenti=risposta_stilista.proposte,
                creato_il=risposta_il,
            ),
        ],
    )
    # Il trigger sul messaggio ha spostato in cima la conversazione: la si
    # rilegge, così la risposta porta l'`ultimo_turno_il` vero.
    conversazione = deposito.leggi_conversazione_chat(conversazione.id) or conversazione

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
