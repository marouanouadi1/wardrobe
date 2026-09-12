# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

**Le versioni non si scrivono qui a mano**: le alza la pipeline di rilascio dai
conventional commit (`docs/adr/0005`). Qui si scrive **cosa è cambiato per chi usa
il prodotto**, con una riga in `## Non rilasciato` nella stessa PR che fa il
cambiamento.

Le sezioni sono tre perché ci sono **due flussi di versione indipendenti**
(`mobile-v*` e `api-v*`): un elenco unico lineare mentirebbe su cosa è stato
rilasciato e quando.

La storia precedente al 2026-09-11 vive nei tag e nei messaggi di commit e **non
è stata ricostruita qui a posteriori**: una ricostruzione è una supposizione
travestita da registro.

## Non rilasciato

### mobile
- `BottonePrimario` ha la variante `pericolo` (sfondo corallo, testo crema): la
  conferma di `Avviso` non ridipinge più il fondo dal punto di chiamata.
- Corretto `BottonePrimario`: `sfondo` e `su` venivano da due ternarie con una
  precedenza diversa, e `pericolo + disabilitato` dipingeva un fondo chiaro
  dichiarando `su="scuro"` a chi ci stava dentro. Una sola `variante` decide
  ora entrambi, insieme al colore del testo.
- Il gate `test/convenzioni/primitive.test.ts` non legge più i sorgenti come
  testo (un regex che si fermava alla prima `>`, quasi sempre quella di
  `onPress={() => …}` su una chiamata multi-riga) ma con l'AST di TypeScript,
  e non controlla più un elenco di primitive scritto a mano: lo deriva da
  `src/ui/**`. Ha trovato due primitive dimenticate (`Campo`, `BarraChiedi`)
  e una terza mai considerata (`PiedeFoto`); `BottoneSecondario`, che dipinge
  un fondo senza asserire un `<Fondo>`, resta controllato come eccezione
  dichiarata, col motivo scritto accanto.
- Ripristinati in `overrides` alla radice i pin di `typescript` e
  `react-native-worklets`, cancellati per errore insieme all'aggiunta di
  `react`/`react-test-renderer`.
- Il gate sulle primitive copre anche la prop `sfondo`, non solo `style`:
  `Scheda` e `SchedaFoto` la accettano e calcolano `su` per conto loro, quindi
  `<Scheda sfondo={colori.inchiostro}>` dipingeva una card quasi nera
  dichiarando `chiaro` a chi ci stava dentro. I tre punti di chiamata che
  passavano `sfondo` senza `su` ora lo dicono — tutti e tre su fondo chiaro,
  quindi nessun pixel cambia: cambia che adesso è scritto.
- `PALETTE_BOTTONE_PRIMARIO` usa `velo(colori.inchiostro, 0.08)` e
  `testoSu.chiaro.debole` invece dei due `rgba()` identici scritti a mano.

### api
- (niente di visibile: solo l'ordine dei gate di coverage in CI. La soglia
  aggregata si applicava *dentro* lo step Pytest, e quando scattava saltava le
  due soglie per sottoalbero — il gate più debole nascondeva i due che contano.
  Ora è l'ultima.)

### progetto
- Lo stato del progetto vive in `docs/PROGRESS.md`, `docs/QUESTIONI.md`,
  `docs/DOMANDE_APERTE.md` e `docs/TEST_COVERAGE.md` invece che nel README.
- Gli standard per area vivono in `.claude/rules/`; `CLAUDE.md` resta la sintesi.
- Corretta in `CLAUDE.md` la regola di `su`, che descriveva ancora il regime
  precedente al commit `ee7f492`.
- Tre gate nuovi in CI, tutti verdi al primo giro: soglie di coverage sul backend
  (totale, dominio, handler), i primi test dell'app, e un controllo che i numeri
  dichiarati nelle docs siano quelli veri.
- Quattro hook: due che impediscono (una versione alzata a mano, una migrazione
  non idempotente), uno che verifica i contratti a fine sessione, uno che porta
  il linter dentro il ciclo di chi scrive.
- `docs/DA_FARE.md`: il lavoro trovato mentre se ne fa un altro, scritto subito
  invece che ricordato. Assorbe i «debiti dichiarati» che stavano in
  `PROGRESS.md`, che torna a dire solo cosa esiste.
- **Prima di aggirare un problema, si prova a toglierlo** (`docs/adr/0008`): la
  regola che viene prima delle altre, ripetuta di proposito in `CLAUDE.md`, nelle
  cinque rules e in tutti e nove gli agenti.
- **Gli hook adesso si eseguono, non si leggono** — `scripts/prova-hook.py`, nel
  job `hook` di `docs.yml`. Erano gli unici gate del progetto senza copertura, e
  la conseguenza era arrivata puntuale: negavano tre migrazioni corrette (due
  spazi prima di `if not exists`; un `default` scritto prima di `not null`;
  qualunque riscrittura integrale di `pyproject.toml`, anche a versione
  identica) e ne lasciavano passare tre rotte (`numeric(10,2) not null`, un
  `not null` composto su due `Edit` successive, e `drop table if exists` — che
  le regole del repo vogliono si chieda all'utente).
- Un diniego di un hook adesso **dice perché**: era tutto in `systemMessage`,
  che è un avviso all'utente, e arrivava all'agente come «Hook PreToolUse:Write
  denied this tool». Chi non sa cosa ha sbagliato può solo riprovare alla cieca.
- Il gate sui contratti scatta anche a fine subagente (`SubagentStop`) e anche
  quando il lavoro è già stato committato: guardava solo il working tree, cioè
  era cieco proprio nel flusso che questo repo prescrive.
- `deny` estesa alle operazioni distruttive che CLAUDE.md nomina e la lista non
  aveva: `git clean`, `git push -f`, `docker compose down -v`, `docker volume
  rm|prune`; più `Edit(./.claude/**)` e un glob solo per tutti i file
  d'ambiente.
- L'URL dell'APK che EAS restituisce non viene più interpolato dentro il `run:`
  che lo scarica: passa da `env:`, e schema e dominio si controllano prima di
  seguirlo. Era l'ultimo punto in cui un valore di provenienza esterna finiva
  nel testo di uno script, in un job che ha `contents: write` e `GH_TOKEN`.
- Il permesso di scrivere sul repo non è più dichiarato a livello di workflow:
  `api.yml` e `mobile.yml` hanno `contents: read` alla radice e
  `contents: write` dentro il solo job che rilascia. I job che eseguono il
  codice della PR — `quality`, `contracts`, `checks` e i due di `docs.yml` —
  fanno checkout con `persist-credentials: false`, così il token non resta nel
  `.git/config` del runner mentre quel codice gira.
