"""Il server HTTP: `npm run api:local` in sviluppo, lo stesso processo dentro
il container `api` su un VPS in produzione — nessuna differenza fra i due.

Costruisce a mano un piccolo evento (`headers`, `pathParameters`,
`queryStringParameters`, `body`) e chiama gli stessi handler; nessun
framework web, solo la libreria standard.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

# Un file `.env` in questa cartella (services/api/.env) è più facile da
# spiegare a chi non ha mai usato un terminale di una variabile d'ambiente di
# sistema: si scrive con il Blocco Note e basta. Va caricato prima di fissare
# i default sotto — altrimenti un `.env` con `DEV_MODE=0` (per provare il
# login vero in locale) non avrebbe alcun effetto, perché python-dotenv non
# sovrascrive una variabile già presente in `os.environ` — e prima di
# importare gli handler, perché leggono le variabili («PROVIDER_VISIONE» e
# simili) al momento dell'import, non dentro una funzione.
from dotenv import load_dotenv

load_dotenv()

os.environ.setdefault("DEV_MODE", "1")
# Senza queste due, disattivate di proposito fuori da un ambiente di
# sviluppo (vedi handlers/playground.py e handlers/_http.py), il playground e
# l'accesso senza login smetterebbero di funzionare in locale.
os.environ.setdefault("PLAYGROUND_ABILITATO", "1")
os.environ.setdefault("AUTH_APERTA", "1")

from handlers import (  # noqa: E402
    analisi,
    auth,
    capi,
    chat,
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
    ("POST", re.compile(r"^/auth/accedi$"), auth.accedi),
    ("POST", re.compile(r"^/foto/upload$"), foto.upload),
    ("GET", re.compile(r"^/capi$"), capi.elenca),
    ("POST", re.compile(r"^/capi$"), capi.crea),
    ("GET", re.compile(r"^/capi/(?P<capoId>[^/]+)$"), capi.leggi),
    ("PATCH", re.compile(r"^/capi/(?P<capoId>[^/]+)$"), capi.aggiorna),
    ("POST", re.compile(r"^/capi/(?P<capoId>[^/]+)/indossato$"), capi.indossa),
    ("GET", re.compile(r"^/armadio/riepilogo$"), capi.sommario),
    ("POST", re.compile(r"^/suggerimenti$"), suggerimenti.proponi),
    ("GET", re.compile(r"^/chat$"), chat.elenca),
    ("POST", re.compile(r"^/chat$"), chat.invia),
    ("POST", re.compile(r"^/capi/analisi$"), analisi.avvia),
    ("GET", re.compile(r"^/capi/analisi/(?P<esecuzioneId>[^/]+)$"), analisi.stato),
    ("GET", re.compile(r"^/outfit$"), outfit.elenca),
    ("POST", re.compile(r"^/outfit$"), outfit.salva),
    ("GET", re.compile(r"^/outfit/(?P<outfitId>[^/]+)/colori$"), outfit.colori),
    ("GET", re.compile(r"^/profilo$"), profilo.leggi),
    ("PUT", re.compile(r"^/profilo$"), profilo.aggiorna),
    ("GET", re.compile(r"^/dev/modelli$"), playground.modelli),
    ("GET", re.compile(r"^/dev/preset$"), playground.preset),
    ("POST", re.compile(r"^/dev/preset$"), playground.salva_preset),
    ("GET", re.compile(r"^/dev/contesto$"), playground.contesto),
    ("GET", re.compile(r"^/dev/playground/storico$"), playground.storico),
    ("POST", re.compile(r"^/dev/playground$"), playground.esegui_test),
    ("GET", re.compile(r"^/dev/valutazioni$"), playground.valutazioni),
    ("GET", re.compile(r"^/dev/immagini$"), playground.immagini),
    ("POST", re.compile(r"^/dev/immagini$"), playground.vota_immagine),
]

# La foto viaggia come bytes grezzi, non come JSON: questa rotta sta fuori dal
# meccanismo di `ROTTE` sopra, che decodifica sempre il corpo come stringa.
# Serve a completare `ArchivioInMemoria`/`ArchivioFileSystem`: la loro
# `url_upload()`/`url_lettura()` puntano qui, e la PUT vera dell'app e la GET
# che l'app fa per mostrare la foto passano di qui.
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
        # L'app gira su un'origine diversa (Expo web): senza CORS non si vede
        # nulla.
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "*")
        self.send_header("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
        self.send_header("content-length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _dev_foto_put(self, chiave: str) -> None:
        """PUT /dev/foto/{chiave} — la PUT vera dell'app, corpo grezzo (JPEG/PNG).

        Sia `ArchivioInMemoria` sia `ArchivioFileSystem` la usano come
        bersaglio della loro `url_upload()`: qui basta chiamare `salva()`.
        """
        lunghezza = int(self.headers.get("content-length") or 0)
        contenuto = self.rfile.read(lunghezza) if lunghezza else b""
        content_type = self.headers.get("content-type") or "application/octet-stream"
        archivio_foto().salva(chiave, contenuto, content_type)
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
    persistenza = "Postgres" if os.environ.get("DATABASE_URL") else "memoria (si azzera al riavvio)"
    print(f"API di Wardrobe in ascolto sulla porta {porta} — capi su {persistenza}")
    ThreadingHTTPServer(("0.0.0.0", porta), Ponte).serve_forever()


if __name__ == "__main__":
    main()
