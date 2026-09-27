"""La presa di possesso di un'email invitata, rifatta **passando da GoTrue**.

Un gate del job `database` (`.github/workflows/database.yml`), solo contro lo stack
locale. Il trigger `privato.password_solo_dopo_la_prova` regge perché GoTrue, alla
conferma, scrive `email_confirmed_at` mentre il `confirmation_token` c'è ancora, e
perché all'import conferma prima di scrivere la password. È un ordine interno di
GoTrue, non un contratto: il test pgTAP, che simula l'aggiornamento in SQL,
resterebbe verde se cambiasse. Questo no — chiama l'Auth vera, e legge i codici da
Mailpit, come farebbe il titolare.

Quattro casi, e in ognuno la password si prova **prima** di qualunque `updateUser`:

1. l'estraneo registra un'email invitata con una password sua; il titolare chiede un
   codice d'accesso e lo verifica → la password dell'estraneo non vale più;
2. lo stesso, con il codice di recupero;
3. l'amministratore conferma l'account in attesa dell'estraneo → idem;
4. un account importato già confermato, con la sua password → entra.

Le chiavi dello stack locale restano in memoria e non si stampano.
"""

from __future__ import annotations

import re
import secrets
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import psycopg

RADICE = Path(__file__).resolve().parents[3]
MAILPIT = "http://127.0.0.1:54324"


def _stato() -> dict[str, str]:
    grezzo = subprocess.run(
        ["supabase", "status", "-o", "env"], capture_output=True, text=True, cwd=RADICE, check=True
    ).stdout
    return {
        chiave: valore.strip().strip('"')
        for chiave, _, valore in (riga.partition("=") for riga in grezzo.splitlines())
        if valore
    }


class Auth:
    def __init__(self, stato: dict[str, str]) -> None:
        self.url = stato["API_URL"]
        if not self.url.startswith("http://127.0.0.1:"):
            raise SystemExit("prova_accesso gira solo contro lo stack locale")
        self.pubblica = stato.get("PUBLISHABLE_KEY") or stato["ANON_KEY"]
        self.servizio = stato["SERVICE_ROLE_KEY"]
        self.http = httpx.Client(timeout=20)

    def chiedi(
        self, percorso: str, corpo: dict[str, Any], *, admin: bool = False, metodo: str = "POST"
    ) -> httpx.Response:
        chiave = self.servizio if admin else self.pubblica
        return self.http.request(
            metodo,
            f"{self.url}/auth/v1{percorso}",
            json=corpo,
            headers={"apikey": chiave, "authorization": f"Bearer {chiave}"},
        )

    def entra(self, email: str, password: str) -> int:
        return self.chiedi(
            "/token?grant_type=password", {"email": email, "password": password}
        ).status_code


def codice_per(http: httpx.Client, email: str) -> str:
    """L'ultimo codice arrivato a `email` su Mailpit, poi cancellato."""
    for _ in range(40):
        trovati = http.get(f"{MAILPIT}/api/v1/search", params={"query": f"to:{email}"}).json()
        messaggi = trovati.get("messages") or []
        if messaggi:
            dettaglio = http.get(f"{MAILPIT}/api/v1/message/{messaggi[0]['ID']}").json()
            http.request(
                "DELETE", f"{MAILPIT}/api/v1/messages", json={"IDs": [m["ID"] for m in messaggi]}
            )
            cifre = re.search(
                r"\b(\d{6,10})\b", dettaglio.get("Text") or dettaglio.get("HTML") or ""
            )
            if cifre:
                return cifre.group(1)
        time.sleep(0.3)
    raise SystemExit(f"nessun codice arrivato a {email}")


def main() -> int:
    stato = _stato()
    auth = Auth(stato)
    sigla = secrets.token_hex(3)
    email = {
        caso: f"presa-{caso}-{sigla}@esempio.invalid"
        for caso in ("otp", "recupero", "admin", "import")
    }
    esiti: list[tuple[bool, str]] = []

    def controlla(ok: bool, cosa: str) -> None:
        esiti.append((ok, cosa))
        print(("  ok  " if ok else "  NO  ") + cosa)

    with psycopg.connect(stato["DB_URL"], autocommit=True) as db:
        for indirizzo in email.values():
            db.execute(
                "insert into privato.inviti (email) values (%s) on conflict do nothing",
                (indirizzo,),
            )

    try:
        # L'estraneo, sui primi tre indirizzi: una password sua, prima di qualunque prova.
        for caso in ("otp", "recupero", "admin"):
            r = auth.chiedi("/signup", {"email": email[caso], "password": "password-dell-estraneo"})
            controlla(
                r.status_code == 200,
                f"{caso}: l'estraneo registra con una password sua ({r.status_code})",
            )
            codice_per(auth.http, email[caso])  # la conferma arriva al titolare: la si butta
        time.sleep(1.5)  # `max_frequency`: il titolare arriva dopo

        # 1. Il titolare, con il codice d'accesso.
        auth.chiedi("/otp", {"email": email["otp"], "create_user": True})
        r = auth.chiedi(
            "/verify",
            {"type": "email", "email": email["otp"], "token": codice_per(auth.http, email["otp"])},
        )
        controlla(r.status_code == 200, f"otp: il titolare entra col codice ({r.status_code})")
        stato_http = auth.entra(email["otp"], "password-dell-estraneo")
        controlla(stato_http == 400, f"otp: la password dell'estraneo non vale più ({stato_http})")

        # 2. Il titolare, con il recupero.
        auth.chiedi("/recover", {"email": email["recupero"]})
        r = auth.chiedi(
            "/verify",
            {
                "type": "recovery",
                "email": email["recupero"],
                "token": codice_per(auth.http, email["recupero"]),
            },
        )
        controlla(r.status_code == 200, f"recupero: il titolare entra col codice ({r.status_code})")
        stato_http = auth.entra(email["recupero"], "password-dell-estraneo")
        controlla(
            stato_http == 400, f"recupero: la password dell'estraneo non vale più ({stato_http})"
        )

        # 3. L'amministratore conferma l'account in attesa.
        with psycopg.connect(stato["DB_URL"]) as db:
            riga = db.execute(
                "select id from auth.users where email = %s", (email["admin"],)
            ).fetchone()
        assert riga is not None
        r = auth.chiedi(
            f"/admin/users/{riga[0]}", {"email_confirm": True}, admin=True, metodo="PUT"
        )
        controlla(r.status_code == 200, f"admin: conferma dell'amministratore ({r.status_code})")
        stato_http = auth.entra(email["admin"], "password-dell-estraneo")
        controlla(
            stato_http == 400, f"admin: la password dell'estraneo non vale più ({stato_http})"
        )

        # 4. Un account importato, già confermato, con la sua password.
        r = auth.chiedi(
            "/admin/users",
            {"email": email["import"], "password": "password-importata", "email_confirm": True},
            admin=True,
        )
        controlla(r.status_code == 200, f"import: creato già confermato ({r.status_code})")
        stato_http = auth.entra(email["import"], "password-importata")
        controlla(stato_http == 200, f"import: entra con la sua password ({stato_http})")
    finally:
        with psycopg.connect(stato["DB_URL"], autocommit=True) as db:
            db.execute("delete from auth.users where email = any(%s)", (list(email.values()),))
            db.execute("delete from privato.inviti where email = any(%s)", (list(email.values()),))

    falliti = [cosa for ok, cosa in esiti if not ok]
    print(f"\n{len(esiti) - len(falliti)}/{len(esiti)} verifiche passate")
    return 1 if falliti else 0


if __name__ == "__main__":
    sys.exit(main())
