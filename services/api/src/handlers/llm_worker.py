"""La Lambda che parla con i provider. Vive FUORI dalla VPC.

È l'unica funzione con uscita su Internet, e non ha né accesso al database né
credenziali per averlo. Le chiavi dei provider le riceve dall'ambiente,
popolato da Secrets Manager al deploy.
"""

from __future__ import annotations

import logging
from typing import Any

from domain.errors import ErroreDominio
from domain.ports import RichiestaLlm

logger = logging.getLogger("wardrobe.llm")


def esegui(evento: dict[str, Any], _contesto: Any = None) -> dict[str, Any]:
    from adapters.llm.registry import provider_per_nome

    try:
        provider = provider_per_nome(evento["provider"])
        risposta = provider.completa(RichiestaLlm.model_validate(evento["richiesta"]))
        return risposta.model_dump(mode="json")
    except ErroreDominio as exc:
        # Restituiamo l'errore invece di sollevarlo: il chiamante è Step
        # Functions o un'altra Lambda, e un errore leggibile vale più di uno
        # stack trace nel log di qualcun altro.
        logger.warning("provider %s in errore: %s", evento.get("provider"), exc)
        return {"errore": str(exc), "codice": exc.codice}
