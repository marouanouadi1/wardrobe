# Guida per provare Tela su Windows (da zero, passo per passo)

Questa guida non dà per scontato niente: nessuna riga di comando, nessun
programma, nessun termine tecnico che non venga spiegato prima di usarlo. Se
un passaggio non torna, fermati lì — il resto della guida presuppone che
quel passaggio sia andato a buon fine.

**Cosa faremo:** installare tre programmi (una volta sola), scaricare il
progetto, scrivere due chiavi segrete in un file, e poi due semplici comandi
ogni volta che vuoi riaprire l'app.

---

## Prima di iniziare

Chi ti ha mandato questa guida deve darti due cose, **prima** che tu arrivi
al passo 6:

1. Un invito su GitHub come collaboratore del progetto (arriva una email da
   GitHub — vai cliccato "Accept invitation").
2. Due "chiavi" (stringhe di lettere e numeri), mandate in privato — per
   messaggio, non per email in chiaro se possibile. Non farci nulla finché
   non arrivi al passo 6: tienile semplicemente da parte.

---

## Passo 1 — Installare Node.js

Node.js è il programma che fa girare la parte "app" del progetto.

1. Vai su **[nodejs.org](https://nodejs.org)**
2. Clicca il bottone grande a sinistra (quello con scritto "LTS" — è la
   versione consigliata, non quella "Current")
3. Si scarica un file tipo `node-v22.x.x-x64.msi`. Aprilo (doppio clic)
4. Segui l'installazione cliccando **Avanti** su ogni schermata, poi
   **Installa**, poi **Fine**. Le impostazioni di default vanno bene, non
   c'è nulla da cambiare.

**Verifica che abbia funzionato:**

1. Premi il tasto Windows, digita `PowerShell`, premi Invio — si apre una
   finestra blu (o nera) con del testo: è il **terminale**, il posto dove
   scriveremo dei comandi per tutta la guida.
2. Scrivi (o incolla) questo e premi Invio:
   ```
   node -v
   ```
3. Deve rispondere con qualcosa tipo `v22.14.0`. Se invece dice
   "node non è riconosciuto...", chiudi PowerShell, riaprilo, e riprova —
   a volte serve un riavvio della finestra dopo un'installazione.

---

## Passo 2 — Installare Python

Python è il programma che fa girare la parte che parla con l'intelligenza
artificiale.

1. Vai su **[python.org/downloads](https://www.python.org/downloads/)**
2. Clicca il bottone giallo "Download Python 3.1x.x" (deve essere **3.12 o
   più recente** — se il sito propone una versione più vecchia, cerca nella
   pagina "Looking for a specific release?" e scegli una 3.12.x o 3.13.x)
3. Apri il file scaricato.
4. **Attenzione, questo passaggio si salta facilmente e serve**: nella prima
   schermata dell'installer, in basso, c'è una casella
   **"Add python.exe to PATH"**. Spuntala **prima** di cliccare
   "Install Now".
5. Aspetta che finisca, poi "Close".

**Verifica** (in una finestra PowerShell **nuova** — chiudi quella vecchia e
riaprine una, sempre tasto Windows → scrivi `PowerShell` → Invio):
```
python --version
```
Deve rispondere `Python 3.12.x` o simile. Se dice "non riconosciuto", quasi
sempre è perché la casella del punto 4 non era spuntata: disinstalla Python
da "Impostazioni → App", e reinstallalo rifacendo attenzione a quel passaggio.

---

## Passo 3 — Installare uv

`uv` è lo strumento che scarica i "pezzi" di cui Python ha bisogno per questo
progetto.

1. Apri PowerShell (tasto Windows → `PowerShell` → Invio)
2. Incolla questo comando e premi Invio:
   ```
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
3. Aspetta che finisca (qualche secondo), poi **chiudi e riapri**
   PowerShell.

**Verifica:**
```
uv --version
```
Deve rispondere con qualcosa tipo `uv 0.11.x`.

---

## Passo 4 — Installare GitHub Desktop

Questo è il programma con cui scarichi il progetto, senza dover imparare i
comandi di Git.

1. Vai su **[desktop.github.com](https://desktop.github.com)**
2. Scarica e installa (doppio clic, poi segue da solo)
3. Alla prima apertura, accedi con l'account GitHub con cui hai accettato
   l'invito al passo "Prima di iniziare"

---

## Passo 5 — Scaricare il progetto

1. Apri **GitHub Desktop**
2. In alto: **File → Clone Repository**
3. Nella finestra che si apre, vai sulla scheda **"GitHub.com"** — dovresti
   vedere il progetto (si chiama **wardrobe**) nell'elenco. Selezionalo.
4. In basso scegli dove salvarlo sul tuo computer (va benissimo lasciare
   quello proposto, es. `C:\Users\TuoNome\Documents\GitHub\wardrobe`) e
   ricorda questo percorso: ti servirà tra un attimo.
5. Clicca **Clone**.

---

## Passo 6 — Aprire il terminale nella cartella del progetto

1. Apri **Esplora file** (l'icona della cartella gialla nella barra in
   basso) e vai nella cartella dove hai clonato il progetto (passo 5.4)
2. Tieni premuto **Shift** e fai **clic con il tasto destro** dentro la
   cartella (non su un file, nello spazio vuoto)
3. Scegli **"Apri finestra PowerShell qui"** (o su Windows 11, semplicemente
   "Apri nel terminale")

Da qui in poi, ogni comando di questa guida va scritto in questa finestra
(o in una nuova aperta nello stesso modo, nella stessa cartella).

---

## Passo 7 — Installare i "pezzi" del progetto (una volta sola)

Nella finestra PowerShell aperta al passo 6, scrivi ed esegui, uno alla
volta (aspetta che ognuno finisca prima del successivo — il primo impiega
qualche minuto):

```
npm install
```

```
npm run api:sync
```

Se durante `npm install` vedi righe gialle "warning" o messaggi grigi, va
tutto bene: sono normali, non sono errori. Un errore vero è scritto in rosso
e interrompe il comando.

---

## Passo 8 — Scrivere le due chiavi

1. In Esplora file, entra nella cartella `services`, poi `api` (quindi:
   `wardrobe\services\api`)
2. Trova il file **`.env.example`** (se non lo vedi, in alto in Esplora file
   clicca "Visualizza" → spunta "Estensioni nome file" e "Elementi
   nascosti")
3. Copialo (clic destro → Copia, poi clic destro nello spazio vuoto → Incolla)
4. Rinomina la copia (che si chiamerà tipo `.env.example - Copia`) in
   **`.env`** — attenzione: il nome deve essere esattamente `.env`, niente
   prima e niente dopo, nemmeno `.env.txt`
5. Apri `.env` con il **Blocco Note** (clic destro → Apri con → Blocco note)
6. Vedrai due righe:
   ```
   ANTHROPIC_API_KEY=
   FAL_KEY=
   ```
   Incolla la prima chiave che ti hanno mandato subito dopo il segno `=`
   della prima riga (senza spazi, senza virgolette), e la seconda (se te
   l'hanno data) dopo il segno `=` della seconda riga. Se non ti hanno dato
   la seconda chiave, lascia quella riga vuota così com'è: l'app funziona
   comunque, semplicemente non toglierà lo sfondo alle foto.
7. Salva (Ctrl+S) e chiudi il Blocco Note.

Questo file resta solo sul tuo computer: non finisce mai su GitHub (è
scritto apposta per essere ignorato).

---

## Passo 9 — Avviare il "cervello" dell'app

Torna alla finestra PowerShell del passo 6 (quella nella cartella
principale `wardrobe`, non dentro `services\api`). Scrivi:

```
npm run api:local
```

Dopo qualche secondo deve apparire una riga tipo:
```
API di Tela in ascolto su http://localhost:8787 (DEV_MODE, dati in memoria)
```

**Importante: lascia questa finestra aperta.** Se la chiudi, l'app smette di
funzionare. Puoi ridurla a icona, ma non chiuderla finché stai usando Tela.

---

## Passo 10 — Avviare l'app

Apri una **seconda** finestra PowerShell nella stessa cartella (ripeti il
Passo 6: Shift + clic destro nella cartella `wardrobe` → "Apri finestra
PowerShell qui"). In questa nuova finestra scrivi, in ordine:

```
$env:EXPO_PUBLIC_API_URL="http://localhost:8787"
```

```
npm run mobile:web
```

Dopo un po' (la prima volta può metterci un minuto o due) si apre da sola
una scheda del browser con l'app. Se non si apre da sola, nel testo che è
comparso cerca una riga con scritto `Web is waiting on http://localhost:...`
e apri quell'indirizzo a mano nel browser.

---

## Come si usa, in breve

- **Aggiungi** (in basso): fai una foto o scegline una dalla galleria di un
  capo di vestiario. Aspetta che venga letta — vedrai categoria, colore,
  tessuto proposti. Se qualcosa è scritto su sfondo corallo/arancione, il
  modello non ne è sicuro: toccalo per correggerlo.
  - Se la fotocamera dal browser non si apre o dà errore, usa "Dalla
    galleria" e scegli una foto che hai già (anche trasferita dal telefono).
- **Il tuo armadio**: tutti i capi aggiunti.
- **Chiedi a Tela**: scrivi qualcosa tipo *"Fa caldo, sto per uscire, cosa mi
  metto?"* e aspetta la risposta.

---

## Le prossime volte (versione corta)

Non serve rifare i passi 1-8. Ogni volta che vuoi riaprire Tela:

1. Apri PowerShell nella cartella del progetto (Passo 6), scrivi
   `npm run api:local`, lascia la finestra aperta
2. Apri una seconda finestra PowerShell nella stessa cartella, scrivi
   `$env:EXPO_PUBLIC_API_URL="http://localhost:8787"` poi `npm run mobile:web`

**Una cosa da sapere:** ogni volta che riavvii il punto 1, l'armadio torna
quello di partenza — in questa fase di prova i capi non si salvano in modo
permanente da un riavvio all'altro. È normale, non è un errore.

---

## Se qualcosa non funziona

| Cosa vedi | Cosa fare |
|---|---|
| "node non è riconosciuto..." | Node.js non si è installato bene, o serve riaprire PowerShell. Rifai la Verifica del Passo 1. |
| "python non è riconosciuto..." | Quasi sempre manca la spunta "Add python.exe to PATH": disinstalla e reinstalla Python (Passo 2), spuntando quella casella. |
| "uv non è riconosciuto..." | Riapri PowerShell (va fatto dopo aver installato uv). Se persiste, rifai il Passo 3. |
| Il browser dice "Non riesco a raggiungere il server" | Controlla che la finestra del Passo 9 sia ancora aperta e non mostri righe rosse di errore. |
| La fotocamera non si apre nel browser | Usa "Dalla galleria" invece di "Scatta", e scegli una foto già esistente. |
| Le foto restano con lo sfondo originale | Normale se non hai messo `FAL_KEY` al Passo 8 (è facoltativa) — l'app funziona lo stesso. |

Se un errore non è in questa tabella, copia il testo esatto (anche una
foto/screenshot va benissimo) e mandalo a chi ti ha dato questa guida.
