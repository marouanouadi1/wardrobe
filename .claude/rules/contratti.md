# Standard contratti — `packages/contracts`

Lo legge: `contracts` sempre; `api` e `mobile` quando il task attraversa il
confine fra backend e app.


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

**Sotto `packages/contracts/` si scrive a mano solo il cablaggio** —
`src/index.ts` che espone i file generati, `package.json`, gli script dei
generatori. Tutto il resto è l'output di `npm run contracts:generate` e, per i
dati salvati su Supabase, di `npm run supabase:tipi`. Un tipo scritto a mano lì
dentro è una seconda fonte di verità in incubazione.

## Durante il passaggio a Supabase: una seconda fonte, con un confine

Dal 2026-09-25 (ADR 0010) i **dati salvati** hanno come fonte lo schema SQL di
`supabase/migrations/`. I loro tipi TypeScript li scrive `npm run supabase:tipi`
(`supabase gen types`) in `packages/contracts/src/generated/database.ts`, e il job
`database` della CI rigenera e confronta, come `contracts:check` fa per l'altra catena.

Pydantic resta la fonte di ciò che attraversa il backend dell'IA. Le enum e i limiti
che esistono in entrambi li confronta `services/api/scripts/verifica_database.py`: un
valore aggiunto da una parte sola fa diventare rosso quel job.

`database.ts` è output come gli altri file di `src/generated/`: non si tocca a mano.

## La catena, in tre passi e due linguaggi

```
services/api/src/domain/models.py          ← la fonte di verità
        │  uv run python scripts/export_schema.py
        ▼
packages/contracts/schema/*.json           ← contratti.json · _enums.json · _costanti.json
        │  packages/contracts/scripts/generate.mjs  (json-schema-to-typescript)
        ▼
packages/contracts/src/generated/*.ts      ← modelli.ts · runtime.ts
```

`npm run contracts:check` rigenera in memoria e confronta col committato: esce 1
se divergono, ed è un job a sé in `.github/workflows/api.yml`.

**Dopo ogni modifica a `domain/models.py`: `npm run contracts:generate`, e si
committano i file rigenerati nella stessa PR.**

## Perché salta fuori solo alla fine

Un cambio a `models.py` senza rigenerazione passa `ruff`, passa `mypy`, passa
`pytest`, e passa anche il typecheck dell'app — che sta ancora leggendo i tipi
vecchi. Muore **solo** nel job `contracts`. È l'unico modo di rompere la CI dopo
che tutto il resto è verde, ed è il motivo per cui questa è una catena obbligata
e non un promemoria.

## Cosa attraversa il confine, e come

La decisione **non** vive in `models.py`: vive nelle tuple di
`services/api/scripts/export_schema.py`.

| Tupla | Modalità | Effetto in TypeScript |
|---|---|---|
| `RISPOSTE` | `serialization` | una risposta la serializziamo **sempre per intero**, quindi ogni campo c'è: in TS è **obbligatorio** |
| `RICHIESTE` | `validation` | la richiesta la costruisce l'app, e i campi con default sono omissibili: in TS sono **opzionali** |
| `ENUM` | — | i valori **in ordine**, esportati come array runtime |
| `COSTANTI` | — | `SOGLIA_INCERTEZZA`, `SOGLIA_SCARTO`, `MESI_PER_DORMIENTE` |

La distinzione non è cosmetica: generare obbligatori i campi di una richiesta
costringerebbe a scrivere sette `null` per correggere un attributo.

**Un modello interno resta fuori.** Le porte, le richieste ai provider: non
attraversano il confine. Come dice il file: *un contratto generoso è un contratto
che nessuno rispetta.*

## `_senza_titoli_di_campo()` — e come si riconosce che si è rotta

Pydantic mette un `title` su ogni campo. Senza pulirlo, il generatore TypeScript
trasforma ogni campo titolato in un tipo con nome proprio.

**Sintomo:** nel diff di `src/generated/modelli.ts` compaiono alias come `Id`,
`Nome`, `Nome1`, `Hex`, `StatoCapo1`, `StatoCapo2`. Sono nomi generici che
qualcuno prima o poi importa per sbaglio.

**Causa:** è rientrato un `title` o un `default` nello schema. Anche il `default`
va tolto — un campo con `$ref` più `default` non è più un semplice alias e il
generatore ne fa un tipo nuovo. In TypeScript l'opzionalità la esprime già
`required`.

**Non si subisce il diff: si corregge la pulizia.** Chi rigenera **legge** il
diff generato prima di committarlo.

## Le soglie non si riscrivono a mano

`SOGLIA_INCERTEZZA` vive nel dominio Python e l'app la importa da
`@wardrobe/contracts`. Riscrivere `86` in TypeScript significa che un giorno le
due divergeranno in silenzio, e nessuno se ne accorgerà.

## Le enum: quattro posti, una fonte

Questa regola sta **qui e solo qui**; gli altri file la citano.

| Dove | Cosa |
|---|---|
| `services/api/src/domain/models.py` | la definizione — **la fonte** |
| `supabase/migrations/` | la stessa enum come tipo Postgres, per i dati salvati: **la confronta `verifica_database.py`** nel job `database`, valori e ordine |
| `@wardrobe/contracts` → `runtime.ts` | `VALORI_TIPO_CAPO`, `VALORI_ATTRIBUTO_CAPO`, … — i valori **in ordine** |
| `apps/mobile/src/dati/dominio.ts` | `TIPI_CAPO`, `STAGIONI` — l'ordine di presentazione |
| `apps/mobile/src/tema/tokens.ts` | `ETICHETTE` — le rese italiane |

**Non ridigitare un elenco di valori**: prendilo da uno di questi. Due copie
della stessa enum divergono in silenzio — è già successo, in una schermata
interna poi rimossa col playground.

E attenzione al verso opposto: **una enum che cresce nel backend non compare da
sola** in `dominio.ts` né in `ETICHETTE`. Se il tuo cambiamento tocca una enum,
quei due file vanno guardati nello stesso passaggio.

## Non si scrive mai a mano

`packages/contracts/src/generated/**` e `packages/contracts/schema/**` sono
output: si toccano solo rilanciando il generatore.
