"""Gemini, via HTTP.

Come per OpenAI, gli id dei modelli sono configurabili (`MODELLI_GOOGLE`).
"""

from __future__ import annotations

import os
from typing import cast

from adapters.llm.base import alza_se_errore, chiave, client_http, cronometra
from domain.errors import ErroreProvider
from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm

NOME = "google"
VARIABILE_CHIAVE = "GOOGLE_API_KEY"
BASE = os.environ.get("GOOGLE_URL", "https://generativelanguage.googleapis.com/v1beta/models")
# Gli alias "-latest" invece di un id fisso ("gemini-2.5-pro" era il default
# precedente): Google smette di tanto in tanto di far leggere un id concreto ai
# nuovi progetti ("no longer available to new users"), mentre l'alias risolve
# sempre a un modello invocabile. Verificato con una chiave vera prima di
# cambiarlo.
MODELLI_DEFAULT = ("gemini-pro-latest", "gemini-flash-latest")

# Prezzi di listino in dollari per milione di token (input, output).
# Verificati il 2026-08-07: alla data, `gemini-pro-latest` risolve a Gemini
# 3.1 Pro (fino a 200k di contesto — oltre, Google applica una tariffa più
# alta che qui non modelliamo) e `gemini-flash-latest` a Gemini 3.6 Flash.
#
# Sono prezzi legati all'ALIAS, non a un modello fisso: se Google sposta il
# target dell'alias, questi numeri diventano sbagliati in silenzio. Fissare
# un id concreto in `MODELLI_GOOGLE` e aggiungerlo qui è il modo per non
# dipendere dall'alias quando il prezzo deve essere affidabile.
PREZZI_USD: dict[str, tuple[float, float]] = {
    "gemini-pro-latest": (2.0, 12.0),
    "gemini-flash-latest": (1.5, 7.5),
}


def _modelli_configurati() -> list[str]:
    grezzo = os.environ.get("MODELLI_GOOGLE")
    if not grezzo:
        return list(MODELLI_DEFAULT)
    return [m.strip() for m in grezzo.split(",") if m.strip()]


def _converti_schema(nodo: object) -> object:
    """Traduce il nostro JSON Schema nel sottoinsieme OpenAPI che Gemini accetta.

    `responseSchema` di Gemini non ha `additionalProperties` (proto senza quel
    campo) e non ammette `type` ripetuto: niente `["string", "null"]`, niente
    `anyOf` per esprimere «nullable». L'equivalente è un `type` singolo più
    `nullable: true` — vedi la richiesta di prova che ha confermato il formato.
    """
    if isinstance(nodo, list):
        return [_converti_schema(elemento) for elemento in nodo]
    if not isinstance(nodo, dict):
        return nodo

    if "anyOf" in nodo:
        rami = [r for r in nodo["anyOf"] if isinstance(r, dict)]
        non_null = [r for r in rami if r.get("type") != "null"]
        if len(non_null) == 1:
            # `non_null[0]` è un dict (filtrato sopra): `_converti_schema` su un
            # dict ritorna sempre un dict, ma la firma resta `object` per poter
            # ricorrere anche su liste e scalari.
            convertito = cast(dict[str, object], _converti_schema(non_null[0]))
            if any(r.get("type") == "null" for r in rami):
                convertito["nullable"] = True
            return convertito

    risultato: dict[str, object] = {}
    for campo, valore in nodo.items():
        if campo == "additionalProperties":
            continue
        if campo == "type" and isinstance(valore, list):
            non_null = [v for v in valore if v != "null"]
            if non_null:
                risultato["type"] = non_null[0]
            if "null" in valore:
                risultato["nullable"] = True
        elif campo == "enum":
            risultato["enum"] = [v for v in valore if v is not None]
        else:
            risultato[campo] = _converti_schema(valore)
    return risultato


def catalogo(configurato: bool) -> list[ModelloDisponibile]:
    return [
        ModelloDisponibile(
            provider=NOME,
            id=modello,
            etichetta=modello,
            visione=True,
            note="contesto lungo; listino verificato il 2026-08-07",
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

        # Gemini chiama il turno del modello "model", non "assistant" come gli
        # altri provider: è l'unica differenza di vocabolario nel tradurre la
        # cronologia.
        contenuti: list[dict[str, object]] = [
            {
                "role": "user" if turno.ruolo == "utente" else "model",
                "parts": [{"text": turno.testo}],
            }
            for turno in richiesta.cronologia
        ]
        contenuti.append({"role": "user", "parts": parti})

        generazione: dict[str, object] = {
            "temperature": richiesta.temperatura,
            "maxOutputTokens": richiesta.max_token,
            # I modelli "pro" più recenti (dietro l'alias `gemini-pro-latest`)
            # ragionano sempre e non accettano un budget 0: senza un tetto
            # basso, il pensiero arriva a consumare quasi tutto `maxOutputTokens`
            # e il JSON finale esce troncato — stesso problema di
            # `thinking={"type": "disabled"}` in `anthropic_provider.py`, qui
            # risolto abbassando il budget invece di disattivarlo (non è
            # permesso). 128 è il minimo consentito da Gemini.
            "thinkingConfig": {"thinkingBudget": 128},
        }
        if richiesta.forza_json:
            generazione["responseMimeType"] = "application/json"
            if richiesta.schema_atteso is not None:
                generazione["responseSchema"] = _converti_schema(richiesta.schema_atteso)

        corpo: dict[str, object] = {
            "contents": contenuti,
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
