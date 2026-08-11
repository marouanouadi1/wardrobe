"""Il pezzo di HTTP che gli handler non devono ripetere.

Formato eventi: un dict con `headers`, `pathParameters`,
`queryStringParameters` e `body`, sintetizzato da `local_server.py` per ogni
richiesta in arrivo.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from domain.errors import ErroreDominio, NonAutenticato, RichiestaNonValida

logger = logging.getLogger("wardrobe")
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

Evento = dict[str, Any]
Risposta = dict[str, Any]

INTESTAZIONI = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
}


def utente_id(evento: Evento) -> str:
    """L'utente autenticato: sempre e solo da un JWT valido (`JWT_SECRET`,
    vedi `handlers/auth.py`). Nessun bypass: senza token, o con un token
    scaduto o firmato con un altro segreto, la richiesta non ha un utente —
    401, perché il client deve poterlo distinguere da un corpo malformato e
    rimandare al login, non solo mostrare un errore generico.
    """
    intestazioni = {str(k).lower(): str(v) for k, v in (evento.get("headers") or {}).items()}

    segreto = os.environ["JWT_SECRET"]
    autorizzazione = intestazioni.get("authorization", "")
    if autorizzazione.lower().startswith("bearer "):
        from domain.autenticazione import verifica_token

        sub = verifica_token(autorizzazione[7:], segreto)
        if sub:
            return sub

    raise NonAutenticato("richiesta senza un token valido")


def corpo[M: BaseModel](evento: Evento, modello: type[M]) -> M:
    """Valida il body contro un modello di dominio. Fuori formato = 422."""
    grezzo = evento.get("body") or "{}"
    if evento.get("isBase64Encoded"):
        import base64

        grezzo = base64.b64decode(grezzo).decode("utf-8")
    try:
        return modello.model_validate_json(grezzo)
    except ValidationError as exc:
        raise RichiestaNonValida(f"corpo non valido: {exc.error_count()} problemi") from exc


def query(evento: Evento) -> dict[str, str]:
    return {k: v for k, v in (evento.get("queryStringParameters") or {}).items() if v is not None}


def parametro(evento: Evento, nome: str) -> str:
    valore = (evento.get("pathParameters") or {}).get(nome)
    if not valore:
        raise RichiestaNonValida(f"parametro «{nome}» mancante nel path")
    return str(valore)


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
            return ok({"errore": exc.codice, "messaggio": str(exc)}, exc.stato_http)
        except Exception:
            # Niente dettagli al client, tutto nei log: un 500 non è un canale
            # di comunicazione.
            logger.exception("errore non gestito")
            return ok({"errore": "errore_interno"}, 500)

    wrapper.__name__ = funzione.__name__
    return wrapper
