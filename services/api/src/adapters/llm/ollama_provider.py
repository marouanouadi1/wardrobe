"""Ollama in locale: costo zero, nessuna chiave, utile come metro di paragone.

Non richiede credenziali, quindi risulta sempre «configurato»: se il demone non
è in ascolto, il fallimento è un errore di connessione — che è comunque un
risultato del test.
"""

from __future__ import annotations

import os

from adapters.llm.base import alza_se_errore, client_http, cronometra
from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm

NOME = "ollama"
BASE = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODELLI_DEFAULT = ("llama3.3", "llava")


def _modelli_configurati() -> list[str]:
    grezzo = os.environ.get("MODELLI_OLLAMA")
    if not grezzo:
        return list(MODELLI_DEFAULT)
    return [m.strip() for m in grezzo.split(",") if m.strip()]


def catalogo(configurato: bool = True) -> list[ModelloDisponibile]:
    return [
        ModelloDisponibile(
            provider=NOME,
            id=modello,
            etichetta=f"{modello} (locale)",
            visione=modello.startswith("llava"),
            note="gratis, gira sulla tua macchina",
            costo_input_eur_mtok=0.0,
            costo_output_eur_mtok=0.0,
            configurato=configurato,
        )
        for modello in _modelli_configurati()
    ]


class ProviderOllama:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        # Firma allineata agli altri provider: il registro li costruisce tutti
        # allo stesso modo, e qui la chiave semplicemente non serve.
        del chiave_override

    def modelli(self) -> list[ModelloDisponibile]:
        return catalogo()

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        messaggio: dict[str, object] = {"role": "user", "content": richiesta.prompt}
        if richiesta.immagini:
            messaggio["images"] = [i.base64 for i in richiesta.immagini]

        messaggi: list[dict[str, object]] = []
        if richiesta.system:
            messaggi.append({"role": "system", "content": richiesta.system})
        messaggi.append(messaggio)

        corpo: dict[str, object] = {
            "model": richiesta.modello,
            "messages": messaggi,
            "stream": False,
            "options": {
                "temperature": richiesta.temperatura,
                "num_predict": richiesta.max_token,
            },
        }
        if richiesta.forza_json:
            corpo["format"] = richiesta.schema_atteso if richiesta.schema_atteso else "json"

        with client_http() as client:
            risposta, latenza_ms = cronometra(lambda: client.post(f"{BASE}/api/chat", json=corpo))
        alza_se_errore(risposta, NOME)
        dati = risposta.json()

        return RispostaLlm(
            testo=(dati.get("message") or {}).get("content") or "",
            modello=dati.get("model", richiesta.modello),
            uso=UsoToken(
                token_input=int(dati.get("prompt_eval_count", 0)),
                token_output=int(dati.get("eval_count", 0)),
            ),
            latenza_ms=latenza_ms,
        )
