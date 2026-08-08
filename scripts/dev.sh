#!/usr/bin/env bash
# Avvia tutto lo stack locale con un comando solo.
#
#   npm run dev       -> Postgres (aspetta che sia pronto) + API in primo piano
#   npm run dev:app   -> ... e in più l'app Expo, che tiene il terminale
#
# Perché uno script e non `concurrently`: sotto un multiplexer di processi lo
# stdin di Expo non è un terminale vero, e i tasti della sua TUI (r, m, w, j)
# smettono di rispondere. Qui Expo resta in primo piano sul terminale vero e
# solo l'API passa da una pipe, con il suo prefisso.
#
# Postgres non viene mai spento all'uscita: è staccato, non costa niente
# tenerlo su, e spegnerlo taglierebbe le gambe a un secondo terminale che sta
# usando lo stesso database. Per fermarlo: npm run db:down
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --file "$RADICE/docker-compose.yml")
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

# Docker è il modo comune di avere Postgres in locale, ma non l'unico: chi
# non ha RAM per Docker Desktop (es. un PC da 8GB) installa Postgres nativo e
# non ha `docker` in PATH affatto. Qui non è un errore: si salta tutto il
# blocco Docker sotto e ci si affida al servizio nativo già avviato dal
# sistema operativo.
CON_DOCKER=0
# Sotto `set -e`, un `&&` che fallisce senza un `|| ...` finale farebbe
# uscire subito lo script proprio nel caso che deve invece gestire (Docker
# assente): il `|| true` finale è lì apposta, non è decorativo.
"${COMPOSE[@]}" version >/dev/null 2>&1 && docker info >/dev/null 2>&1 && CON_DOCKER=1 || true

[[ -f "$RADICE/services/api/.env" ]] || {
  echo "⚠ Manca services/api/.env — copialo da .env.example e mettici la tua ANTHROPIC_API_KEY."
  echo "  L'API parte lo stesso, ma i capi resteranno in memoria e l'analisi delle foto darà 503."
}

if porta_in_ascolto "$PORTA_API"; then
  echo "✗ La porta $PORTA_API è già occupata: un'altra API è già in ascolto?" >&2
  echo "  Chiudi l'altro terminale, oppure spostati:  PORTA=8788 npm run dev" >&2
  exit 1
fi

# ---------------------------------------------------------------- Postgres

if [[ "$CON_DOCKER" -eq 1 ]]; then
  echo "→ Postgres (Docker)"
  # --wait sfrutta l'healthcheck già scritto in docker-compose.yml
  # (pg_isready): quando questa riga ritorna, il database accetta connessioni
  # davvero — niente sleep a caso, nessuna dipendenza tipo wait-on. Il
  # timeout è largo (120s, non i 50s dell'healthcheck) perché una initdb a
  # freddo su WSL2 può sforare.
  "${COMPOSE[@]}" up --detach --wait --wait-timeout 120 postgres || {
    echo "✗ Postgres non è diventato pronto in tempo." >&2
    echo "  Guarda cosa dice:  docker compose logs postgres" >&2
    exit 1
  }
else
  echo "→ Postgres nativo (Docker non è disponibile: presumo un servizio Postgres già installato e avviato)"
fi

# Applica le migrazioni mancanti — funziona identico su Docker e su un
# Postgres nativo, perché parla solo DATABASE_URL, mai docker compose. È
# anche il modo in cui una migrazione arrivata con l'ultimo `git pull` si
# applica da sola, invece di restare lì finché qualcuno non se ne accorge a
# mano: ogni file è `create ... if not exists`, quindi rilanciarli tutti a
# ogni avvio non fa danni. Se manca `.env` o `DATABASE_URL`, lo script sotto
# non fa nulla (restano i capi in memoria, come sempre) invece di fallire.
if [[ -f "$RADICE/services/api/.env" ]]; then
  echo "→ Migrazioni"
  ( cd "$RADICE/services/api" && uv run python scripts/applica_migrazioni.py ) || exit 1
fi

# ---------------------------------------------------------- livello 1: API

# La CWD è parte del contratto, non un vezzo:
#  1. CARTELLA_FOTO=./dati/foto è relativa — da un'altra cartella le foto
#     finirebbero altrove, e in una cartella che il .gitignore non copre;
#  2. `uv run` cerca il pyproject.toml risalendo da qui: dalla radice non lo
#     trova e il modulo `handlers` non esiste.
if [[ "$CON_APP" -eq 0 ]]; then
  echo "→ API su http://localhost:$PORTA_API   (Ctrl-C per fermare)"
  echo "  Postgres resta acceso: «npm run db:down» per spegnerlo."
  cd "$RADICE/services/api"
  # Uscire con 0 su Ctrl-C: altrimenti npm stampa un blocco d'errore rosso
  # ogni volta che si chiude normalmente. Se invece l'API muore da sola,
  # `set -e` lascia passare il suo codice d'uscita vero.
  trap 'echo; echo "→ chiuso. Postgres resta acceso (npm run db:down)."; exit 0' INT
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
  printf '\n→ chiuso. Postgres resta acceso: «npm run db:down» per spegnerlo.\n'
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
