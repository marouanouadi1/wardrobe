#!/usr/bin/env python3
"""Banco di prova dei quattro hook di `.claude/hooks/`.

Gli hook sono gli unici gate del progetto che nessuno esercitava: né un test
né un job CI li invocava. «Provati su dieci casi» era vero e inutile allo
stesso tempo, perché quei dieci casi non esistevano come artefatto — e quindi
niente si sarebbe accorto se un hook avesse smesso di negare.

È la regola di `.claude/rules/ci-release.md` rivolta verso chi l'ha scritta:
*una regola che la CI non fa fallire non è una regola.*

Si esegue da solo (`python3 scripts/prova-hook.py`) e da `docs.yml`, che non
ha filtri sui path: questi gate valgono per tutto il repo, non per una
sottocartella.

Due cose che il banco verifica e che sono facili da perdere di vista:

- **la decisione** — allow / deny / ask: la tabella qui sotto è la specifica
  leggibile di cosa ciascun hook impedisce;
- **il canale** — un `deny` senza `permissionDecisionReason` arriva all'agente
  come un rifiuto nudo, e un agente che non sa cosa ha sbagliato può solo
  riprovare alla cieca. Il campo è verificato su ogni diniego.

Le prove sulle migrazioni girano in un albero temporaneo che imita il repo
(`<tmp>/.claude/hooks/`, `<tmp>/services/api/migrations/`), mai dentro
`services/api/migrations/`: un .sql di prova lasciato lì dentro verrebbe
eseguito al prossimo avvio, che è esattamente il guasto che questi hook
esistono per impedire.
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
HOOKS = RADICE / ".claude" / "hooks"

MIGRAZIONE = "migrazione-idempotente.py"
VERSIONI = "versioni-non-a-mano.py"
CONTRATTI = "contratti-allineati.py"
LINT = "lint-immediato.sh"


class Esito:
    def __init__(self, decisione: str, motivo: str, grezzo: str) -> None:
        self.decisione = decisione
        self.motivo = motivo
        self.grezzo = grezzo


def esegui(hook: Path, evento: object, grezzo: str | None = None) -> Esito:
    """Lancia un hook con l'evento su stdin e legge la sua decisione."""
    comando = ["bash", str(hook)] if hook.suffix == ".sh" else [sys.executable, str(hook)]
    ingresso = grezzo if grezzo is not None else json.dumps(evento)
    processo = subprocess.run(comando, input=ingresso, capture_output=True, text=True, timeout=120)
    uscita = processo.stdout.strip()
    if not uscita:
        return Esito("allow", "", processo.stderr)
    dati = json.loads(uscita)
    specifico = dati.get("hookSpecificOutput", {})
    decisione = specifico.get("permissionDecision") or dati.get("decision") or "?"
    motivo = specifico.get("permissionDecisionReason") or dati.get("reason") or ""
    return Esito(decisione, motivo, uscita)


# ── Le migrazioni ────────────────────────────────────────────────────────────
# (nome, sql, atteso). Il path è sempre `0099_prova.sql`, che non esiste su
# main: così la tabella prova l'idempotenza e basta, senza che le regole 5 e 6
# si sovrappongano. Quelle hanno i loro casi in fondo.

MIGRAZIONI = [
    ("create table con if not exists", "create table if not exists capi (id int);", "allow"),
    ("create table, due spazi prima di if", "create table  if not exists capi (id int);", "allow"),
    ("create table, a capo prima di if", "create table\n  if not exists capi (id int);", "allow"),
    ("create table nudo", "create table capi (id int);", "deny"),
    ("create index con if not exists", "create index if not exists i on capi (id);", "allow"),
    ("create index concurrently con if not exists",
     "create index concurrently if not exists i on capi (id);", "allow"),
    ("create index concurrently senza if not exists",
     "create index concurrently i on capi (id);", "deny"),
    ("create index nudo", "create index i on capi (id);", "deny"),
    ("add column con if not exists", "alter table capi add column if not exists n int;", "allow"),
    ("add column nudo", "alter table capi add column n int;", "deny"),
    ("not null con default prima",
     "alter table capi add column if not exists n int default 0 not null;", "allow"),
    ("not null con default dopo",
     "alter table capi add column if not exists n int not null default 0;", "allow"),
    ("not null senza default", "alter table capi add column if not exists n int not null;", "deny"),
    ("not null su tipo con virgola",
     "alter table capi add column if not exists prezzo numeric(10,2) not null;", "deny"),
    ("not null a capo",
     "alter table capi add column if not exists prezzo int\n  not null;", "deny"),
    ("insert con on conflict", "insert into t (id) values (1) on conflict do nothing;", "allow"),
    ("insert nudo", "insert into t (id) values (1);", "deny"),
    ("create type", "create type stato as enum ('a','b');", "deny"),
    ("create type in blocco do/exception",
     "do $$ begin create type stato as enum ('a'); exception when duplicate_object then null; end $$;",
     "allow"),
    ("drop con if exists", "drop table if exists capi;", "ask"),
    ("truncate", "truncate table capi;", "ask"),
    ("SQL dentro un commento di riga",
     "-- create table capi (id int);\ncreate table if not exists capi (id int);", "allow"),
    ("SQL dentro un commento a blocco",
     "/* esempio:\ncreate table capi (id int);\n*/\ncreate table if not exists capi (id int);",
     "allow"),
]


def banco_migrazioni(fallimenti: list[str]) -> None:
    """Albero temporaneo: nessun .sql di prova tocca mai il repo vero."""
    with tempfile.TemporaryDirectory() as tmp:
        finta = Path(tmp)
        (finta / ".claude" / "hooks").mkdir(parents=True)
        migrazioni = finta / "services" / "api" / "migrations"
        migrazioni.mkdir(parents=True)
        hook = finta / ".claude" / "hooks" / MIGRAZIONE
        shutil.copy(HOOKS / MIGRAZIONE, hook)

        for nome, sql, atteso in MIGRAZIONI:
            bersaglio = migrazioni / "0099_prova.sql"
            evento = {"tool_name": "Write",
                      "tool_input": {"file_path": str(bersaglio), "content": sql}}
            verifica(f"migrazione · {nome}", esegui(hook, evento), atteso, fallimenti)

        # Il nome del file, non il suo contenuto.
        evento = {"tool_name": "Write",
                  "tool_input": {"file_path": str(migrazioni / "10_tardi.sql"),
                                 "content": "create table if not exists capi (id int);"}}
        verifica("migrazione · nome senza quattro cifre", esegui(hook, evento), "deny", fallimenti)

        # Il file composto, non il frammento: `add column` sta su disco e
        # `not null` arriva nell'Edit. Separati, nessuno dei due dice niente.
        bersaglio = migrazioni / "0099_prova.sql"
        bersaglio.write_text("alter table capi add column if not exists eta int;\n")
        evento = {"tool_name": "Edit",
                  "tool_input": {"file_path": str(bersaglio),
                                 "old_string": "eta int;", "new_string": "eta int not null;"}}
        verifica("migrazione · Edit che compone un not null", esegui(hook, evento), "deny", fallimenti)

        # Lo stesso Edit, ma innocuo: non deve negare.
        evento = {"tool_name": "Edit",
                  "tool_input": {"file_path": str(bersaglio),
                                 "old_string": "eta int;", "new_string": "eta int default 0;"}}
        verifica("migrazione · Edit innocuo", esegui(hook, evento), "allow", fallimenti)

        # Un percorso relativo va risolto, non confrontato come stringa.
        evento = {"tool_name": "Write",
                  "tool_input": {"file_path": "services/api/migrations/0099_prova.sql",
                                 "content": "create table capi (id int);"}}
        verifica("migrazione · percorso relativo", esegui(hook, evento), "deny", fallimenti)

        # Fuori dalla cartella non si guarda niente.
        evento = {"tool_name": "Write",
                  "tool_input": {"file_path": str(finta / "altrove.sql"),
                                 "content": "create table capi (id int);"}}
        verifica("migrazione · file fuori da migrations/", esegui(hook, evento), "allow", fallimenti)

        # Le sette migrazioni vere, col contenuto che hanno oggi: nessuna deve
        # essere negata. È la difesa contro un pattern nuovo troppo largo.
        for vera in sorted((RADICE / "services" / "api" / "migrations").glob("*.sql")):
            sql = vera.read_text(encoding="utf-8")
            evento = {"tool_name": "Write",
                      "tool_input": {"file_path": str(migrazioni / "0099_prova.sql"),
                                     "content": sql}}
            # 0008 rimuove il playground: i suoi drop devono chiedere, non passare.
            atteso = "ask" if "drop" in sql.lower() else "allow"
            verifica(f"migrazione vera · {vera.name}", esegui(hook, evento), atteso, fallimenti)

        # Evento illeggibile: una guardia che deve impedire non fallisce aperta.
        verifica("migrazione · evento malformato",
                 esegui(hook, None, grezzo="non-json"), "ask", fallimenti)


def banco_regola_5(fallimenti: list[str]) -> None:
    """Un file già su main è già stato applicato: si chiede prima di toccarlo."""
    hook = HOOKS / MIGRAZIONE
    esistente = RADICE / "services" / "api" / "migrations" / "0001_schema.sql"
    if not esistente.exists():
        print("  · saltata: 0001_schema.sql non c'è")
        return
    su_main = None
    for riferimento in ("origin/main", "main"):
        esito = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", riferimento, "--",
             "services/api/migrations/0001_schema.sql"],
            cwd=RADICE, capture_output=True, text=True,
        )
        if esito.returncode == 0:
            su_main = esito
            break
    if su_main is None or not su_main.stdout.strip():
        # In CI il checkout può non avere `main` in locale: si dichiara, non si tace.
        print("  · saltata: `main` non è disponibile in questo checkout")
        return
    evento = {"tool_name": "Edit",
              "tool_input": {"file_path": str(esistente),
                             "old_string": "-- ", "new_string": "-- nota "}}
    verifica("migrazione · file già su main", esegui(hook, evento), "ask", fallimenti)


# ── Le versioni ──────────────────────────────────────────────────────────────

def banco_versioni(fallimenti: list[str]) -> None:
    hook = HOOKS / VERSIONI
    pyproject = RADICE / "services" / "api" / "pyproject.toml"
    appjson = RADICE / "apps" / "mobile" / "app.json"
    pkgjson = RADICE / "apps" / "mobile" / "package.json"

    # Riscrittura integrale a versione identica: è il caso che il docblock
    # dell'hook promette di lasciar passare, e che negava.
    evento = {"tool_name": "Write",
              "tool_input": {"file_path": str(pyproject),
                             "content": pyproject.read_text(encoding="utf-8")}}
    verifica("versioni · Write identico di pyproject.toml", esegui(hook, evento), "allow", fallimenti)

    evento = {"tool_name": "Write",
              "tool_input": {"file_path": str(appjson),
                             "content": appjson.read_text(encoding="utf-8")}}
    verifica("versioni · Write identico di app.json", esegui(hook, evento), "allow", fallimenti)

    evento = {"tool_name": "Write",
              "tool_input": {"file_path": str(pyproject),
                             "content": '[project]\nname = "x"\nversion = "9.9.9"\n'}}
    verifica("versioni · Write che alza pyproject.toml", esegui(hook, evento), "deny", fallimenti)

    # TOML accetta anche gli apici singoli.
    evento = {"tool_name": "Write",
              "tool_input": {"file_path": str(pyproject),
                             "content": "[project]\nname = 'x'\nversion = '9.9.9'\n"}}
    verifica("versioni · apici singoli in TOML", esegui(hook, evento), "deny", fallimenti)

    evento = {"tool_name": "Edit",
              "tool_input": {"file_path": str(appjson),
                             "old_string": '"version": "0.6.1"',
                             "new_string": '"version": "0.6.2"'}}
    verifica("versioni · Edit che alza app.json", esegui(hook, evento), "deny", fallimenti)

    # Il terzo file che bump-versione.mjs scrive.
    evento = {"tool_name": "Edit",
              "tool_input": {"file_path": str(pkgjson),
                             "old_string": '"version": "1.0.0"',
                             "new_string": '"version": "9.9.9"'}}
    verifica("versioni · Edit che alza apps/mobile/package.json",
             esegui(hook, evento), "deny", fallimenti)

    # Toccare le dipendenze resta libero.
    evento = {"tool_name": "Edit",
              "tool_input": {"file_path": str(pyproject),
                             "old_string": 'dependencies = [', "new_string": 'dependencies = ['}}
    verifica("versioni · Edit che non nomina versioni", esegui(hook, evento), "allow", fallimenti)

    evento = {"tool_name": "Write",
              "tool_input": {"file_path": str(RADICE / "README.md"),
                             "content": '"version": "9.9.9"'}}
    verifica("versioni · file non sorvegliato", esegui(hook, evento), "allow", fallimenti)

    verifica("versioni · evento malformato",
             esegui(hook, None, grezzo="non-json"), "ask", fallimenti)


# ── Lo Stop sui contratti, e il PostToolUse sul lint ─────────────────────────

def banco_stop(fallimenti: list[str]) -> None:
    hook = HOOKS / CONTRATTI
    # `stop_hook_active` evita il ciclo infinito: si esce senza bloccare.
    verifica("contratti · rientro (stop_hook_active)",
             esegui(hook, {"stop_hook_active": True}), "allow", fallimenti)


def banco_lint(fallimenti: list[str]) -> None:
    hook = HOOKS / LINT
    verifica("lint · file fuori ambito",
             esegui(hook, {"tool_input": {"file_path": "/tmp/x.py"}}), "allow", fallimenti)

    if shutil.which("uv") is None:
        print("  · saltata la prova su ruff: `uv` non è installato")
        return
    sonda = RADICE / "services" / "api" / "src" / "domain" / "_prova_hook.py"
    try:
        sonda.write_text("import sys\n")  # F401: import non usato
        esito = esegui(hook, {"tool_input": {"file_path": str(sonda)}})
        verifica("lint · ruff sporco arriva al modello", esito, "block", fallimenti)
        if esito.decisione == "block" and "F401" not in esito.motivo:
            fallimenti.append("lint · il motivo non contiene il codice di ruff (F401)")
    finally:
        sonda.unlink(missing_ok=True)


# ── L'esecuzione ─────────────────────────────────────────────────────────────

def verifica(nome: str, esito: Esito, atteso: str, fallimenti: list[str]) -> None:
    ok = esito.decisione == atteso
    if ok and atteso in ("deny", "ask", "block") and not esito.motivo.strip():
        fallimenti.append(f"{nome}: {atteso} senza motivo — l'agente non saprebbe cosa correggere")
        print(f"  ✗ {nome}: {atteso} senza motivo")
        return
    print(f"  {'✓' if ok else '✗'} {nome}: {esito.decisione} (atteso {atteso})")
    if not ok:
        fallimenti.append(f"{nome}: ha risposto {esito.decisione}, atteso {atteso}")


def main() -> int:
    fallimenti: list[str] = []
    for titolo, banco in (
        ("migrazione-idempotente.py", banco_migrazioni),
        ("migrazione-idempotente.py · regola 5", banco_regola_5),
        ("versioni-non-a-mano.py", banco_versioni),
        ("contratti-allineati.py", banco_stop),
        ("lint-immediato.sh", banco_lint),
    ):
        print(f"\n{titolo}")
        banco(fallimenti)

    print()
    if fallimenti:
        for f in fallimenti:
            print(f"::error::hook: {f}")
        print(f"\n{len(fallimenti)} prove fallite.")
        return 1
    print("Tutti gli hook si comportano come dichiarato.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
