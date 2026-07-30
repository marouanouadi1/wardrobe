"""Un piccolo server locale che parla come API Gateway.

Solo sviluppo: `npm run api:local`. Costruisce lo stesso evento payload v2 che
riceverebbero le Lambda e chiama gli stessi handler, così quello che provi in
locale è lo stesso codice che gira in cloud — senza SAM, senza emulatori,
senza container.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

os.environ.setdefault("DEV_MODE", "1")

# Un file `.env` in questa cartella (services/api/.env) è più facile da
# spiegare a chi non ha mai usato un terminale di una variabile d'ambiente di
# sistema: si scrive con il Blocco Note e basta. Va caricato prima di
# importare gli handler, perché leggono le variabili («PROVIDER_VISIONE» e
# simili) al momento dell'import, non dentro una funzione.
from dotenv import load_dotenv

load_dotenv()

from handlers import (  # noqa: E402
    analisi,
    capi,
    foto,
    health,
    outfit,
    playground,
    profilo,
    suggerimenti,
)
from handlers._container import archivio_foto  # noqa: E402

Handler = Callable[[dict[str, Any], Any], dict[str, Any]]

ROTTE: list[tuple[str, re.Pattern[str], Handler]] = [
    ("GET", re.compile(r"^/salute$"), health.salute),
    ("POST", re.compile(r"^/foto/upload$"), foto.upload),
    ("GET", re.compile(r"^/capi$"), capi.elenca),
    ("POST", re.compile(r"^/capi$"), capi.crea),
    ("GET", re.compile(r"^/capi/(?P<capoId>[^/]+)$"), capi.leggi),
    ("PATCH", re.compile(r"^/capi/(?P<capoId>[^/]+)$"), capi.aggiorna),
    ("POST", re.compile(r"^/capi/(?P<capoId>[^/]+)/indossato$"), capi.indossa),
    ("GET", re.compile(r"^/armadio/riepilogo$"), capi.sommario),
    ("POST", re.compile(r"^/suggerimenti$"), suggerimenti.proponi),
    ("POST", re.compile(r"^/capi/analisi$"), analisi.avvia),
    ("GET", re.compile(r"^/capi/analisi/(?P<esecuzioneId>[^/]+)$"), analisi.stato),
    ("GET", re.compile(r"^/outfit$"), outfit.elenca),
    ("POST", re.compile(r"^/outfit$"), outfit.salva),
    ("GET", re.compile(r"^/outfit/(?P<outfitId>[^/]+)/colori$"), outfit.colori),
    ("GET", re.compile(r"^/profilo$"), profilo.leggi),
    ("PUT", re.compile(r"^/profilo$"), profilo.aggiorna),
    ("GET", re.compile(r"^/dev/modelli$"), playground.modelli),
    ("GET", re.compile(r"^/dev/preset$"), playground.preset),
    ("GET", re.compile(r"^/dev/contesto$"), playground.contesto),
    ("GET", re.compile(r"^/dev/playground/storico$"), playground.storico),
    ("POST", re.compile(r"^/dev/playground$"), playground.esegui_test),
]

# La foto viaggia come bytes grezzi, non come JSON: questa rotta sta fuori dal
# meccanismo di `ROTTE` sopra, che decodifica sempre il corpo come stringa.
# Serve a completare `ArchivioInMemoria.url_upload()`/`url_lettura()`: senza
# nessun S3 in locale, la PUT vera dell'app e la GET che l'app fa per mostrare
# la foto passano di qui.
_PATTERN_DEV_FOTO = re.compile(r"^/dev/foto/(?P<chiave>.+)$")


class Ponte(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _instrada(self, metodo: str) -> None:
        indirizzo = urlparse(self.path)
        lunghezza = int(self.headers.get("content-length") or 0)
        corpo = self.rfile.read(lunghezza).decode("utf-8") if lunghezza else ""

        for verbo, schema, handler in ROTTE:
            if verbo != metodo:
                continue
            trovato = schema.match(indirizzo.path)
            if trovato is None:
                continue

            evento = {
                "headers": {k.lower(): v for k, v in self.headers.items()},
                "pathParameters": trovato.groupdict(),
                "queryStringParameters": {k: v[0] for k, v in parse_qs(indirizzo.query).items()},
                "body": corpo,
                "requestContext": {"http": {"method": metodo, "path": indirizzo.path}},
            }
            self._rispondi(handler(evento, None))
            return

        self._rispondi({"statusCode": 404, "body": json.dumps({"errore": "rotta_inesistente"})})

    def _rispondi(self, risposta: dict[str, Any]) -> None:
        corpo = (risposta.get("body") or "").encode("utf-8")
        self.send_response(risposta.get("statusCode", 200))
        for chiave, valore in (risposta.get("headers") or {}).items():
            self.send_header(chiave, valore)
        # L'app gira su un'origine diversa (Expo web): senza CORS in locale non
        # si vede nulla. In cloud il CORS lo configura API Gateway.
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "*")
        self.send_header("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
        self.send_header("content-length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _dev_foto_put(self, chiave: str) -> None:
        """PUT /dev/foto/{chiave} — la PUT vera dell'app, corpo grezzo (JPEG/PNG)."""
        from adapters.memory import ArchivioInMemoria

        lunghezza = int(self.headers.get("content-length") or 0)
        contenuto = self.rfile.read(lunghezza) if lunghezza else b""
        content_type = self.headers.get("content-type") or "application/octet-stream"
        archivio = archivio_foto()
        if isinstance(archivio, ArchivioInMemoria):
            archivio.salva(chiave, contenuto, content_type)
        self._rispondi({"statusCode": 204, "body": ""})

    def _dev_foto_get(self, chiave: str) -> None:
        """GET /dev/foto/{chiave} — l'app la legge per mostrare la miniatura."""
        from domain.errors import ErroreDominio

        try:
            contenuto, media_type = archivio_foto().leggi(chiave)
        except ErroreDominio:
            self._rispondi({"statusCode": 404, "body": json.dumps({"errore": "foto_inesistente"})})
            return
        self.send_response(200)
        self.send_header("content-type", media_type)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("content-length", str(len(contenuto)))
        self.end_headers()
        self.wfile.write(contenuto)

    def do_GET(self) -> None:
        trovato = _PATTERN_DEV_FOTO.match(urlparse(self.path).path)
        if trovato:
            self._dev_foto_get(trovato.group("chiave"))
            return
        self._instrada("GET")

    def do_POST(self) -> None:
        self._instrada("POST")

    def do_PATCH(self) -> None:
        self._instrada("PATCH")

    def do_PUT(self) -> None:
        trovato = _PATTERN_DEV_FOTO.match(urlparse(self.path).path)
        if trovato:
            self._dev_foto_put(trovato.group("chiave"))
            return
        self._instrada("PUT")

    def do_OPTIONS(self) -> None:
        self._rispondi({"statusCode": 204, "body": ""})

    def log_message(self, formato: str, *argomenti: Any) -> None:
        print(f"  {self.command} {self.path}")


def main() -> None:
    porta = int(os.environ.get("PORTA", "8787"))
    print(f"API di Tela in ascolto su http://localhost:{porta} (DEV_MODE, dati in memoria)")
    ThreadingHTTPServer(("0.0.0.0", porta), Ponte).serve_forever()


if __name__ == "__main__":
    main()
