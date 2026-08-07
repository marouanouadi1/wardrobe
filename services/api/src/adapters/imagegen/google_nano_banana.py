"""Gemini per la generazione/pulizia di foto di capi: la Interactions API.

Non è `adapters/llm/google_provider.py`: quello parla su
`:generateContent` (testo e lettura foto), questo genera immagini su
`/v1beta/interactions` — un'API separata di Google. La documentazione
pubblica non mostra la forma reale della risposta (mescola esempi
dell'endpoint legacy con quello nuovo): la forma qui sotto (`steps[].content[]`
con `type: "image"`) è stata verificata con una chiamata vera il 2026-08-07,
non dedotta dai docs.
"""

from __future__ import annotations

import base64
import os

from adapters.llm.base import alza_se_errore, chiave, client_http
from domain.errors import ErroreProvider
from domain.models import ModelloImmagine

NOME = "google"
VARIABILE_CHIAVE = "GOOGLE_API_KEY"
BASE = os.environ.get(
    "GOOGLE_URL_INTERAZIONI", "https://generativelanguage.googleapis.com/v1beta/interactions"
)

# Prezzi per immagine a 1024x1024 (1K) — l'unica risoluzione che serve qui,
# una foto di capo scattata in casa (vedi GUIDA.md) non ha bisogno di 4K.
# Verificati il 2026-08-07 sul listino ufficiale
# (ai.google.dev/gemini-api/docs/pricing): 1120 token di output per immagine
# a $60/Mtok (flash) e $120/Mtok (pro). `gemini-2.5-flash-image` è più
# economico ma in dismissione entro ottobre 2026: escluso apposta, un banco
# non deve consigliare un modello che sparisce prima di essere messo in
# produzione.
PREZZI_USD_IMMAGINE: dict[str, float] = {
    "gemini-3.1-flash-image": 0.067,
    "gemini-3-pro-image": 0.134,
}

TASSO_USD_EUR = float(os.environ.get("TASSO_USD_EUR", "0.92"))


def catalogo(configurato: bool) -> list[ModelloImmagine]:
    return [
        ModelloImmagine(
            servizio=NOME,
            id=modello,
            etichetta=modello,
            costo_eur_immagine=round(prezzo * TASSO_USD_EUR, 4),
            configurato=configurato,
        )
        for modello, prezzo in PREZZI_USD_IMMAGINE.items()
    ]


class ServizioGenerazioneImmaginiGoogle:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        self._chiave = chiave(NOME, VARIABILE_CHIAVE, chiave_override)

    def genera(self, contenuto: bytes, media_type: str, istruzioni: str, modello: str) -> bytes:
        corpo = {
            "model": modello,
            "input": [
                {"type": "text", "text": istruzioni},
                {
                    "type": "image",
                    "mime_type": media_type,
                    "data": base64.b64encode(contenuto).decode("ascii"),
                },
            ],
        }
        with client_http() as client:
            risposta = client.post(BASE, headers={"x-goog-api-key": self._chiave}, json=corpo)
        alza_se_errore(risposta, NOME)
        dati = risposta.json()

        for passo in dati.get("steps") or []:
            for pezzo in passo.get("content") or []:
                if pezzo.get("type") == "image" and pezzo.get("data"):
                    return base64.b64decode(pezzo["data"])

        raise ErroreProvider(f"{NOME} non ha restituito un'immagine")
