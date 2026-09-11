# Standard CI e rilascio

Lo legge: `ci-cd`, e `reviewer` quando il diff tocca `.github/`.


## Prima di aggirare un problema, chiedi se puoi toglierlo

> Se togliessi la mia soluzione, il problema tornerebbe? Se sì, è un **tampone**:
> la causa è ancora dove era.

Un tampone è legittimo quando la causa non si può togliere adesso — ma allora si
**dichiara** dov'è, si apre la voce del rimedio in `docs/DA_FARE.md`, e quando il
rimedio arriva **il tampone si toglie**.

Il segnale che distingue i due casi: **il rimedio toglie righe, il tampone ne
aggiunge.**

Per esteso, con l'esempio, in `CLAUDE.md` e in `docs/adr/0008`.

## L'invariante

**`api.yml` e `mobile.yml` sono due pipeline indipendenti che possono scattare
insieme sulla stessa PR** (succede ogni volta che si tocca
`packages/contracts/**`). Ogni modifica va pensata per il minuto in cui l'altra
sta pushando su `main`.

## Un merge su `main` è un rilascio

Non c'è un passaggio manuale fra il merge e la produzione:

- merge che tocca `services/api/**` → bump, `rsync` sul VPS,
  `docker compose up -d --build`, **verifica di `GET /salute`**, poi commit e tag
- merge che tocca `apps/mobile/**` → bump, build EAS Android, GitHub Release

Prima di modificare qualunque file dentro un filtro `paths:`, sappi che stai
toccando la catena che rilascia.

## Le versioni non si scrivono a mano

`apps/mobile/app.json` (`expo.version`) e `services/api/pyproject.toml`
(`version`) sono scritti **solo** da `scripts/bump-versione.mjs`, che deduce
major/minor/patch dai conventional commit dall'ultimo tag. Il perché sta in
`docs/adr/0005-le-versioni-vengono-dai-commit.md`: *un numero che si alza sempre
di uno non è una versione, è un contatore di merge.*

Un hook `PreToolUse` nega la scrittura di quei due campi. Toccare le dipendenze
in `pyproject.toml` o la configurazione Expo in `app.json` resta libero.

## I titoli delle PR sono conventional, e non è formalismo

`pr-title.yml` valida
`^(feat|fix|chore|docs|refactor|test|perf|build|ci|revert)(\([a-z0-9-]+\))?!?: .+`
**senza filtro sui path**: è una regola del repo, non di una sottocartella, e una
PR di sole docs la rispetta come le altre.

Il livello di bump viene da lì: `feat` alza il minor, il resto il patch, un `!` o
un `BREAKING CHANGE:` nel corpo segnala una rottura. Senza questo check la
deduzione sarebbe teatro — un titolo non conventional cadrebbe su «patch» per
default, cioè il comportamento che si voleva lasciare indietro.

I merge di questo repo **non sono squash**, quindi il titolo della PR finisce nel
corpo del merge commit: è lì che lo script lo legge.

## I sei invarianti del rilascio — non romperli

1. **`fetch-depth: 0`** nei job di release. Senza, lo script non vede i tag e
   rilascia sempre patch.
2. **`[skip ci]`** nel messaggio del commit di bump: quel commit tocca path che
   sono nei filtri dello stesso workflow, quindi senza si rimetterebbe in coda da
   solo.
3. **Rebase + retry attorno al push su `main`**, non un concurrency group
   condiviso. I due workflow possono pushare nello stesso minuto: aggiungere un
   gruppo condiviso con `cancel-in-progress` farebbe sì che **una release ne
   cancelli un'altra invece di accodarla**. (Il `concurrency` che c'è oggi in
   ciascun workflow è per-ref e per-workflow: va bene così.)
4. **Il tag è lightweight**: `git push origin HEAD:main` non lo porta con sé,
   serve un `git push origin "$TAG"` esplicito. Nel retry il tag si sposta sul
   commit riscritto con `git tag -f`.
5. **`uv lock` dopo il bump**: il lockfile registra la versione del pacchetto, e
   lasciarlo indietro rimetterebbe in circolo la stessa bugia che il versioning
   doveva togliere.
6. **Commit e tag per ultimi, a deploy verificato.** `GET /salute` riporta la
   versione dai metadati del pacchetto e viene confrontata con quella attesa: si
   marca la storia solo dopo che il server serve davvero quel numero.

## Il titolo di una PR è testo arbitrario

In `pr-title.yml` il titolo arriva allo script via `env:`, **non** interpolato
dentro `run:`. Un `${{ }}` in un `run:` è sostituzione testuale *prima* che la
shell parta, e un titolo di PR può contenere backtick e `$(...)`. Vale per
qualunque input controllato dall'esterno che finisca in uno step.

## I filtri sui path

`api.yml` → `services/api/**`, `packages/contracts/**`, sé stesso.
`mobile.yml` → `apps/mobile/**`, `packages/contracts/**`, `package.json`,
`package-lock.json`, sé stesso.

È anche il motivo per cui questo monorepo **non ha bisogno di Nx o Turborepo**:
due workflow indipendenti e due gestori di pacchetti (npm e uv) che convivono
senza mediatori.

**Un gate che deve valere per tutto il repo non va in nessuno dei due**, perché
una PR di sole docs non li farebbe partire. Va in un workflow senza filtro — è il
caso di `pr-title.yml` e di `docs.yml`.

## Una regola che la CI non fa fallire non è una regola

Se stai aggiungendo un vincolo, la domanda è: **quale job diventa rosso quando
qualcuno lo viola?** Se la risposta è «nessuno», il vincolo è una buona
intenzione.

E il verso opposto, altrettanto importante: **non si accende un gate rosso.** Un
gate che fallisce al primo giro viene disattivato. Prima si sana la realtà, poi
si accende il gate — verde, e pronto a diventare rosso.

Un gate che non può ancora girare si **dichiara saltato con il motivo**, mai
omesso in silenzio.
