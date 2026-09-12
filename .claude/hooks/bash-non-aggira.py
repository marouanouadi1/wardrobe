#!/usr/bin/env python3
"""Nega — o chiede — una scrittura che passa da Bash invece che da Write/Edit.

`T-12` (`docs/DA_FARE.md`): il `matcher` degli altri hook è `"Write|Edit"`, e
Bash scrive file lo stesso (`sed -i`, `tee`, `> file`, un heredoc). La stessa
scrittura che un altro hook negherebbe su `Write`/`Edit` passava intatta da
Bash, e `permissions.deny` è un confronto **per prefisso**: `cd x && git
clean` non somiglia a `git clean`.

**Questo hook non rifà i gate degli altri.** Su una migrazione o su un numero
di versione non giudica il contenuto: dice solo «questo si scrive con
`Write`/`Edit`, così il gate che sa leggerlo (`migrazione-idempotente.py`,
`versioni-non-a-mano.py`) può guardarlo». Chi vuole scrivere lì, lo fa con lo
strumento giusto — e viene giudicato lì.

**Si accende solo se il comando nomina un bersaglio sorvegliato o un verbo
distruttivo.** Tutto il resto passa senza analisi: è la differenza onesta da
`deny`, che fallisce *aperta* su un prefisso che non riconosce — qui si
fallisce *chiusa* su una forma che non si riconosce (`ask`, mai `allow` per
dubbio).

**È un tampone dichiarato (`docs/adr/0008`).** La causa — una shell che può
fare qualunque cosa, giudicata qui con delle regex su un frammento di testo —
resta dov'era: questo file aggiunge righe, non ne toglie. `T-12` in
`docs/DA_FARE.md` lo dice esplicitamente e non si chiude, si riduce.

**Limiti dichiarati, non coperti:**

- i bersagli si riconoscono per **frammento distintivo** (`.claude/`,
  `pyproject.toml`, `migrations/….sql`, …), non per path assoluto: dopo un
  `cd`, un frammento resta un frammento, ed è per questo che il `cd` non è un
  buco. L'eccezione è `apps/mobile/package.json`, che va scritto per intero —
  il solo `package.json` colpirebbe anche la root e ogni altro workspace — e
  quindi *quello* smette di vedersi dopo un `cd apps/mobile`;
- un comando che scrive senza nominare il path (`npm install` che tocca
  `package.json`) non si vede;
- `psql -c 'drop table …'` dentro un container salta il gate delle migrazioni
  per intero: qui non si intercetta nulla dentro un altro processo;
- l'hook non sa **quale agente** ha chiamato Bash (`.claude/README.md`,
  livello 3): «`reviewer`/`security`/`orchestrator` non scrivono» resta
  un'istruzione, non un controllo, per tutto ciò che è fuori dai bersagli qui
  sotto.

Nessun file su disco viene letto: l'analisi è sul testo del comando, non sul
suo effetto — coerente con l'essere un hook `PreToolUse`, che deve *impedire*
prima che il comando giri.

**Il corpo di un heredoc non è un comando: è testo scritto.** I verbi
distruttivi si cercano solo nel comando *eseguibile* (`rimuovi_corpo_heredoc`
salta tutto ciò che sta fra `<<DELIM` e `DELIM`), altrimenti un `python3 -
<<'EOF'` che scrive un file di documentazione — uno che **parla** di `git
clean` in una frase, come questo stesso file — verrebbe negato per una frase,
non per un comando. I bersagli restano invece cercati nel testo intero,
corpo incluso: è lì che un `python3 - <<EOF ... open(".claude/x", "w") ...
EOF` nomina davvero il path che sta per scrivere, senza passare da una
redirezione di shell che l'hook potrebbe vedere altrove.
"""

import json
import re
import sys
from typing import NamedTuple

# ── I bersagli ───────────────────────────────────────────────────────────────
# Un frammento distintivo del path, non il path intero: vedi il docblock sopra
# sul perché (il `cd` non deve essere un buco).


class Bersaglio(NamedTuple):
    famiglia: str
    nome: str


# famiglia "segreti": nega anche in lettura, è il punto.
# famiglia "gate": ha già un gate su Write/Edit — nega solo la scrittura.
# famiglia "chiuso_ask" / "chiuso_deny": chiuso da permissions.deny.
BERSAGLI: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r"""(?:^|[\s/'"])\.env(?:\.[\w.-]+)?"""), "segreti", ".env*"),
    (re.compile(r"dati/foto/"), "segreti", "services/api/dati/foto/**"),
    (re.compile(r"migrations/[^\s;&|<>]*\.sql"), "gate", "services/api/migrations/*.sql"),
    (re.compile(r"pyproject\.toml"), "gate", "services/api/pyproject.toml"),
    (re.compile(r"(?:^|[\s/])app\.json"), "gate", "apps/mobile/app.json"),
    (re.compile(r"apps/mobile/package\.json"), "gate", "apps/mobile/package.json"),
    (re.compile(r"\.claude/"), "chiuso_ask", ".claude/**"),
    (re.compile(r"contracts/schema/"), "chiuso_deny", "packages/contracts/schema/**"),
    (re.compile(r"src/generated/"), "chiuso_deny", "packages/contracts/src/generated/**"),
    (re.compile(r"apps/web/"), "chiuso_deny", "apps/web/**"),
]

# Il motivo è per bersaglio, non solo per famiglia: l'agente deve sapere *dove*
# si scrive davvero, non solo che «qualcosa» è vietato.
MOTIVO_SCRITTURA = {
    "services/api/migrations/*.sql": (
        "deny",
        "si scrive con `Write`/`Edit`: è il gate che guarda se la migrazione è "
        "idempotente (.claude/hooks/migrazione-idempotente.py, "
        ".claude/rules/migrazioni.md). Da Bash quel gate non vede niente.",
    ),
    "services/api/pyproject.toml": (
        "deny",
        "si scrive con `Write`/`Edit`: è il gate sulle versioni "
        "(.claude/hooks/versioni-non-a-mano.py, docs/adr/0005). Da Bash quel "
        "gate non vede niente.",
    ),
    "apps/mobile/app.json": (
        "deny",
        "si scrive con `Write`/`Edit`: è il gate sulle versioni "
        "(.claude/hooks/versioni-non-a-mano.py, docs/adr/0005). Da Bash quel "
        "gate non vede niente.",
    ),
    "apps/mobile/package.json": (
        "deny",
        "si scrive con `Write`/`Edit`: è il gate sulle versioni "
        "(.claude/hooks/versioni-non-a-mano.py, docs/adr/0005). Da Bash quel "
        "gate non vede niente.",
    ),
    ".claude/**": (
        "ask",
        "`.claude/` si modifica dalla sessione principale, su richiesta "
        "esplicita dell'utente (.claude/README.md): questa domanda *è* quella "
        "richiesta.",
    ),
    "packages/contracts/src/generated/**": (
        "deny",
        "è un output: si rigenera con `npm run contracts:generate` "
        "(.claude/rules/contratti.md), non si scrive a mano.",
    ),
    "packages/contracts/schema/**": (
        "deny",
        "è un output: si rigenera con `npm run contracts:generate` "
        "(.claude/rules/contratti.md), non si scrive a mano.",
    ),
    "apps/web/**": (
        "deny",
        "è vuoto apposta (apps/web/README.md): nessun agente ci scrive.",
    ),
}

MOTIVO_SEGRETI = {
    ".env*": (
        "un file di ambiente: `Read(./.env*)` e `Read(./**/.env*)` lo vietano "
        "già in lettura da Write/Edit; da Bash restava aperto."
    ),
    "services/api/dati/foto/**": (
        "le foto degli utenti: `Read(./services/api/dati/foto/**)` lo vieta "
        "già in lettura da Write/Edit; da Bash restava aperto."
    ),
}

# ── I verbi distruttivi ──────────────────────────────────────────────────────
# Le stesse righe che `settings.json` già nega per prefisso — non una seconda
# politica, la stessa resa non aggirabile — cercate in *qualunque* segmento.
DISTRUTTIVI: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bgit\s+clean\b"),
     "`git clean`: cancella file non tracciati (deny in settings.json, qui "
     "perché non è a inizio riga)"),
    (re.compile(r"\bgit\s+push\b.*(?:--force\b|(?:^|\s)-f(?:$|\s))"),
     "`git push --force`/`-f`: riscrive la storia del remoto"),
    (re.compile(r"\bgit\s+reset\b.*--hard\b"),
     "`git reset --hard`: scarta lavoro non committato"),
    (re.compile(r"\bdocker\s+compose\s+down\b.*(?:-v\b|--volumes\b)"),
     "`docker compose down -v`: perde i volumi, dati compresi"),
    (re.compile(r"\bdocker\s+volume\s+(?:rm|prune)\b"),
     "`docker volume rm|prune`: cancella volumi"),
    (re.compile(r"\brsync\b"),
     "`rsync`: CLAUDE.md lo riserva perché può sovrascrivere i `.env` del "
     "server, che non hanno copia"),
    (re.compile(r"\bssh\s+marouan@89\.167\.15\.22\b"),
     "connessione diretta al VPS: le operazioni là sopra si concordano prima"),
]

# ── Le letture riconosciute ──────────────────────────────────────────────────
COMANDI_LETTURA_SEMPLICE = {"cat", "head", "tail", "less", "wc", "ls", "stat", "file", "grep", "rg", "diff", "jq"}
COMANDI_LETTURA_GIT = {"diff", "log", "show", "status", "blame", "ls-files", "ls-tree"}
COMANDI_SCRITTURA = {"tee", "dd", "cp", "mv", "install", "patch"}
FLAG_SCRITTURA = re.compile(r"(?:^|\s)(?:-i|--in-place)(?:=\S*)?(?:\s|$)")

# Forme che l'hook non prova a leggere dentro: meglio chiedere che sbagliare.
FORME_OPACHE = re.compile(
    r"\beval\b|\bxargs\b|\b(?:bash|sh)\s+-c\b|\bfind\b[^;&|]*-exec\b|\$\(|`|<<-?\s*['\"]?\w+"
)

RIDIREZIONE = re.compile(r"(?:^|\s)\d*>{1,2}&?\s*(\S+)")

HEREDOC_APERTURA = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")


def rispondi(decisione: str, motivo: str) -> None:
    """L'unica uscita, come negli altri hook: il motivo torna al modello."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decisione,
            "permissionDecisionReason": motivo,
        },
        "systemMessage": motivo,
    }))
    sys.exit(0)


def dividi_in_segmenti(comando: str) -> list[str]:
    """Spezza su `;`, `&&`, `||`, `|`, a capo — rispettando gli apici.

    Non è un parser di shell: è l'euristica dichiarata nel docblock. Il punto
    che deve reggere è non spezzare *dentro* una stringa fra apici, altrimenti
    `bash -c 'sed -i ... file'` si romperebbe in pezzi innocui.
    """
    segmenti = []
    corrente: list[str] = []
    apice = ""
    i, n = 0, len(comando)
    while i < n:
        c = comando[i]
        if apice:
            corrente.append(c)
            if c == apice:
                apice = ""
            i += 1
            continue
        if c in "'\"":
            apice = c
            corrente.append(c)
            i += 1
            continue
        if c == "\\" and i + 1 < n:
            corrente.append(c)
            corrente.append(comando[i + 1])
            i += 2
            continue
        if comando[i:i + 2] in ("&&", "||"):
            segmenti.append("".join(corrente))
            corrente = []
            i += 2
            continue
        if c in ";|\n":
            segmenti.append("".join(corrente))
            corrente = []
            i += 1
            continue
        corrente.append(c)
        i += 1
    segmenti.append("".join(corrente))
    return [s.strip() for s in segmenti if s.strip()]


def rimuovi_corpo_heredoc(comando: str) -> str:
    """Il corpo di un heredoc è dato scritto, non un comando eseguito.

    Serve solo per i verbi distruttivi (vedi docblock): la riga che apre
    l'heredoc resta — porta l'eventuale redirezione — ma tutto quello che sta
    fra `<<DELIM` e `DELIM` sparisce, così una frase come «`git clean` non
    somiglia a...» scritta *dentro* un file non viene letta come un comando.
    """
    righe = comando.split("\n")
    tenute: list[str] = []
    i = 0
    while i < len(righe):
        tenute.append(righe[i])
        m = HEREDOC_APERTURA.search(righe[i])
        if m:
            delimitatore = m.group(2)
            i += 1
            while i < len(righe) and righe[i].strip() != delimitatore:
                i += 1
            i += 1  # salta anche la riga del delimitatore di chiusura
            continue
        i += 1
    return "\n".join(tenute)


def trova_bersagli(testo: str) -> list[Bersaglio]:
    trovati: list[Bersaglio] = []
    visti: set[str] = set()
    for pattern, famiglia, nome in BERSAGLI:
        if nome not in visti and pattern.search(testo):
            trovati.append(Bersaglio(famiglia, nome))
            visti.add(nome)
    return trovati


def bersaglio_di_redirezione(segmento: str) -> Bersaglio | None:
    """Il target di un `>`/`>>` conta come scrittura, chiunque sia il comando.

    `cat x > .claude/settings.json` deve fermarsi anche se `cat` è una lettura;
    `grep -rn x .claude/ > /tmp/o` no, perché il *target* non è un bersaglio.
    """
    for m in RIDIREZIONE.finditer(segmento):
        token = m.group(1).strip("'\"")
        bersagli = trova_bersagli(token)
        if bersagli:
            return bersagli[0]
    return None


def controlla_distruttivi(segmento: str) -> list[tuple[str, str]]:
    """Solo sui segmenti *eseguibili* (senza corpi di heredoc): vedi il
    docblock del modulo e `rimuovi_corpo_heredoc`."""
    for pattern, motivo in DISTRUTTIVI:
        if pattern.search(segmento):
            return [("deny", motivo)]
    return []


def controlla_bersagli(segmento: str) -> list[tuple[str, str]]:
    """Sui segmenti del comando *intero*, corpo di heredoc compreso: un path
    scritto dentro un `python3 - <<EOF` va riconosciuto lì, non solo in una
    redirezione di shell."""
    problemi: list[tuple[str, str]] = []

    bersagli = trova_bersagli(segmento)
    if not bersagli:
        return problemi

    bersaglio_scritto = bersaglio_di_redirezione(segmento)
    if bersaglio_scritto:
        if bersaglio_scritto.famiglia == "segreti":
            problemi.append(("deny", f"`{bersaglio_scritto.nome}`: "
                              f"{MOTIVO_SEGRETI[bersaglio_scritto.nome]}"))
        else:
            decisione, spiegazione = MOTIVO_SCRITTURA[bersaglio_scritto.nome]
            problemi.append((decisione, f"`{bersaglio_scritto.nome}`: {spiegazione}"))
        return problemi

    segreti = [b for b in bersagli if b.famiglia == "segreti"]
    if segreti:
        for b in segreti:
            problemi.append(("deny", f"`{b.nome}`: {MOTIVO_SEGRETI[b.nome]}"))
        return problemi

    parti = segmento.split()
    primo = parti[0] if parti else ""
    secondo = parti[1] if len(parti) > 1 else ""
    scrive = primo in COMANDI_SCRITTURA or bool(FLAG_SCRITTURA.search(segmento))

    if not scrive and (primo in COMANDI_LETTURA_SEMPLICE
                        or (primo == "git" and secondo in COMANDI_LETTURA_GIT)):
        return problemi  # una lettura riconosciuta: passa senza altro

    if FORME_OPACHE.search(segmento):
        nomi = ", ".join(sorted({b.nome for b in bersagli}))
        problemi.append(("ask", f"comando in una forma che l'hook non sa leggere dentro "
                          f"(`{primo}`), e nomina {nomi}: non fallisce aperto, chiede"))
        return problemi

    for b in bersagli:
        decisione, spiegazione = MOTIVO_SCRITTURA[b.nome]
        problemi.append((decisione, f"`{b.nome}`: {spiegazione}"))
    return problemi


def main() -> None:
    try:
        evento = json.load(sys.stdin)
        ingresso = evento.get("tool_input", {})
        comando = str(ingresso.get("command", ""))
    except Exception:
        # Una guardia che deve impedire non fallisce aperta: `ask`, non `allow`.
        rispondi("ask", "L'hook su Bash non ha capito l'evento: controlla a mano "
                        "che il comando non scriva su un path sorvegliato "
                        "(docs/DA_FARE.md T-12).")
        return

    if not comando.strip():
        return

    problemi: list[tuple[str, str]] = []
    for segmento in dividi_in_segmenti(rimuovi_corpo_heredoc(comando)):
        problemi.extend(controlla_distruttivi(segmento))
    for segmento in dividi_in_segmenti(comando):
        problemi.extend(controlla_bersagli(segmento))

    if not problemi:
        return

    decisione_finale = "deny" if any(d == "deny" for d, _ in problemi) else "ask"
    elenco = "\n".join(f"  - {m}" for _, m in dict.fromkeys(problemi))
    rispondi(decisione_finale, (
        f"Questo comando Bash tocca qualcosa che ha già un gate su "
        f"`Write`/`Edit`, o un'operazione distruttiva:\n{elenco}\n\n"
        "T-12 (docs/DA_FARE.md): Bash non era intercettato da niente, e la "
        "stessa scrittura passata da Write/Edit veniva giudicata. Se serve "
        "scrivere lì, usa Write/Edit; se l'operazione è voluta, chiedilo "
        "all'utente."
    ))


if __name__ == "__main__":
    main()
