# 0005 — Le versioni vengono dai commit, non dai merge

**Stato:** accettata · **Data:** 2026-08-20

## Contesto

Il rilascio automatico dell'app faceva `patch + 1` a ogni merge su `main` che
toccasse `apps/mobile/**`. Dopo cinque merge la versione diceva `0.1.5`, e tra
quei cinque c'erano sia `Aggiungi «Le mie segnalazioni»` — nuove rotte backend,
una schermata nuova, uno stato che l'utente vede — sia un fix di un colore di
testo invisibile su un bottone. Due cambiamenti di peso incomparabile valevano
lo stesso incremento.

Un numero che si alza sempre di uno non è una versione: è un contatore di
merge. Chi riceve l'APK non poteva sapere se `0.1.4 → 0.1.5` valeva la pena di
essere installato, e la storia dei tag non permetteva di rispondere a «da che
versione esiste questa funzione».

Sul backend il problema era il gemello, in negativo: `services/api/pyproject.toml`
era fermo a `0.1.0` da sempre, senza nessun tag `api-v*`, e `GET /salute`
leggeva la versione da `VERSIONE_APP` — una variabile d'ambiente che nessuno
impostava, né in `docker-compose.yml` né nei `.env` scritti a mano sul server.
In produzione quell'endpoint rispondeva `"versione": "dev"`. Dopo un deploy si
sapeva che il server *rispondeva*, non che stesse servendo il codice appena
mandato.

## Decisione

### Il livello di bump si deduce dai conventional commit

`scripts/bump-versione.mjs` legge i commit dall'ultimo tag del target e sceglie
il livello: `feat` → minor, un `!` o un `BREAKING CHANGE:` nel corpo → major,
tutto il resto → patch. Vince il livello più alto trovato.

Il formato non è una raccomandazione in un README: `.github/workflows/pr-title.yml`
fa cadere la PR se il titolo non è un conventional commit. Senza quel check la
regola sarebbe teatro — nella storia precedente a questa decisione gli unici
commit conventional erano quelli del bot di bump, e ogni titolo scritto a mano
sarebbe finito in `patch` per default, cioè nel comportamento che si voleva
lasciare indietro.

**Il segnale è il titolo della PR.** I merge di questo repo non sono squash: il
subject del merge commit è `Merge pull request #N from <branch>`, che non è un
conventional commit, e il titolo della PR finisce nel *corpo*. Lo script lo sa e
legge lì; guardare solo il subject classificherebbe ogni merge come patch.

### La scansione è filtrata per path

I percorsi che lo script guarda per ogni target sono gli stessi del filtro
`paths:` del workflow che lo rilascia: `apps/mobile` e `packages/contracts` per
il mobile, `services/api` e `packages/contracts` per l'api. Un `feat(api):` non
alza il minor dell'app, e viceversa. È la stessa scelta dei filtri sui path in
CI, applicata al numero di versione: due componenti che si rilasciano da soli
hanno due storie separate.

### Finché il major è 0, un breaking change alza il minor

Semver dice che in `0.y.z` tutto può cambiare. Un `feat!:` non è la decisione
di dichiarare stabile un'API: lo script applica un livello `major` come bump
minor e lo scrive nel log, e il passaggio a `1.0.0` resta un commit fatto a
mano, quando qualcuno decide che è vero. Sopra `1.0.0` il major viene applicato
per davvero.

### Il primo rilascio di un target è un patch

Se nessun tag col prefisso esiste — il caso dell'api, che non ne ha mai avuti —
il livello è `patch`. La storia intera del repo non è il changelog di un
rilascio: sarebbe un `0.2.0` che riassume mesi di lavoro già in produzione.

### La versione dell'api è verificabile a runtime

`handlers/health.py` legge la versione dai metadati del pacchetto installato
(`importlib.metadata`), non dall'ambiente: la `version` di `pyproject.toml` è la
sola fonte, e ci arriva perché il `Dockerfile` fa `uv sync --no-dev`, cioè
*installa* il progetto invece di copiarlo soltanto.

Questo rende possibile l'ultimo step del deploy: `GET /salute` viene confrontato
con la versione appena rilasciata, e il job fallisce se non combaciano. Un rsync
andato a metà o un `docker compose up` che riusa l'immagine vecchia prima
passavano inosservati — l'endpoint rispondeva comunque.

Per la stessa ragione il commit di bump e il tag `api-v*` vengono pushati **in
fondo**, a deploy verificato: un tag su una versione che non è mai andata in
produzione sarebbe una bugia scritta nella storia.

## Conseguenze

- Il titolo di ogni PR diventa parte del contratto di rilascio. È il costo, ed è
  pagato in review, dove costa meno.
- `mobile.yml` e `api.yml` fanno il checkout con `fetch-depth: 0`: senza storia
  e senza tag la scansione non vede niente e rilascerebbe sempre un patch,
  silenziosamente.
- Il campo `version` è stato rimosso dal `package.json` della radice e da
  `packages/contracts`: erano fermi a `0.1.0` da sempre, nessuno script li
  leggeva e npm non li richiede per un pacchetto `private`. Un numero che non si
  aggiorna mai è peggio di nessun numero — sembra informazione e non lo è.
- Le versioni sono due e indipendenti (`mobile-v*`, `api-v*`). Non c'è un numero
  unico che descriva «il prodotto»: è la conseguenza di rilasciare i due pezzi
  separatamente, non una dimenticanza.
