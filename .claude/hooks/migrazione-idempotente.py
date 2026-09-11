#!/usr/bin/env python3
"""Nega una migrazione che non regge a essere rieseguita.

`services/api/scripts/applica_migrazioni.py` esegue *tutti* i file .sql in
ordine lessicografico *a ogni avvio*, senza tabella di versione e senza
rollback. Regge solo perché ogni file è idempotente per costruzione.

Conseguenza: una migrazione non idempotente non rompe un deploy — rompe ogni
avvio successivo, finché qualcuno non entra sul server.

PreToolUse: qui bisogna impedire, non segnalare.

Tre cose che questo file ha imparato a sue spese, e che il banco di prova in
`scripts/prova-hook.py` tiene ferme:

1. **Gli spazi si normalizzano prima di guardare.** `keyword\\s+(?!...)` fa
   backtracking: con due spazi `\\s+` ne cede uno al lookahead, che vede
   « if not exists» e passa. Una migrazione corretta veniva negata. La causa
   non è il singolo pattern — è che i pattern presumono uno spazio solo.
2. **Il `not null` si guarda per istruzione, non con un lookahead.**
   `(?![\\s\\S]{0,80}?default)` cerca solo *dopo* `not null`, quindi negava
   `... int default 0 not null` (legale); e il segnaposto del tipo non aveva la
   virgola, quindi lasciava passare `numeric(10,2) not null` (rotto).
3. **Si ispeziona il file composto, non il frammento.** Su una `Edit` arriva
   solo `new_string`: `add column` e `not null` finivano in due frammenti
   diversi e nessuno dei due faceva scattare niente. Scrivere una migrazione a
   piccoli passi è la strada normale, ed era quella che evadeva il gate.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]
MIGRAZIONI = RADICE / "services" / "api" / "migrations"

# I pattern girano su testo a spazi singoli (vedi `normalizza`), quindi qui uno
# spazio è uno spazio: niente `\s+`, e niente backtracking che lo vanifichi.
CONTROLLI = [
    (r"create table (?!if not exists)",
     "`create table` senza `if not exists`"),
    # `concurrently` viene *prima* di `if not exists`, non al suo posto: era un
    # ramo del lookahead, e quindi esentava ogni `create index concurrently`.
    (r"create (unique )?index (concurrently )?(?!if not exists|concurrently)",
     "`create index` senza `if not exists`"),
    (r"alter table \w+ add column (?!if not exists)",
     "`add column` senza `if not exists`"),
    (r"insert into (?:(?!on conflict)[^;])*;",
     "`insert into` senza `on conflict do nothing`"),
    # `create type` non ha un `if not exists` in Postgres: l'idempotenza si
    # ottiene con un blocco `do $$ ... exception when duplicate_object ... $$`.
    (r"create type (?!.*exception)",
     "`create type` non supporta `if not exists`: serve un blocco "
     "`do $$ ... exception when duplicate_object then null; ... $$`"),
    (r"add constraint (?!.*exception)",
     "`add constraint` non supporta `if not exists`: o `drop constraint if "
     "exists` prima, o un blocco `do $$ ... exception ... $$`"),
    (r"create trigger ",
     "`create trigger` non è ripetibile: serve `create or replace trigger` "
     "(Postgres 14+) o un `drop trigger if exists` prima"),
]

DISTRUTTIVI = re.compile(r"\b(drop (table|column|index|type|constraint)|truncate)\b")


def rispondi(decisione: str, motivo: str) -> None:
    """L'unica uscita dell'hook.

    `permissionDecisionReason` è il campo che torna **al modello**;
    `systemMessage` è un avviso all'utente. Scrivendo solo il secondo, ogni
    diniego arrivava all'agente come un rifiuto nudo — senza sapere cosa
    aveva sbagliato, poteva solo riprovare alla cieca.
    """
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decisione,
            "permissionDecisionReason": motivo,
        },
        "systemMessage": motivo,
    }))
    sys.exit(0)


def normalizza(sql: str) -> str:
    """Via i commenti e gli spazi di troppo: i pattern vedono testo regolare."""
    sql = re.sub(r"/\*[\s\S]*?\*/", " ", sql)  # blocco: /* ... */
    sql = re.sub(r"--[^\n]*", " ", sql)        # riga: -- ...
    return re.sub(r"\s+", " ", sql).strip().lower()


def testo_composto(ingresso: dict, percorso: Path) -> str:
    """Il file come sarà *dopo* la scrittura, non il frammento che arriva.

    Una `Write` porta tutto in `content`. Una `Edit` porta solo la stringa
    nuova: per vedere `add column ... not null` bisogna ricomporre il file.
    """
    contenuto = ingresso.get("content")
    if contenuto is not None:
        return str(contenuto)

    try:
        sorgente = percorso.read_text(encoding="utf-8")
    except OSError:
        sorgente = ""  # file nuovo: c'è solo quello che sta per essere scritto

    modifiche = ingresso.get("edits")
    if isinstance(modifiche, list) and modifiche:
        for modifica in modifiche:
            vecchio = str(modifica.get("old_string") or "")
            nuovo = str(modifica.get("new_string") or "")
            sorgente = sorgente.replace(vecchio, nuovo, 1) if vecchio else sorgente + nuovo
        return sorgente

    vecchio = str(ingresso.get("old_string") or "")
    nuovo = str(ingresso.get("new_string") or "")
    if not sorgente:
        return nuovo
    return sorgente.replace(vecchio, nuovo, 1) if vecchio else sorgente + nuovo


def not_null_senza_default(sql: str) -> bool:
    """Per istruzione, non per lookahead.

    `add column ... not null` senza `default` fallisce su una tabella che ha
    già righe — e senza tabella di versione quel fallimento si ripete a ogni
    avvio. L'ordine delle clausole non conta: `default` prima o dopo
    `not null` è lo stesso SQL.
    """
    for istruzione in sql.split(";"):
        if "add column" in istruzione and "not null" in istruzione and "default" not in istruzione:
            return True
    return False


def gia_su_main(percorso: Path) -> bool:
    """Regola 5: un file già applicato è storia, non codice.

    `main` è il proxy di «già applicato»: in questo repo un merge su main è un
    rilascio (`.claude/rules/ci-release.md`). Si prova prima `origin/main`,
    perché un checkout di CI ha il remoto ma spesso non il branch locale.
    """
    try:
        relativo = percorso.relative_to(RADICE)
    except ValueError:
        return False
    for riferimento in ("origin/main", "main"):
        try:
            esito = subprocess.run(
                ["git", "ls-tree", "-r", "--name-only", riferimento, "--", str(relativo)],
                cwd=RADICE, capture_output=True, text=True, timeout=5,
            )
        except (subprocess.TimeoutExpired, OSError):
            return False
        if esito.returncode == 0:
            return bool(esito.stdout.strip())
    return False


def main() -> None:
    try:
        evento = json.load(sys.stdin)
        ingresso = evento.get("tool_input", {})
        percorso_grezzo = str(ingresso.get("file_path", ""))
    except Exception:
        # Una guardia che deve *impedire* non può fallire aperta: «non ho
        # capito l'evento» vale `ask`, mai `allow`.
        rispondi("ask", "L'hook sulle migrazioni non ha capito l'evento: "
                        "controlla a mano che la migrazione sia ripetibile "
                        "(.claude/rules/migrazioni.md).")
        return

    if not percorso_grezzo:
        return
    percorso = Path(percorso_grezzo)
    if not percorso.is_absolute():
        percorso = RADICE / percorso
    percorso = percorso.resolve()
    if MIGRAZIONI not in percorso.parents or percorso.suffix != ".sql":
        return

    sql = normalizza(testo_composto(ingresso, percorso))

    problemi = [d for pattern, d in CONTROLLI if re.search(pattern, sql)]
    if not_null_senza_default(sql):
        problemi.append(
            "`add column ... not null` senza `default`: fallisce su una tabella "
            "che ha già righe, e il fallimento si ripete a ogni avvio")
    if not re.match(r"^[0-9]{4}_", percorso.name):
        problemi.append(
            f"il nome `{percorso.name}` non comincia con quattro cifre: l'ordine "
            "è lessicografico, e `10_x.sql` verrebbe eseguito prima di `0001_`")

    if problemi:
        elenco = "\n".join(f"  - {p}" for p in problemi)
        rispondi("deny", (
            f"Migrazione non idempotente ({percorso.name}):\n{elenco}\n\n"
            "Le migrazioni vengono rieseguite a ogni avvio, senza tabella di "
            "versione e senza rollback: quello che fallisce una volta fallisce "
            "per sempre. Esempio corretto: "
            "services/api/migrations/0009_conversazioni_chat.sql. "
            "Regole complete: .claude/rules/migrazioni.md"
        ))

    # Ripetibile sì, ma irreversibile: non si nega, si *chiede* — è la
    # procedura di CLAUDE.md, «fermarsi, dire cosa viene perso, chiedere».
    if DISTRUTTIVI.search(sql):
        rispondi("ask", (
            f"{percorso.name} contiene un'operazione distruttiva e "
            "irreversibile, che verrà rieseguita a ogni avvio.\n\n"
            "Regola 6 di .claude/rules/migrazioni.md: ci si ferma e si chiede "
            "all'utente, dicendo cosa si perde. L'unico precedente in questo "
            "repo è 0008_rimuovi_playground.sql, che porta quattro righe di "
            "commento a giustificare ogni drop."
        ))

    if gia_su_main(percorso):
        rispondi("ask", (
            f"{percorso.name} esiste già su `main`, quindi è già stato "
            "applicato in produzione.\n\n"
            "Regola 5 di .claude/rules/migrazioni.md: un file già eseguito è "
            "storia, non codice — si aggiunge un file nuovo. Se la modifica è "
            "solo a un commento, va bene: confermalo."
        ))


if __name__ == "__main__":
    main()
