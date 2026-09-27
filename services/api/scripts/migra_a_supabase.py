"""Fase 4 di ADR 0010: un account del Postgres del VPS, portato su Supabase.

Si lancia **dal computer locale**, mai dal VPS, per un'email alla volta:

    uv run python scripts/migra_a_supabase.py --verso locale --email <email>   # la prova
    uv run python scripts/migra_a_supabase.py --verso vero --email <email>     # sul serio

**Legge il VPS in sola lettura**: una query con `ssh … docker exec … psql`, e le foto
con un `tar` dal volume. Non scrive niente lassù: il Postgres e le foto restano
com'erano, come copia di riserva.

**Scrive su Supabase con la chiave di servizio**, l'unico punto del progetto che la
usa. La prende al momento, in memoria — dallo stack locale (`supabase status`) o dal
progetto vero (`supabase projects api-keys`, con la CLI già collegata) — e non la
salva né la stampa.

**Ripetibile**: l'account si crea con lo stesso id e lo stesso hash della password (chi
entrava con la sua password entra ancora), e le righe si scrivono con un upsert. Una
seconda esecuzione riscrive le stesse righe. Un'email che su Supabase esiste già **con
un altro id** ferma tutto: non si passa sopra a un account che non è questo.

Cosa cambia fra prima e dopo:
- gli id di 32 cifre esadecimali diventano uuid con i trattini, gli stessi valori; gli
  id che non lo sono (le conversazioni `storica-…`) diventano un uuid derivato dal
  vecchio, sempre lo stesso;
- le foto passano da `capi/{utente}/…` a `{utente}/capi/…`: il primo segmento è
  l'utente, come vogliono le policy dello Storage;
- i capi passano dai modelli Pydantic e da `riga_da_capo` del backend, la stessa forma
  che scrive l'analisi.
"""

from __future__ import annotations

import argparse
import io
import json
import secrets
import subprocess
import sys
import tarfile
import uuid
from pathlib import Path
from typing import Any

import httpx
import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from adapters.supabase import riga_da_capo
from domain.models import Capo, EsitoAnalisi, MessaggioChat, Profilo, Segnalazione

RADICE = Path(__file__).resolve().parents[3]
VPS = "marouan@89.167.15.22"
PROGETTO_VERO = "lmjsrhwzjxubecgctrmd"
SPAZIO = uuid.UUID("6f1d3a0e-5c2b-4b8e-9d7a-0a5e2c3b4d10")  # per gli id che non erano uuid


def uuid_di(vecchio: str) -> str:
    """Lo stesso id in forma uuid, se lo era già in esadecimale; se no uno derivato, stabile."""
    try:
        return str(uuid.UUID(vecchio))
    except ValueError:
        return str(uuid.uuid5(SPAZIO, vecchio))


def percorso_nuovo(vecchio: str | None) -> str | None:
    """`capi/{utente}/{giorno}/{nome}` → `{utente}/capi/{giorno}/{nome}`."""
    if not vecchio:
        return None
    radice, utente, resto = vecchio.split("/", 2)
    if radice != "capi":
        raise SystemExit(f"percorso inatteso: {vecchio}")
    return f"{utente}/capi/{resto}"


# ── la sorgente: il VPS, in sola lettura ────────────────────────────────────


def leggi_dal_vps(email: str) -> dict[str, Any]:
    sql = f"""
      with u as (
        select id::text as id, email, hash_password, creato_il
          from utenti where email = {quota(email)}
      )
      select json_build_object(
        'utente', (select row_to_json(u) from u),
        'profilo', (select p.dati from profili p, u where p.id = u.id),
        'capi', (select coalesce(json_agg(c.dati), '[]') from capi c, u where c.utente_id = u.id),
        'usi', (
          select coalesce(json_agg(json_build_object(
                   'capo_id', s.capo_id, 'giorno', s.giorno)), '[]')
            from usi s, u where s.utente_id = u.id),
        'conversazioni', (
          select coalesce(json_agg(json_build_object(
                   'id', k.id, 'titolo', k.titolo, 'creata_il', k.creata_il,
                   'ultimo_turno_il', k.ultimo_turno_il)), '[]')
            from conversazioni_chat k, u where k.utente_id = u.id),
        'messaggi', (
          select coalesce(json_agg(json_build_object(
                   'conversazione_id', m.conversazione_id, 'dati', m.dati)), '[]')
            from messaggi_chat m, u where m.utente_id = u.id),
        'segnalazioni', (
          select coalesce(json_agg(g.dati), '[]') from segnalazioni g, u where g.utente_id = u.id),
        'esiti', (
          select coalesce(json_agg(json_build_object(
                   'creato_il', e.creato_il, 'dati', e.dati)), '[]')
            from analisi_esiti e
           where e.dati->'capo'->>'id' in (
             select c.id from capi c, u where c.utente_id = u.id))
      )
    """
    uscita = subprocess.run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            VPS,
            "docker exec -i wardrobe-postgres psql -U wardrobe -d wardrobe -At -v ON_ERROR_STOP=1",
        ],
        input=sql,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    dati: dict[str, Any] = json.loads(uscita)
    if not dati["utente"]:
        raise SystemExit(f"nessun account {email} sul VPS")
    return dati


def quota(testo: str) -> str:
    return "'" + testo.replace("'", "''") + "'"


def foto_dal_vps(utente_id: str) -> dict[str, bytes]:
    """Le foto della cartella dell'utente, dal volume: percorso vecchio → byte."""
    grezzo = subprocess.run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            VPS,
            f"docker run --rm -v wardrobe_foto_dati:/f alpine tar -C /f -cf - capi/{utente_id}",
        ],
        capture_output=True,
        check=True,
    ).stdout
    foto: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(grezzo)) as archivio:
        for voce in archivio.getmembers():
            # Il vecchio archivio su disco teneva accanto a ogni foto un file con il
            # suo tipo (`….contenttype`): lo Storage il tipo lo tiene da sé.
            if voce.isfile() and not voce.name.endswith(".contenttype"):
                contenuto = archivio.extractfile(voce)
                assert contenuto is not None
                foto[voce.name] = contenuto.read()
    return foto


def tipo_immagine(byte: bytes) -> str:
    if byte.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if byte.startswith(b"\x89PNG"):
        return "image/png"
    if byte[:4] == b"RIFF" and byte[8:12] == b"WEBP":
        return "image/webp"
    if byte[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1"):
        return "image/heic"
    raise SystemExit("una foto non è un'immagine che il bucket accetta")


# ── la destinazione: Supabase ───────────────────────────────────────────────
#
# Due strade, e non per gusto. L'account e le foto passano dall'API di Auth e dello
# Storage con la chiave di servizio. **Le righe no**: con l'«esposizione automatica»
# spenta, `service_role` non ha permessi sulle tabelle di `public`, ed è una difesa da
# tenere — una chiave di servizio rubata non legge gli armadi dall'API. Le righe si
# scrivono in SQL come `postgres`: in locale con la connessione dello stack, sul
# progetto vero con l'API di gestione di Supabase e il token della CLI già collegata.


def _stato_locale() -> dict[str, str]:
    grezzo = subprocess.run(
        ["supabase", "status", "-o", "env"], capture_output=True, text=True, cwd=RADICE, check=True
    ).stdout
    righe = (r.partition("=") for r in grezzo.splitlines())
    stato = {k: v.strip().strip('"') for k, _, v in righe if v}
    if not stato["API_URL"].startswith("http://127.0.0.1:"):
        raise SystemExit("lo stack locale non risponde su 127.0.0.1")
    return stato


class Sql:
    """Una query come `postgres`, e le righe che restituisce."""

    def __init__(self, verso: str) -> None:
        self.verso = verso
        self.dsn = _stato_locale()["DB_URL"] if verso == "locale" else ""
        token = "" if verso == "locale" else (Path.home() / ".supabase" / "access-token")
        self.http = httpx.Client(
            timeout=120,
            headers={"authorization": f"Bearer {token.read_text().strip()}"} if token else {},
        )

    def esegui(self, query: str) -> list[dict[str, Any]]:
        if self.verso == "locale":
            with psycopg.connect(self.dsn, autocommit=True) as db, db.cursor() as cursore:
                cursore.execute(query.encode())
                if cursore.description is None:
                    return []
                nomi = [c.name for c in cursore.description]
                return [dict(zip(nomi, riga, strict=True)) for riga in cursore.fetchall()]
        risposta = self.http.post(
            f"https://api.supabase.com/v1/projects/{PROGETTO_VERO}/database/query",
            json={"query": query},
        )
        if not risposta.is_success:
            raise SystemExit(f"query: {risposta.status_code} {risposta.text[:300]}")
        righe: list[dict[str, Any]] = risposta.json()
        return righe

    def inserisci(self, tabella: str, righe: list[dict[str, Any]], conflitto: str) -> None:
        """Tutte le righe in un'istruzione, da un documento JSON fra dollar-quote."""
        if not righe:
            return
        colonne = ", ".join(sorted(set().union(*righe)))
        documento = json.dumps(righe, ensure_ascii=False)
        segno = "j" + secrets.token_hex(8)
        assert f"${segno}$" not in documento
        self.esegui(
            f"insert into public.{tabella} ({colonne}) select {colonne} "
            f"from json_populate_recordset(null::public.{tabella}, ${segno}${documento}${segno}$) "
            f"on conflict {conflitto}"
        )

    def conta(self, tabella: str, utente: str) -> int:
        riga = self.esegui(
            f"select count(*)::int as n from public.{tabella} where utente_id = {quota(utente)}"
        )
        return int(riga[0]["n"])


def destinazione(verso: str) -> tuple[str, str]:
    """L'indirizzo del progetto e la chiave di servizio, in memoria."""
    if verso == "locale":
        stato = _stato_locale()
        return stato["API_URL"], stato["SERVICE_ROLE_KEY"]
    chiavi = json.loads(
        subprocess.run(
            ["supabase", "projects", "api-keys", "--project-ref", PROGETTO_VERO, "-o", "json"],
            capture_output=True,
            text=True,
            cwd=RADICE,
            check=True,
        ).stdout
    )
    servizio = next(c["api_key"] for c in chiavi if c.get("name") == "service_role")
    return f"https://{PROGETTO_VERO}.supabase.co", servizio


class Supabase:
    """Auth e Storage, con la chiave di servizio."""

    def __init__(self, url: str, chiave: str) -> None:
        self.url = url
        self.http = httpx.Client(
            timeout=60, headers={"apikey": chiave, "authorization": f"Bearer {chiave}"}
        )

    def controlla(self, risposta: httpx.Response, cosa: str) -> httpx.Response:
        if not risposta.is_success:
            raise SystemExit(f"{cosa}: {risposta.status_code} {risposta.text[:300]}")
        return risposta


def crea_utente(sb: Supabase, utente: dict[str, Any]) -> None:
    """Lo stesso id, lo stesso hash: la password di prima vale ancora."""
    esistente = sb.http.get(f"{sb.url}/auth/v1/admin/users/{utente['id']}")
    if esistente.status_code == 200:
        if esistente.json().get("email") != utente["email"]:
            raise SystemExit("l'id esiste già su Supabase con un'altra email")
        print("  l'account c'è già, con lo stesso id: si riscrivono solo i dati")
        return
    risposta = sb.http.post(
        f"{sb.url}/auth/v1/admin/users",
        json={
            "id": utente["id"],
            "email": utente["email"],
            "password_hash": utente["hash_password"],
            "email_confirm": True,
        },
    )
    if risposta.status_code == 422 and "email" in risposta.text.lower():
        raise SystemExit(f"{utente['email']} esiste già su Supabase con un altro id: mi fermo")
    sb.controlla(risposta, "creazione dell'account")


# ── la traduzione ───────────────────────────────────────────────────────────


def righe_capi(dati: list[dict[str, Any]], utente: str) -> list[dict[str, Any]]:
    righe = []
    for grezzo in dati:
        capo = Capo.model_validate(grezzo)
        riga = riga_da_capo(capo)
        riga["id"] = uuid_di(capo.id)
        riga["utente_id"] = utente
        riga["foto_percorso"] = percorso_nuovo(capo.foto.chiave)
        riga["foto_scontornata_percorso"] = percorso_nuovo(capo.foto.chiave_scontornata)
        righe.append(riga)
    return righe


def vestizione_nuova(vestizione: dict[str, Any]) -> dict[str, Any]:
    return {slot: uuid_di(capo) if capo else None for slot, capo in vestizione.items()}


def migra(email: str, verso: str) -> int:
    print(f"— lettura dal VPS: {email}")
    dati = leggi_dal_vps(email)
    utente = dati["utente"]["id"]
    foto = foto_dal_vps(utente)
    quanti = ", ".join(
        f"{len(dati[voce])} {voce}"
        for voce in ("capi", "usi", "conversazioni", "messaggi", "segnalazioni", "esiti")
    )
    print(f"  {quanti}, {len(foto)} foto")

    url, chiave = destinazione(verso)
    sb = Supabase(url, chiave)
    sql = Sql(verso)
    print(f"— scrittura su Supabase ({verso})")
    crea_utente(sb, dati["utente"])

    # Le foto prima delle righe: una riga di `capi` con un percorso che non c'è
    # sarebbe un capo senza foto.
    for vecchio, byte in sorted(foto.items()):
        nuovo = percorso_nuovo(vecchio)
        sb.controlla(
            sb.http.post(
                f"{url}/storage/v1/object/foto/{nuovo}",
                content=byte,
                headers={"content-type": tipo_immagine(byte), "x-upsert": "true"},
            ),
            f"caricamento di {nuovo}",
        )

    profilo = Profilo.model_validate(dati["profilo"]) if dati["profilo"] else None
    if profilo:
        sql.inserisci(
            "profili",
            [
                {
                    "id": utente,
                    "nome": profilo.nome,
                    "citta": profilo.citta,
                    "stili": profilo.preferenze.stili,
                    "palette": profilo.preferenze.palette,
                    "evita": profilo.preferenze.evita,
                    "avatar_foto_percorso": percorso_nuovo(profilo.avatar_foto_chiave),
                    "creato_il": profilo.creato_il.isoformat(),
                }
            ],
            "(id) do update set nome = excluded.nome, citta = excluded.citta, "
            "stili = excluded.stili, palette = excluded.palette, evita = excluded.evita, "
            "avatar_foto_percorso = excluded.avatar_foto_percorso, creato_il = excluded.creato_il",
        )

    sql.inserisci("capi", righe_capi(dati["capi"], utente), "(id) do nothing")
    sql.inserisci(
        "usi",
        [
            {"utente_id": utente, "capo_id": uuid_di(u["capo_id"]), "giorno": u["giorno"]}
            for u in dati["usi"]
        ],
        "do nothing",
    )
    sql.inserisci(
        "conversazioni_chat",
        [
            {
                "id": uuid_di(c["id"]),
                "utente_id": utente,
                "titolo": c["titolo"],
                "creata_il": c["creata_il"],
                "ultimo_turno_il": c["ultimo_turno_il"],
            }
            for c in dati["conversazioni"]
        ],
        "(id) do nothing",
    )
    messaggi = []
    for voce in dati["messaggi"]:
        messaggio = MessaggioChat.model_validate(voce["dati"])
        grezzo = messaggio.model_dump(mode="json")
        messaggi.append(
            {
                "id": uuid_di(messaggio.id),
                "utente_id": utente,
                "conversazione_id": uuid_di(voce["conversazione_id"]),
                "ruolo": grezzo["ruolo"],
                "testo": grezzo["testo"],
                "suggerimenti": [
                    {**s, "vestizione": vestizione_nuova(s["vestizione"])}
                    for s in grezzo["suggerimenti"]
                ],
                "creato_il": grezzo["creato_il"],
            }
        )
    sql.inserisci("messaggi_chat", messaggi, "(id) do nothing")
    sql.inserisci(
        "segnalazioni",
        [
            {
                "id": uuid_di(s.id),
                "utente_id": utente,
                "testo": s.testo,
                "stato": s.stato.value,
                "creata_il": s.creata_il.isoformat(),
                "aggiornata_il": s.aggiornata_il.isoformat(),
            }
            for s in (Segnalazione.model_validate(g) for g in dati["segnalazioni"])
        ],
        "(id) do nothing",
    )
    sql.inserisci(
        "analisi_esiti",
        [
            {
                "id": uuid_di(esito.esecuzione_id),
                "utente_id": utente,
                "stato": esito.stato.value,
                "capo_id": uuid_di(esito.capo.id) if esito.capo else None,
                "errore": esito.errore,
                "creato_il": voce["creato_il"],
            }
            for voce, esito in ((v, EsitoAnalisi.model_validate(v["dati"])) for v in dati["esiti"])
        ],
        "(id) do nothing",
    )

    print("— conteggi, prima e dopo")
    attesi = {
        "capi": len(dati["capi"]),
        "usi": len(dati["usi"]),
        "conversazioni_chat": len(dati["conversazioni"]),
        "messaggi_chat": len(dati["messaggi"]),
        "segnalazioni": len(dati["segnalazioni"]),
        "analisi_esiti": len(dati["esiti"]),
    }
    falliti = 0
    for tabella, atteso in attesi.items():
        trovato = sql.conta(tabella, utente)
        esito = "ok" if trovato == atteso else "NO"
        falliti += esito == "NO"
        print(f"  {esito}  {tabella}: VPS {atteso}, Supabase {trovato}")
    elenco = sb.controlla(
        sb.http.post(
            f"{url}/storage/v1/object/list/foto", json={"prefix": f"{utente}/capi", "limit": 1000}
        ),
        "elenco delle foto",
    ).json()
    cartelle = [v["name"] for v in elenco if v.get("id") is None]
    caricate = 0
    for cartella in cartelle:
        caricate += len(
            sb.controlla(
                sb.http.post(
                    f"{url}/storage/v1/object/list/foto",
                    json={"prefix": f"{utente}/capi/{cartella}", "limit": 1000},
                ),
                "elenco delle foto",
            ).json()
        )
    esito = "ok" if caricate == len(foto) else "NO"
    falliti += esito == "NO"
    print(f"  {esito}  foto: VPS {len(foto)}, Supabase {caricate}")
    return 1 if falliti else 0


def main() -> int:
    argomenti = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    argomenti.add_argument("--verso", choices=["locale", "vero"], required=True)
    argomenti.add_argument("--email", required=True)
    scelte = argomenti.parse_args()
    return migra(scelte.email.strip().lower(), scelte.verso)


if __name__ == "__main__":
    sys.exit(main())
