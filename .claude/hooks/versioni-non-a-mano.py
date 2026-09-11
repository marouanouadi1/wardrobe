#!/usr/bin/env python3
"""Nega la scrittura a mano di un numero di versione.

`apps/mobile/app.json` (`expo.version`), `apps/mobile/package.json` e
`services/api/pyproject.toml` (`version`) li scrive solo
`scripts/bump-versione.mjs`, che deduce il livello dai conventional commit —
vedi `docs/adr/0005`. Un numero alzato a mano rimette in circolo il contatore
di merge che quell'ADR ha tolto.

PreToolUse e non PostToolUse: qui bisogna *impedire*, non segnalare. Su
PostToolUse il file sarebbe già scritto.

Toccare le dipendenze in pyproject.toml o la configurazione Expo in app.json
resta libero: si guarda solo il campo della versione — e per «non cambia» si
intende **rispetto al file su disco**, non rispetto a `old_string`. Una `Write`
non porta `old_string`: confrontando con quello, qualunque riscrittura
integrale veniva negata anche a versione identica, cioè il contrario di quello
che questo docblock promette.
"""

import json
import re
import sys
from pathlib import Path

# Tre file, non due: `bump-versione.mjs` ne scrive tre. La regola scritta in
# CLAUDE.md e in .claude/rules/ci-release.md ne nominava due, ed era indietro
# rispetto allo script.
SORVEGLIATI = (
    "apps/mobile/app.json",
    "apps/mobile/package.json",
    "services/api/pyproject.toml",
)

# TOML accetta entrambi i tipi di apice: guardarne uno solo lasciava passare
# `version = '0.4.2'`, che è TOML valido.
VERSIONE_TOML = re.compile(r"""^version\s*=\s*["']([^"']+)["']""", re.M)
VERSIONE_JSON = re.compile(r'"version"\s*:\s*"([^"]+)"')


def rispondi(decisione: str, motivo: str) -> None:
    """`permissionDecisionReason` è il campo che torna al modello.

    `systemMessage` da solo lo lascia con un rifiuto senza motivo, e quindi
    senza modo di correggersi.
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


def main() -> None:
    try:
        evento = json.load(sys.stdin)
        ingresso = evento.get("tool_input", {})
        percorso = str(ingresso.get("file_path", ""))
    except Exception:
        # Una guardia che deve impedire non fallisce aperta: `ask`, non `allow`.
        rispondi("ask", "L'hook sulle versioni non ha capito l'evento: "
                        "controlla a mano di non star scrivendo un numero di "
                        "versione (docs/adr/0005).")
        return

    if not any(percorso.endswith(s) for s in SORVEGLIATI):
        return

    testo = str(ingresso.get("content") or ingresso.get("new_string") or "")
    trova = VERSIONE_TOML if percorso.endswith(".toml") else VERSIONE_JSON

    nuove = trova.findall(testo)
    if not nuove:
        return  # la modifica non nomina nessuna versione

    try:
        su_disco = trova.findall(Path(percorso).read_text(encoding="utf-8"))
    except OSError:
        su_disco = []
    if su_disco and su_disco == nuove:
        return  # il campo c'è ma dice quello che diceva già

    rispondi("deny", (
        f"Le versioni non si scrivono a mano: {percorso} è scritto solo da "
        "scripts/bump-versione.mjs, che deduce major/minor/patch dai "
        "conventional commit (docs/adr/0005-le-versioni-vengono-dai-commit.md). "
        "Se serve rilasciare, si apre una PR con il titolo giusto."
    ))


if __name__ == "__main__":
    main()
