"""Step Functions: avvio dell'analisi e lettura del suo stato.

Non teniamo una tabella «lavori in corso»: lo stato dell'esecuzione lo conosce
già la state machine, e `DescribeExecution` è la fonte di verità. Una tabella in
più sarebbe una seconda verità da tenere sincronizzata.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import boto3

from domain.models import StatoAnalisi

_STATI = {
    "RUNNING": StatoAnalisi.IN_CORSO,
    "PENDING_REDRIVE": StatoAnalisi.IN_CORSO,
    "SUCCEEDED": StatoAnalisi.COMPLETATA,
    "FAILED": StatoAnalisi.FALLITA,
    "TIMED_OUT": StatoAnalisi.FALLITA,
    "ABORTED": StatoAnalisi.FALLITA,
}


@dataclass(frozen=True)
class Descrizione:
    stato: StatoAnalisi
    uscita: dict[str, Any] | None = None
    errore: str | None = None


class Orchestratore:
    def __init__(self, state_machine_arn: str) -> None:
        self._arn = state_machine_arn
        self._sfn = boto3.client("stepfunctions")

    def avvia(self, ingresso: dict[str, Any]) -> str:
        esecuzione = self._sfn.start_execution(
            stateMachineArn=self._arn, input=json.dumps(ingresso)
        )
        return str(esecuzione["executionArn"])

    def stato(self, esecuzione_arn: str) -> Descrizione:
        descrizione = self._sfn.describe_execution(executionArn=esecuzione_arn)
        stato = _STATI.get(descrizione["status"], StatoAnalisi.FALLITA)

        if stato is StatoAnalisi.COMPLETATA and descrizione.get("output"):
            return Descrizione(stato=stato, uscita=json.loads(descrizione["output"]))
        if stato is StatoAnalisi.FALLITA:
            return Descrizione(
                stato=stato, errore=descrizione.get("cause") or descrizione["status"]
            )
        return Descrizione(stato=stato)
