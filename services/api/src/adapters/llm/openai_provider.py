"""OpenAI, via HTTP.

Gli id dei modelli arrivano dall'ambiente (`MODELLI_OPENAI`, separati da
virgola) perché cambiano più spesso di questo file. I default sono quelli
indicati nel design: da confermare prima di fidarsi dei prezzi.
"""

from __future__ import annotations

import os

from adapters.llm.base import alza_se_errore, chiave, client_http, cronometra
from domain.errors import ErroreProvider
from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm

NOME = "openai"
VARIABILE_CHIAVE = "OPENAI_API_KEY"
URL = os.environ.get("OPENAI_URL", "https://api.openai.com/v1/chat/completions")
# `gpt-5.1-mini` non esiste nel catalogo OpenAI (mai verificato prima d'ora):
# `gpt-5-mini`, della generazione precedente, è la variante economica con
# visione che risulta davvero raggiungibile.
MODELLI_DEFAULT = ("gpt-5.1", "gpt-5-mini")

# Prezzi di listino in dollari per milione di token (input, output).
# Verificati il 2026-08-07 sul listino OpenAI. Sono numeri che invecchiano:
# quando `MODELLI_OPENAI` introduce un id nuovo, qui manca e il costo torna
# None (vedi `domain.playground.calcola_costo`) — che è la risposta onesta,
# non zero.
#
# Il tier di input "cached" (0.125 su gpt-5.1, 0.025 su gpt-5-mini) non è
# modellato: nel banco di valutazione ogni chiamata è indipendente, non c'è
# mai un prefisso ripetuto da cachare, e un terzo prezzo per un caso che non
# si presenta sarebbe precisione finta.
PREZZI_USD: dict[str, tuple[float, float]] = {
    "gpt-5.1": (1.25, 10.0),
    "gpt-5-mini": (0.25, 2.0),
}

# I modelli "reasoning" di OpenAI (o1/o3/o4, la famiglia gpt-5) accettano solo
# la temperatura di default e rifiutano con 400 qualunque altro valore. Stesso
# problema di Anthropic (vedi `anthropic_provider.SENZA_TEMPERATURA`): lo
# risolviamo per prefisso, non per id esatto, perché `MODELLI_OPENAI` può
# introdurre varianti nuove della stessa famiglia senza toccare questo file.
PREFISSI_SENZA_TEMPERATURA = ("gpt-5", "o1", "o3", "o4")


def _accetta_temperatura(modello: str) -> bool:
    return not modello.startswith(PREFISSI_SENZA_TEMPERATURA)


def _modelli_configurati() -> list[str]:
    grezzo = os.environ.get("MODELLI_OPENAI")
    if not grezzo:
        return list(MODELLI_DEFAULT)
    return [m.strip() for m in grezzo.split(",") if m.strip()]


def catalogo(configurato: bool) -> list[ModelloDisponibile]:
    return [
        ModelloDisponibile(
            provider=NOME,
            id=modello,
            accetta_temperatura=_accetta_temperatura(modello),
            etichetta=modello,
            visione=True,
            note="visione; listino verificato il 2026-08-07",
            configurato=configurato,
        )
        for modello in _modelli_configurati()
    ]


class ProviderOpenAI:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        self._chiave = chiave(NOME, VARIABILE_CHIAVE, chiave_override)

    def modelli(self) -> list[ModelloDisponibile]:
        return catalogo(configurato=True)

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        contenuto: list[dict[str, object]] = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:{i.media_type};base64,{i.base64}"},
            }
            for i in richiesta.immagini
        ]
        contenuto.append({"type": "text", "text": richiesta.prompt})

        messaggi: list[dict[str, object]] = []
        if richiesta.system:
            messaggi.append({"role": "system", "content": richiesta.system})
        for turno in richiesta.cronologia:
            ruolo = "user" if turno.ruolo == "utente" else "assistant"
            messaggi.append({"role": ruolo, "content": turno.testo})
        messaggi.append({"role": "user", "content": contenuto})

        corpo: dict[str, object] = {
            "model": richiesta.modello,
            "messages": messaggi,
            "max_completion_tokens": richiesta.max_token,
        }
        if _accetta_temperatura(richiesta.modello):
            corpo["temperature"] = richiesta.temperatura
        if richiesta.forza_json:
            corpo["response_format"] = (
                {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "lettura_capo",
                        "strict": True,
                        "schema": richiesta.schema_atteso,
                    },
                }
                if richiesta.schema_atteso is not None
                else {"type": "json_object"}
            )

        with client_http() as client:
            risposta, latenza_ms = cronometra(
                lambda: client.post(
                    URL,
                    headers={"authorization": f"Bearer {self._chiave}"},
                    json=corpo,
                )
            )
        alza_se_errore(risposta, NOME)
        dati = risposta.json()

        scelte = dati.get("choices") or []
        if not scelte:
            raise ErroreProvider(f"{NOME} non ha restituito alcuna scelta")
        uso = dati.get("usage") or {}

        return RispostaLlm(
            testo=scelte[0].get("message", {}).get("content") or "",
            modello=dati.get("model", richiesta.modello),
            uso=UsoToken(
                token_input=int(uso.get("prompt_tokens", 0)),
                token_output=int(uso.get("completion_tokens", 0)),
            ),
            latenza_ms=latenza_ms,
        )
