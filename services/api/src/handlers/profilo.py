"""Il profilo: preferenze di stile e foto per l'avatar 2D."""

from __future__ import annotations

from domain.models import PreferenzeStile, Profilo
from handlers._container import orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id


@endpoint
def leggi(evento: Evento) -> Risposta:
    """Al primo accesso il profilo non c'è: lo creiamo vuoto, senza chiedere nulla.

    Nessun questionario obbligatorio all'ingresso — le preferenze si imparano
    dall'uso, e l'onboarding ne chiede tre a titolo di cortesia.
    """
    utente = utente_id(evento)
    profilo = repository().leggi_profilo(utente)
    if profilo is None:
        profilo = repository().salva_profilo(
            Profilo(id=utente, nome="", preferenze=PreferenzeStile(), creato_il=orologio().adesso())
        )
    return ok(profilo)


@endpoint
def aggiorna(evento: Evento) -> Risposta:
    utente = utente_id(evento)
    nuovo = corpo(evento, Profilo)
    return ok(repository().salva_profilo(nuovo.model_copy(update={"id": utente})))
