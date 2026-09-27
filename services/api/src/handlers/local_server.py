"""Il server HTTP: `npm run api:local` in sviluppo, lo stesso processo dentro
il container `api` su un VPS in produzione — nessuna differenza fra i due.

Costruisce a mano un piccolo evento (`headers`, `body`) e chiama gli stessi
handler; nessun framework web, solo la libreria standard.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

# Un file `.env` in questa cartella (services/api/.env) è più facile da
# spiegare a chi non ha mai usato un terminale di una variabile d'ambiente di
# sistema: si scrive con il Blocco Note e basta. Va caricato prima di importare
# gli handler, perché leggono le variabili («PROVIDER_VISIONE» e simili) al
# momento dell'import, non dentro una funzione.
from dotenv import load_dotenv

load_dotenv()

from handlers import (  # noqa: E402
    analisi,
    chat,
    esportazione,
    health,
    suggerimenti,
)

Handler = Callable[[dict[str, Any], Any], dict[str, Any]]

#: Solo ciò che chiede l'IA, più la salute e l'esportazione (ADR 0010): capi,
#: outfit, profilo, storico della chat e segnalazioni l'app li legge e li
#: scrive da sé, su Supabase, con l'RLS.
ROTTE: list[tuple[str, re.Pattern[str], Handler]] = [
    ("GET", re.compile(r"^/salute$"), health.salute),
    ("POST", re.compile(r"^/capi/analisi$"), analisi.avvia),
    ("POST", re.compile(r"^/suggerimenti$"), suggerimenti.proponi),
    ("POST", re.compile(r"^/chat$"), chat.invia),
    ("POST", re.compile(r"^/esportazione$"), esportazione.crea),
]


class Ponte(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _instrada(self, metodo: str) -> None:
        indirizzo = urlparse(self.path)
        lunghezza = int(self.headers.get("content-length") or 0)
        corpo = self.rfile.read(lunghezza).decode("utf-8") if lunghezza else ""

        for verbo, schema, handler in ROTTE:
            if verbo != metodo:
                continue
            if schema.match(indirizzo.path) is None:
                continue

            evento = {
                "headers": {k.lower(): v for k, v in self.headers.items()},
                "body": corpo,
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
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("content-length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self) -> None:
        self._instrada("GET")

    def do_POST(self) -> None:
        self._instrada("POST")

    def do_OPTIONS(self) -> None:
        self._rispondi({"statusCode": 204, "body": ""})

    def log_message(self, formato: str, *argomenti: Any) -> None:
        # Il percorso senza la query, e mai le intestazioni: il token di chi
        # chiama sta nell'`authorization`, e un log che lo contenesse varrebbe
        # quanto la sua sessione.
        print(f"  {self.command} {urlparse(self.path).path}")


VARIABILI_OBBLIGATORIE = ("SUPABASE_URL", "SUPABASE_CHIAVE_PUBBLICA")


def _controlla_configurazione() -> None:
    """Senza il progetto Supabase il backend non verifica nessun token e non
    legge nessun armadio: meglio non partire che rispondere 500 a tutto. Vale
    ovunque, in locale (lo stack di `supabase start`) come sul server."""
    mancanti = [nome for nome in VARIABILI_OBBLIGATORIE if not os.environ.get(nome)]
    if mancanti:
        raise SystemExit(
            f"✗ Mancano {', '.join(mancanti)}: l'indirizzo del progetto Supabase e la "
            "sua chiave publishable. In locale li passa `npm run dev` dallo stack di "
            "`supabase start` (o li scrivi in services/api/.env); sul server stanno in "
            "docker-compose.yml."
        )


def main() -> None:
    _controlla_configurazione()
    porta = int(os.environ.get("PORTA", "8787"))
    progetto = os.environ["SUPABASE_URL"]
    print(f"API di Wardrobe in ascolto sulla porta {porta} — Supabase su {progetto}")
    ThreadingHTTPServer(("0.0.0.0", porta), Ponte).serve_forever()


if __name__ == "__main__":
    main()
