"""Gemini, via HTTP.

Come per OpenAI, gli id dei modelli sono configurabili (`MODELLI_GOOGLE`).
"""

from __future__ import annotations

import os

from adapters.llm.base import alza_se_errore, chiave, client_http, cronometra
from domain.errors import ErroreProvider
from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm

NOME = "google"
VARIABILE_CHIAVE = "GOOGLE_API_KEY"
BASE = os.environ.get("GOOGLE_URL", "https://generativelanguage.googleapis.com/v1beta/models")
MODELLI_DEFAULT = ("gemini-2.5-pro", "gemini-2.5-flash")


def _modelli_configurati() -> list[str]:
    grezzo = os.environ.get("MODELLI_GOOGLE")
    if not grezzo:
        return list(MODELLI_DEFAULT)
    return [m.strip() for m in grezzo.split(",") if m.strip()]


def catalogo(configurato: bool) -> list[ModelloDisponibile]:
    return [
        ModelloDisponibile(
            provider=NOME,
            id=modello,
            etichetta=modello,
            visione=True,
            note="contesto lungo; prezzi da verificare nel listino Google",
            configurato=configurato,
        )
        for modello in _modelli_configurati()
    ]


class ProviderGoogle:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        self._chiave = chiave(NOME, VARIABILE_CHIAVE, chiave_override)

    def modelli(self) -> list[ModelloDisponibile]:
        return catalogo(configurato=True)

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        parti: list[dict[str, object]] = [
            {"inline_data": {"mime_type": i.media_type, "data": i.base64}}
            for i in richiesta.immagini
        ]
        parti.append({"text": richiesta.prompt})

        generazione: dict[str, object] = {
            "temperature": richiesta.temperatura,
            "maxOutputTokens": richiesta.max_token,
        }
        if richiesta.forza_json:
            generazione["responseMimeType"] = "application/json"
            if richiesta.schema_atteso is not None:
                generazione["responseSchema"] = richiesta.schema_atteso

        corpo: dict[str, object] = {
            "contents": [{"role": "user", "parts": parti}],
            "generationConfig": generazione,
        }
        if richiesta.system:
            corpo["systemInstruction"] = {"parts": [{"text": richiesta.system}]}

        with client_http() as client:
            risposta, latenza_ms = cronometra(
                lambda: client.post(
                    f"{BASE}/{richiesta.modello}:generateContent",
                    headers={"x-goog-api-key": self._chiave},
                    json=corpo,
                )
            )
        alza_se_errore(risposta, NOME)
        dati = risposta.json()

        candidati = dati.get("candidates") or []
        if not candidati:
            raise ErroreProvider(f"{NOME} non ha restituito alcun candidato")
        testo = "".join(
            parte.get("text", "")
            for parte in candidati[0].get("content", {}).get("parts", [])
            if "text" in parte
        )
        uso = dati.get("usageMetadata") or {}

        return RispostaLlm(
            testo=testo,
            modello=dati.get("modelVersion", richiesta.modello),
            uso=UsoToken(
                token_input=int(uso.get("promptTokenCount", 0)),
                token_output=int(uso.get("candidatesTokenCount", 0)),
            ),
            latenza_ms=latenza_ms,
        )
