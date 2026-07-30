"""Scontorno via fal.ai (BiRefNet): isola il capo dallo sfondo.

Un adapter HTTP sottile, come i provider LLM che non sono di riferimento: la
logica di dominio (quando chiamarlo, cosa fare se fallisce) sta in
`handlers/analisi.py`, qui c'è solo la chiamata. fal.ai è tra i servizi di
scontorno più economici (pochi centesimi di dollaro a foto): buono per un test
con qualche decina di capi, prima di scegliere un fornitore definitivo.

L'immagine viaggia come data URI base64, non come URL: in locale la foto sta
in memoria del processo o su MinIO dietro `localhost`, che fal.ai non può
raggiungere da Internet. fal.ai accetta entrambe le forme; il costo in più di
una richiesta leggermente più grande è accettabile per foto di un capo.
"""

from __future__ import annotations

import base64

from adapters.llm.base import alza_se_errore, chiave, client_http
from domain.errors import ErroreProvider

NOME = "fal"
VARIABILE_CHIAVE = "FAL_KEY"
URL = "https://fal.run/fal-ai/birefnet/v2"


class ServizioScontornoFal:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        self._chiave = chiave(NOME, VARIABILE_CHIAVE, chiave_override)

    def scontorna(self, contenuto: bytes, media_type: str) -> bytes:
        data_uri = f"data:{media_type};base64,{base64.b64encode(contenuto).decode('ascii')}"

        with client_http() as client:
            risposta = client.post(
                URL,
                headers={"authorization": f"Key {self._chiave}"},
                json={"image_url": data_uri},
            )
        alza_se_errore(risposta, NOME)
        dati = risposta.json()

        immagine = dati.get("image") or {}
        url_risultato = immagine.get("url")
        if not url_risultato:
            raise ErroreProvider(f"{NOME} non ha restituito un'immagine scontornata")

        with client_http() as client:
            scaricata = client.get(url_risultato)
        alza_se_errore(scaricata, NOME)
        return scaricata.content
