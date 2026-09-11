#!/usr/bin/env python3
"""Nega la scrittura a mano di un numero di versione.

`apps/mobile/app.json` (`expo.version`) e `services/api/pyproject.toml`
(`version`) li scrive solo `scripts/bump-versione.mjs`, che deduce il livello
dai conventional commit — vedi `docs/adr/0005`. Un numero alzato a mano rimette
in circolo il contatore di merge che quell'ADR ha tolto.

PreToolUse e non PostToolUse: qui bisogna *impedire*, non segnalare. Su
PostToolUse il file sarebbe già scritto.

Toccare le dipendenze in pyproject.toml o la configurazione Expo in app.json
resta libero: si guarda solo il campo della versione.
"""

import json
import re
import sys

SORVEGLIATI = ("apps/mobile/app.json", "services/api/pyproject.toml")


def nega(messaggio: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
        },
        "systemMessage": messaggio,
    }))
    sys.exit(0)


def main() -> None:
    try:
        evento = json.load(sys.stdin)
    except Exception:
        return  # un hook che non capisce l'evento non blocca il lavoro

    ingresso = evento.get("tool_input", {})
    percorso = str(ingresso.get("file_path", ""))
    if not any(percorso.endswith(s) for s in SORVEGLIATI):
        return

    # Write porta l'intero contenuto; Edit solo la stringa nuova.
    testo = str(ingresso.get("content") or ingresso.get("new_string") or "")
    vecchio = str(ingresso.get("old_string") or "")

    if percorso.endswith("app.json"):
        trova = re.compile(r'"version"\s*:\s*"([^"]+)"')
    else:
        trova = re.compile(r'^version\s*=\s*"([^"]+)"', re.M)

    nuove = trova.findall(testo)
    if not nuove:
        return
    if vecchio and trova.findall(vecchio) == nuove:
        return  # la riga c'è ma non cambia

    nega(
        f"Le versioni non si scrivono a mano: {percorso} è scritto solo da "
        "scripts/bump-versione.mjs, che deduce major/minor/patch dai "
        "conventional commit (docs/adr/0005-le-versioni-vengono-dai-commit.md). "
        "Se serve rilasciare, si apre una PR con il titolo giusto."
    )


if __name__ == "__main__":
    main()
