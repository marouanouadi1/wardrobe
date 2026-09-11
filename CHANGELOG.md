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

### api
- (niente: solo soglie di CI, nessun cambiamento di comportamento)

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
