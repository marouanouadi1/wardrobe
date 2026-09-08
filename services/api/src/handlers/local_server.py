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
from datetime import UTC, datetime
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

from handlers import (  # noqa: E402
    analisi,
    auth,
    capi,
    chat,
    foto,
    health,
    outfit,
    profilo,
    segnalazioni,
    suggerimenti,
)
from handlers._container import archivio_foto  # noqa: E402

Handler = Callable[[dict[str, Any], Any], dict[str, Any]]

ROTTE: list[tuple[str, re.Pattern[str], Handler]] = [
    ("GET", re.compile(r"^/salute$"), health.salute),
    ("POST", re.compile(r"^/auth/accedi$"), auth.accedi),
    ("POST", re.compile(r"^/auth/registrati$"), auth.registra),
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
    ("POST", re.compile(r"^/segnalazioni$"), segnalazioni.crea),
    ("GET", re.compile(r"^/segnalazioni$"), segnalazioni.elenca),
    ("PATCH", re.compile(r"^/segnalazioni/(?P<segnalazioneId>[^/]+)$"), segnalazioni.aggiorna),
]

# La foto viaggia come bytes grezzi, non come JSON: questa rotta sta fuori dal
# meccanismo di `ROTTE` sopra, che decodifica sempre il corpo come stringa.
# Serve a completare `ArchivioInMemoria`/`ArchivioFileSystem`: la loro
# `url_upload()`/`url_lettura()` puntano qui, e la PUT vera dell'app e la GET
# che l'app fa per mostrare la foto passano di qui. Non autenticata da un
# token — la firma nella query string (`?scade=...&firma=...`, verificata
# sotto) è il solo controllo: senza, chiunque conosca una chiave potrebbe
# leggere o sovrascrivere qualunque foto sull'archivio.
_PATTERN_FOTO = re.compile(r"^/foto/(?P<chiave>.+)$")


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

    def _firma_valida(self, chiave: str, query: str) -> bool:
        from domain.firma_foto import firma_valida

        parametri = parse_qs(query)
        scade = parametri.get("scade", [""])[0]
        firma = parametri.get("firma", [""])[0]
        if not scade.isdigit() or not firma:
            return False
        adesso_epoch = int(datetime.now(UTC).timestamp())
        return firma_valida(chiave, int(scade), firma, os.environ["JWT_SECRET"], adesso_epoch)

    def _foto_put(self, chiave: str, query: str) -> None:
        """PUT /foto/{chiave}?scade=...&firma=... — la PUT vera dell'app, corpo
        grezzo (JPEG/PNG).

        Sia `ArchivioInMemoria` sia `ArchivioFileSystem` la usano come
        bersaglio della loro `url_upload()`: qui basta chiamare `salva()`,
        dopo aver verificato che la firma sia quella emessa da loro.
        """
        if not self._firma_valida(chiave, query):
            self._rispondi({"statusCode": 403, "body": json.dumps({"errore": "firma_non_valida"})})
            return
        lunghezza = int(self.headers.get("content-length") or 0)
        contenuto = self.rfile.read(lunghezza) if lunghezza else b""
        content_type = self.headers.get("content-type") or "application/octet-stream"
        archivio_foto().salva(chiave, contenuto, content_type)
        self._rispondi({"statusCode": 204, "body": ""})

    def _foto_get(self, chiave: str, query: str) -> None:
        """GET /foto/{chiave}?scade=...&firma=... — l'app la legge per
        mostrare la miniatura."""
        from domain.errors import ErroreDominio

        if not self._firma_valida(chiave, query):
            self._rispondi({"statusCode": 403, "body": json.dumps({"errore": "firma_non_valida"})})
            return
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
        indirizzo = urlparse(self.path)
        trovato = _PATTERN_FOTO.match(indirizzo.path)
        if trovato:
            self._foto_get(trovato.group("chiave"), indirizzo.query)
            return
        self._instrada("GET")

    def do_POST(self) -> None:
        self._instrada("POST")

    def do_PATCH(self) -> None:
        self._instrada("PATCH")

    def do_PUT(self) -> None:
        indirizzo = urlparse(self.path)
        trovato = _PATTERN_FOTO.match(indirizzo.path)
        if trovato:
            self._foto_put(trovato.group("chiave"), indirizzo.query)
            return
        self._instrada("PUT")

    def do_OPTIONS(self) -> None:
        self._rispondi({"statusCode": 204, "body": ""})

    def log_message(self, formato: str, *argomenti: Any) -> None:
        print(f"  {self.command} {self.path}")


def _controlla_configurazione() -> None:
    """`JWT_SECRET` serve sempre, anche in `DEV_MODE=1`: firma sia i token di
    login sia le URL delle foto (`_http.py`, `firma_foto.py`), e un `.env.example`
    che la dichiara «obbligatoria, sempre» non deve poi lasciarla passare vuota
    in silenzio — un `JWT_SECRET=""` firmerebbe comunque, solo con una chiave
    che chiunque conosce.

    `DATABASE_URL`/`CARTELLA_FOTO` invece restano facoltative in `DEV_MODE=1`:
    senza, il backend resta in memoria di proposito (vedi `adapters/memory.py`),
    comodo per provare. Fuori da `DEV_MODE` un default silenzioso lì sarebbe un
    rischio, non una comodità: un `.env` dimenticato farebbe partire un server
    pubblico con i capi in memoria, senza dirlo a nessuno finché qualcuno non
    se ne accorge da fuori."""
    if not os.environ.get("JWT_SECRET"):
        raise SystemExit(
            "✗ Manca JWT_SECRET: senza non firmo né i token di login né le URL "
            "delle foto. Aggiungi in services/api/.env una riga JWT_SECRET=... "
            "con una stringa lunga e casuale — es. genera con `openssl rand "
            "-hex 32` e incolla il risultato, il `.env` non esegue comandi."
        )
    if os.environ.get("DEV_MODE") != "1":
        mancanti = [nome for nome in ("DATABASE_URL", "CARTELLA_FOTO") if not os.environ.get(nome)]
        if mancanti:
            variabili = ", ".join(mancanti)
            raise SystemExit(
                f"✗ Mancano {variabili} fuori da DEV_MODE: non parto con un "
                "backend che tiene i capi in memoria su un ambiente che non "
                "è di sviluppo."
            )


def main() -> None:
    _controlla_configurazione()
    porta = int(os.environ.get("PORTA", "8787"))
    persistenza = "Postgres" if os.environ.get("DATABASE_URL") else "memoria (si azzera al riavvio)"
    print(f"API di Wardrobe in ascolto sulla porta {porta} — capi su {persistenza}")
    ThreadingHTTPServer(("0.0.0.0", porta), Ponte).serve_forever()


if __name__ == "__main__":
    main()
