"""Il pezzo di HTTP che gli handler non devono ripetere.

Formato eventi: un dict con `headers` e `body`, sintetizzato da
`local_server.py` per ogni richiesta in arrivo. Le rotte rimaste (ADR 0010) sono
tutte POST con un corpo JSON, più `GET /salute`: niente parametri nel percorso
né nella query.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from domain.accesso import Sessione
from domain.errors import ErroreDominio, NonAutenticato, RichiestaNonValida

_LIVELLO = os.environ.get("LOG_LEVEL", "INFO")
# Senza un handler, un record sotto WARNING non arriva da nessuna parte:
# Python usa `logging.lastResort` come rete di sicurezza, e quella ha un
# livello fisso a WARNING. `logger.setLevel` da solo (con `basicConfig` mai
# chiamato) faceva sembrare configurato un logger che in realtà scartava ogni
# `.debug()`/`.info()` in silenzio, in sviluppo come in produzione.
logging.basicConfig(level=_LIVELLO)
logger = logging.getLogger("wardrobe")
logger.setLevel(_LIVELLO)

Evento = dict[str, Any]
Risposta = dict[str, Any]

INTESTAZIONI = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
}


def sessione(evento: Evento) -> Sessione:
    """Chi chiama: sempre e solo da un token di Supabase Auth verificato
    (`domain/accesso.py`), con le chiavi pubbliche del progetto. Nessun bypass:
    senza token, o con un token scaduto, firmato da altri o per un altro
    progetto, la richiesta non ha un utente — 401, perché il client deve poterlo
    distinguere da un corpo malformato e rinnovare la sessione, o rimandare al
    login.

    Restituisce anche il token, perché il backend agisce **come** quella persona
    verso Supabase (ADR 0010): è il token, non un filtro nel codice, a decidere
    cosa vede.
    """
    from domain.accesso import emittente_di, verifica_token
    from handlers._container import chiavi_auth, url_progetto

    intestazioni = {str(k).lower(): str(v) for k, v in (evento.get("headers") or {}).items()}
    autorizzazione = intestazioni.get("authorization", "")
    if autorizzazione.lower().startswith("bearer "):
        verificata = verifica_token(
            autorizzazione[7:].strip(), chiavi_auth().chiave, emittente_di(url_progetto())
        )
        if verificata is not None:
            return verificata

    raise NonAutenticato("richiesta senza un token valido")


def corpo[M: BaseModel](evento: Evento, modello: type[M]) -> M:
    """Valida il body contro un modello di dominio. Fuori formato = 422."""
    grezzo = evento.get("body") or "{}"
    try:
        return modello.model_validate_json(grezzo)
    except ValidationError as exc:
        raise RichiestaNonValida(f"corpo non valido: {exc.error_count()} problemi") from exc


def ok(dati: BaseModel | list[Any] | dict[str, Any] | None, stato: int = 200) -> Risposta:
    if dati is None:
        return {"statusCode": stato, "headers": INTESTAZIONI, "body": ""}
    if isinstance(dati, BaseModel):
        corpo_json = dati.model_dump_json(exclude_none=True)
    else:
        corpo_json = json.dumps(dati, default=str, ensure_ascii=False)
    return {"statusCode": stato, "headers": INTESTAZIONI, "body": corpo_json}


def endpoint(funzione: Callable[[Evento], Risposta]) -> Callable[[Evento, Any], Risposta]:
    """Trasforma una funzione pura-ish in un handler HTTP.

    Cattura gli errori di dominio e li traduce in status: il dominio non sa
    cosa sia un 404, e questo è l'unico posto che lo sa.
    """

    def wrapper(evento: Evento, _contesto: Any = None) -> Risposta:
        try:
            return funzione(evento)
        except ErroreDominio as exc:
            logger.warning("errore di dominio: %s (%s)", exc, exc.codice)
            # `LetturaNonValida` e `SuggerimentoNonValido` portano con sé la
            # risposta grezza del modello (`domain/errors.py`): senza questo
            # log restava catturata e mai letta da nessuno, e un fallimento
            # del modello era impossibile da diagnosticare in produzione.
            # Troncata: è per i log, non un dump illimitato.
            grezzo = getattr(exc, "grezzo", None)
            if grezzo:
                logger.warning("risposta grezza del modello: %s", grezzo[:2000])
            return ok({"errore": exc.codice, "messaggio": str(exc)}, exc.stato_http)
        except Exception:
            # Niente dettagli al client, tutto nei log: un 500 non è un canale
            # di comunicazione.
            logger.exception("errore non gestito")
            return ok({"errore": "errore_interno"}, 500)

    wrapper.__name__ = funzione.__name__
    return wrapper
