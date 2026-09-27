#!/usr/bin/env bash
# Avvia tutto lo stack locale con un comando solo.
#
#   npm run dev       -> Supabase locale (aspetta che sia pronto) + API in primo piano
#   npm run dev:app   -> ... e in più l'app Expo, che tiene il terminale
#
# Perché uno script e non `concurrently`: sotto un multiplexer di processi lo
# stdin di Expo non è un terminale vero, e i tasti della sua TUI (r, m, w, j)
# smettono di rispondere. Qui Expo resta in primo piano sul terminale vero e
# solo l'API passa da una pipe, con il suo prefisso.
#
# Lo stack di Supabase non viene mai spento all'uscita: è staccato, e
# spegnerlo taglierebbe le gambe a un secondo terminale che sta usando lo
# stesso database. Per fermarlo: npm run supabase:stop
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTA_API="${PORTA:-8787}"
CON_APP=0
[[ "${1:-}" == "--app" ]] && CON_APP=1

if [[ -t 1 ]]; then CIANO=$'\033[36m'; FINE=$'\033[0m'; else CIANO=""; FINE=""; fi

# Antepone [etichetta] a ogni riga letta da stdin. Un ciclo di bash invece di
# `sed -u`: `-u` è GNU, su macOS non esiste, e qui non serve altro.
prefissa() {
  local etichetta="$1" riga
  while IFS= read -r riga; do
    printf '%s[%s]%s %s\n' "$CIANO" "$etichetta" "$FINE" "$riga"
  done
}

# Vero se qualcosa risponde sulla porta data (sonda TCP in bash puro: niente
# lsof o ss da avere installati). Il tetto a ~1s è essenziale, non decorativo:
# su WSL2 (e su questo sandbox) un connect verso una porta CHIUSA può restare
# bloccato per minuti invece di fallire subito con "connection refused" —
# verificato empiricamente. Il tetto è temporizzato a mano (kill -0 in loop),
# non con il comando esterno `timeout`: su Git Bash per Windows il PATH di
# sistema spesso mette avanti `C:\Windows\System32\timeout.exe`, che ha una
# sintassi completamente diversa (mette in pausa, non esegue un comando) e
# fallisce sempre — con l'effetto che questa sonda risulterebbe sempre "porta
# chiusa" anche quando l'API è già in ascolto.
porta_in_ascolto() {
  ( exec 3<>/dev/tcp/127.0.0.1/"$1" ) 2>/dev/null &
  local pid=$! i
  for ((i = 0; i < 10; i++)); do
    kill -0 "$pid" 2>/dev/null || { wait "$pid"; return $?; }
    sleep 0.1
  done
  kill -9 "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  return 1
}

# ---------------------------------------------------------------- controlli

command -v uv >/dev/null 2>&1 || {
  echo "✗ Manca «uv», il gestore dei pacchetti Python." >&2
  echo "  Installalo:  curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  exit 1
}

command -v supabase >/dev/null 2>&1 || {
  echo "✗ Manca «supabase», la CLI che avvia il database in locale." >&2
  echo "  Installala: https://supabase.com/docs/guides/local-development/cli/getting-started" >&2
  echo "  La versione è quella della CI (.github/workflows/database.yml)." >&2
  exit 1
}

docker info >/dev/null 2>&1 || {
  echo "✗ Serve Docker Desktop (o un daemon Docker) in esecuzione: lo stack di Supabase gira in container." >&2
  exit 1
}

[[ -f "$RADICE/services/api/.env" ]] || {
  echo "⚠ Manca services/api/.env — copialo da .env.example e mettici la tua ANTHROPIC_API_KEY."
  echo "  L'API parte lo stesso, ma l'analisi delle foto e lo stilista daranno 503."
}

if porta_in_ascolto "$PORTA_API"; then
  echo "✗ La porta $PORTA_API è già occupata: un'altra API è già in ascolto?" >&2
  echo "  Chiudi l'altro terminale, oppure spostati:  PORTA=8788 npm run dev" >&2
  exit 1
fi

# ---------------------------------------------------------------- Supabase

echo "→ Supabase (stack locale)"
# Su uno stack già acceso `supabase start` non rifà niente ed esce con 0: si
# può chiamare a ogni avvio. Il primo avvio scarica le immagini e può
# metterci minuti.
supabase start >/dev/null || {
  echo "✗ Lo stack di Supabase non è partito." >&2
  echo "  Guarda cosa dice:  supabase start" >&2
  exit 1
}

# Dallo stack servono due righe, e solo quelle. `status -o env` stampa anche
# la chiave di servizio e il segreto dei JWT: niente `source` né `eval` di
# quell'output, e niente che lo stampi. L'API non deve poter scavalcare l'RLS
# neanche in locale (ADR 0010).
#
# Vincono sul .env: `npm run dev` parla sempre con lo stack locale. Un valore
# già nell'ambiente della shell resta, per chi lo vuole puntare altrove.
STATO="$(supabase status -o env 2>/dev/null)"
riga_di() { printf '%s\n' "$STATO" | sed -n "s/^$1=\"\(.*\)\"\$/\1/p"; }
SUPABASE_URL="${SUPABASE_URL:-$(riga_di API_URL)}"
SUPABASE_CHIAVE_PUBBLICA="${SUPABASE_CHIAVE_PUBBLICA:-$(riga_di PUBLISHABLE_KEY)}"
unset STATO
[[ -n "$SUPABASE_URL" && -n "$SUPABASE_CHIAVE_PUBBLICA" ]] || {
  echo "✗ Da «supabase status» non escono l'indirizzo e la chiave pubblica." >&2
  exit 1
}
export SUPABASE_URL SUPABASE_CHIAVE_PUBBLICA

# ---------------------------------------------------------- livello 1: API

# La CWD è parte del contratto, non un vezzo: `uv run` cerca il
# pyproject.toml risalendo da qui, e dalla radice non lo trova — il modulo
# `handlers` non esisterebbe. E `load_dotenv()` legge il .env di questa
# cartella.
if [[ "$CON_APP" -eq 0 ]]; then
  echo "→ API su http://localhost:$PORTA_API   (Ctrl-C per fermare)"
  echo "  Supabase resta acceso: «npm run supabase:stop» per spegnerlo."
  cd "$RADICE/services/api"
  # Uscire con 0 su Ctrl-C: altrimenti npm stampa un blocco d'errore rosso
  # ogni volta che si chiude normalmente. Se invece l'API muore da sola,
  # `set -e` lascia passare il suo codice d'uscita vero.
  trap 'echo; echo "→ chiuso. Supabase resta acceso (npm run supabase:stop)."; exit 0' INT
  uv run python -m handlers.local_server
  exit $?
fi

# ------------------------------------------------- livello 2: API + Expo

PID_API=""
PID_SENTINELLA=""

pulisci() {
  trap - EXIT INT TERM
  [[ -n "$PID_SENTINELLA" ]] && kill -TERM "$PID_SENTINELLA" 2>/dev/null
  # Per pattern di comando, non per relazione padre-figlio: `uv run` a volte
  # sostituisce se stesso con python (stesso PID) e a volte lo lancia come
  # figlio separato — verificato empiricamente che si comporta in entrambi i
  # modi a seconda dei casi. Un pkill -P sul solo figlio diretto del
  # sottoshell perderebbe il python separato nel secondo caso, lasciandolo
  # orfano in ascolto sulla porta. Serve solo quando questa funzione scatta
  # SENZA un Ctrl-C precedente (es. Expo chiuso da solo): un Ctrl-C vero arriva
  # già a tutto il process group direttamente dal kernel.
  pkill -TERM -f "handlers\.local_server" 2>/dev/null || true
  [[ -n "$PID_API" ]] && kill -TERM "$PID_API" 2>/dev/null || true
  wait 2>/dev/null || true
  printf '\n→ chiuso. Supabase resta acceso: «npm run supabase:stop» per spegnerlo.\n'
}
trap pulisci EXIT INT TERM

echo "→ API su http://localhost:$PORTA_API  (le sue righe sono marcate [api])"
# PYTHONUNBUFFERED: con lo stdout in pipe Python accumula i log e le righe
# comparirebbero a blocchi, con secondi di ritardo.
( cd "$RADICE/services/api" \
  && PYTHONUNBUFFERED=1 exec uv run python -m handlers.local_server 2>&1 | prefissa "api" ) &
PID_API=$!

# Aspetta che l'API risponda davvero prima di lanciare Expo. La sonda del
# preflight sopra gira PRIMA che l'API esista, quindi non basta: se `.env` è
# sbagliato o un import è rotto, l'API muore nei primi istanti e senza questa
# attesa Expo partirebbe comunque, producendo output confuso invece di un
# errore chiaro.
# Scadenza basata sull'orologio (SECONDS), non su un contatore di iterazioni:
# ogni chiamata a porta_in_ascolto può costare fino a 1s per via del suo
# `timeout` interno, quindi contare i cicli renderebbe l'attesa reale fino a
# 10 volte più lunga di quella dichiarata nel messaggio d'errore.
SCADENZA=$((SECONDS + 15))
until porta_in_ascolto "$PORTA_API"; do
  if ! kill -0 "$PID_API" 2>/dev/null; then
    echo "✗ l'API si è fermata prima di rispondere. Guarda l'output sopra." >&2
    exit 1
  fi
  if (( SECONDS >= SCADENZA )); then
    echo "✗ l'API non risponde su $PORTA_API dopo 15s: mi fermo." >&2
    exit 1
  fi
done

# Se l'API muore da sola (import rotto, .env sbagliato) Expo resterebbe su a
# parlare col vuoto. `wait` non vale qui — dentro un sottoshell quel PID non è
# un figlio — quindi si sorveglia a polling e si sveglia tutto il gruppo.
( while kill -0 "$PID_API" 2>/dev/null; do sleep 1; done
  echo "✗ l'API si è fermata: chiudo anche l'app." >&2
  kill -INT 0 ) &
PID_SENTINELLA=$!

# Expo in PRIMO PIANO, di proposito: è l'unico modo perché il suo stdin sia il
# terminale vero e i tasti r/m/w/j rispondano. Niente prefisso sul suo output,
# altrimenti QR code e colori si sfaldano.
echo "→ Expo — i tasti (r, m, w, j) funzionano: il terminale è suo"
cd "$RADICE"
npm run mobile
