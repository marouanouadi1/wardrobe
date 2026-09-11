#!/usr/bin/env python3
"""Nega una migrazione che non regge a essere rieseguita.

`services/api/scripts/applica_migrazioni.py` esegue *tutti* i file .sql in
ordine lessicografico *a ogni avvio*, senza tabella di versione e senza
rollback. Regge solo perché ogni file è idempotente per costruzione.

Conseguenza: una migrazione non idempotente non rompe un deploy — rompe ogni
avvio successivo, finché qualcuno non entra sul server.

PreToolUse: qui bisogna impedire, non segnalare.
"""

import json
import re
import sys

CONTROLLI = [
    (r"create\s+table\s+(?!if\s+not\s+exists)",
     "`create table` senza `if not exists`"),
    (r"create\s+(unique\s+)?index\s+(?!if\s+not\s+exists|concurrently)",
     "`create index` senza `if not exists`"),
    (r"alter\s+table\s+\w+\s+add\s+column\s+(?!if\s+not\s+exists)",
     "`add column` senza `if not exists`"),
    (r"drop\s+(table|column|index|type)\s+(?!if\s+exists)",
     "`drop` senza `if exists`"),
    (r"insert\s+into\s+(?:(?!on\s+conflict)[\s\S])*?;",
     "`insert into` senza `on conflict do nothing`"),
]

NOT_NULL_SENZA_DEFAULT = re.compile(
    r"add\s+column\s+(?:if\s+not\s+exists\s+)?\w+\s+[\w()\[\]. ]*?not\s+null"
    r"(?![\s\S]{0,80}?default)", re.I)


def nega(problemi: list[str], percorso: str) -> None:
    elenco = "\n".join(f"  - {p}" for p in problemi)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
        },
        "systemMessage": (
            f"Migrazione non idempotente ({percorso}):\n{elenco}\n\n"
            "Le migrazioni vengono rieseguite a ogni avvio, senza tabella di "
            "versione e senza rollback: quello che fallisce una volta fallisce "
            "per sempre. Esempio corretto: "
            "services/api/migrations/0009_conversazioni_chat.sql. "
            "Regole complete: .claude/rules/migrazioni.md"
        ),
    }))
    sys.exit(0)


def main() -> None:
    try:
        evento = json.load(sys.stdin)
    except Exception:
        return

    ingresso = evento.get("tool_input", {})
    percorso = str(ingresso.get("file_path", ""))
    if "services/api/migrations/" not in percorso or not percorso.endswith(".sql"):
        return

    testo = str(ingresso.get("content") or ingresso.get("new_string") or "")
    # via i commenti, o un esempio commentato farebbe scattare il controllo
    pulito = re.sub(r"--[^\n]*", "", testo)

    problemi = [d for pattern, d in CONTROLLI
                if re.search(pattern, pulito, re.I)]
    if NOT_NULL_SENZA_DEFAULT.search(pulito):
        problemi.append(
            "`add column ... not null` senza `default`: fallisce su una tabella "
            "che ha già righe, e il fallimento si ripete a ogni avvio")

    nome = percorso.rsplit("/", 1)[-1]
    if not re.match(r"^[0-9]{4}_", nome):
        problemi.append(
            f"il nome `{nome}` non comincia con quattro cifre: l'ordine è "
            "lessicografico, e `10_x.sql` verrebbe eseguito prima di `0001_`")

    if problemi:
        nega(problemi, percorso)


if __name__ == "__main__":
    main()
