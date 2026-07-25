"""Un provider che non parla con Internet: delega a un'altra Lambda.

Serve alle Lambda dentro la VPC, che leggono il database ma non hanno uscita su
Internet. Invece di aggiungere un NAT Gateway per farle uscire, chiamano la
Lambda `llm-worker`, che sta fuori dalla VPC e fa la telefonata al provider.

Dal punto di vista del dominio è un `ProviderLlm` come gli altri: stesso
Protocol, stessa chiamata. Il dominio non sa che c'è una Lambda in mezzo.
"""

from __future__ import annotations

import json

import boto3

from adapters.llm.base import cronometra
from adapters.llm.registry import catalogo
from domain.errors import ErroreProvider
from domain.models import ModelloDisponibile
from domain.ports import RichiestaLlm, RispostaLlm


class ProviderRemoto:
    def __init__(self, nome_provider: str, funzione_arn: str) -> None:
        self.nome = nome_provider
        self._arn = funzione_arn
        self._lambda = boto3.client("lambda")

    def modelli(self) -> list[ModelloDisponibile]:
        return [m for m in catalogo() if m.provider == self.nome]

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        risposta, latenza_ms = cronometra(
            lambda: self._lambda.invoke(
                FunctionName=self._arn,
                InvocationType="RequestResponse",
                Payload=json.dumps(
                    {
                        "provider": self.nome,
                        "richiesta": richiesta.model_dump(mode="json"),
                    }
                ).encode(),
            )
        )

        corpo = json.loads(risposta["Payload"].read())
        if risposta.get("FunctionError") or "errore" in corpo:
            raise ErroreProvider(str(corpo.get("errore", risposta.get("FunctionError"))))

        # Teniamo la nostra latenza: quella misurata dal worker non include il
        # tempo di andata e ritorno, e all'utente interessa l'attesa vera.
        return RispostaLlm.model_validate(corpo).model_copy(update={"latenza_ms": latenza_ms})
