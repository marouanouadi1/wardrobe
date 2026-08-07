"""Il banco di valutazione, a pagamento: stessa foto, stesso prompt, ogni modello.

    uv run python scripts/valuta_modelli.py --stima
    uv run python scripts/valuta_modelli.py --conferma
    uv run python scripts/valuta_modelli.py --conferma \
        --modelli anthropic:claude-opus-5,google:gemini-pro-latest

Di default stima e basta: non chiama nessun provider, non spende niente.
Serve `--conferma` per far girare le chiamate vere. La lettura di ogni
modello su ogni campione viene giudicata contro `campioni.json` (vedi
`tests/fixtures/campioni/GUIDA.md`) e salvata nel banco — la stessa tabella
che legge `GET /dev/valutazioni`.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RADICE / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(RADICE / ".env")

from adapters.llm.registry import catalogo, provider_per_nome, scheda_modello  # noqa: E402
from adapters.postgres import RepositoryPostgres  # noqa: E402
from domain.models import (  # noqa: E402
    CampioneValutazione,
    JobIa,
    ModelloDisponibile,
    RichiestaPlayground,
)
from domain.playground import esegui  # noqa: E402
from domain.ports import ImmagineLlm  # noqa: E402
from domain.valutazione import aggrega, campioni_da_json, valuta  # noqa: E402

CAMPIONI_DEFAULT = RADICE / "tests" / "fixtures" / "campioni" / "campioni.json"

# Non calibrati su una chiamata vera: servono solo a dare un ordine di
# grandezza prima di spendere. Una foto di capo in base64 più un prompt
# breve, una risposta JSON di sette campi — sono questi i due numeri che
# `--stima` non può conoscere finché non è già girato almeno un run vero (nel
# qual caso usa il costo medio reale di quel run, vedi `_stima_riga`).
TOKEN_INPUT_STIMATI = 1600
TOKEN_OUTPUT_STIMATI = 500


def _repository() -> RepositoryPostgres:
    import os

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit(
            "manca DATABASE_URL: avvia Postgres con `npm run db:up` e riprova — "
            "un run a pagamento senza un posto dove salvare i risultati non serve a niente"
        )
    return RepositoryPostgres(dsn=dsn)


def _modelli_da_valutare(filtro: str | None) -> list[ModelloDisponibile]:
    tutti = catalogo()
    if filtro is None:
        return [m for m in tutti if m.visione and m.configurato]

    richiesti = [pezzo.strip() for pezzo in filtro.split(",") if pezzo.strip()]
    scelti: list[ModelloDisponibile] = []
    for richiesta in richiesti:
        provider, _, modello = richiesta.partition(":")
        trovato = scheda_modello(provider, modello)
        if trovato is None:
            raise SystemExit(f"modello sconosciuto: «{richiesta}» (atteso provider:modello)")
        if not trovato.configurato:
            raise SystemExit(f"«{richiesta}» non è configurato (manca la chiave del provider)")
        scelti.append(trovato)
    return scelti


def _storico_costi(repo: RepositoryPostgres) -> dict[tuple[str, str], float]:
    ultimo = repo.ultimo_run_valutazione()
    if ultimo is None:
        return {}
    righe = aggrega(repo.elenca_valutazioni(ultimo))
    return {
        (riga.provider, riga.modello): riga.costo_medio_eur
        for riga in righe
        if riga.costo_medio_eur is not None
    }


def _stima_riga(modello: ModelloDisponibile, storico: dict[tuple[str, str], float]) -> float | None:
    per_campione = storico.get((modello.provider, modello.id))
    if per_campione is not None:
        return per_campione
    if modello.costo_input_eur_mtok is None or modello.costo_output_eur_mtok is None:
        return None
    ingresso = modello.costo_input_eur_mtok * TOKEN_INPUT_STIMATI / 1_000_000
    uscita = modello.costo_output_eur_mtok * TOKEN_OUTPUT_STIMATI / 1_000_000
    return ingresso + uscita


def _stampa_stima(
    modelli: list[ModelloDisponibile], n_campioni: int, repo: RepositoryPostgres
) -> None:
    storico = _storico_costi(repo)
    fonte = "dal run precedente" if storico else "stimati, non calibrati"
    print(f"Stima costi ({fonte}) su {n_campioni} campioni:\n")
    totale = 0.0
    ignoti = 0
    for modello in modelli:
        per_campione = _stima_riga(modello, storico)
        if per_campione is None:
            print(f"  {modello.provider:10} {modello.id:28}  prezzo sconosciuto")
            ignoti += 1
            continue
        costo = per_campione * n_campioni
        totale += costo
        print(f"  {modello.provider:10} {modello.id:28}  ~{costo:.4f} EUR")
    extra = f" (+ {ignoti} a prezzo sconosciuto)" if ignoti else ""
    print(f"\nTotale stimato: ~{totale:.4f} EUR{extra}")
    print("\nNessuna chiamata effettuata. Rilancia con --conferma per spendere davvero.")


def _leggi_foto(cartella_campioni: Path, nome_file: str) -> bytes | None:
    percorso = cartella_campioni / "foto" / nome_file
    if not percorso.exists():
        return None
    return percorso.read_bytes()


def _esegui_run(
    modelli: list[ModelloDisponibile],
    campioni: list[CampioneValutazione],
    cartella_campioni: Path,
    run_id: str,
    repo: RepositoryPostgres,
) -> None:
    for campione in campioni:
        contenuto = _leggi_foto(cartella_campioni, campione.foto)
        if contenuto is None:
            print(f"[{campione.id}] manca la foto «{campione.foto}»: saltato")
            continue

        immagine = ImmagineLlm(media_type="image/jpeg", base64=base64.b64encode(contenuto).decode())

        for modello in modelli:
            richiesta = RichiestaPlayground(
                job=JobIa.ANALISI_CAPO,
                provider=modello.provider,
                modello=modello.id,
                # Gli stessi valori di default di `domain.vision.richiesta_analisi`:
                # il banco misura quello che il prodotto fa davvero, non il
                # preset di test del playground (`analisi-foto-capo`), che è
                # regolabile a mano e può divergere.
                temperatura=0.2,
                max_token=1500,
                chiave_foto=campione.foto,
            )
            esito = esegui(
                richiesta,
                provider_per_nome(modello.provider),
                immagine=immagine,
                costo_input_eur_mtok=modello.costo_input_eur_mtok,
                costo_output_eur_mtok=modello.costo_output_eur_mtok,
            )
            valutazione = valuta(
                esito,
                campione,
                valutazione_id=uuid.uuid4().hex,
                run_id=run_id,
                eseguita_il=datetime.now(UTC),
                modello=modello.id,
            )
            repo.salva_valutazione(valutazione)
            costo = f"{valutazione.costo_eur:.4f} EUR" if valutazione.costo_eur else "?"
            print(
                f"[{campione.id}] {modello.provider}/{modello.id}: "
                f"{valutazione.esito.value}, accuratezza {valutazione.accuratezza:.2f}, "
                f"{valutazione.latenza_ms} ms, {costo}"
            )

    print(f"\nRun «{run_id}» salvato. Tabella aggregata:\n")
    for riga in aggrega(repo.elenca_valutazioni(run_id)):
        print(
            f"  {riga.provider:10} {riga.modello:28}  accuratezza {riga.accuratezza_media:.2f}  "
            f"inventati {riga.inventati}  costo medio "
            f"{riga.costo_medio_eur if riga.costo_medio_eur is not None else '?'}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--conferma", action="store_true", help="chiama davvero i provider")
    parser.add_argument(
        "--stima", action="store_true", help="solo stima, non chiama nessuno (default)"
    )
    parser.add_argument("--modelli", help="lista provider:modello separata da virgole")
    parser.add_argument("--campioni", type=Path, default=CAMPIONI_DEFAULT)
    parser.add_argument("--run-id", dest="run_id", default=None)
    args = parser.parse_args()

    if args.conferma and args.stima:
        raise SystemExit("--conferma e --stima sono alternativi")

    grezzo = json.loads(args.campioni.read_text(encoding="utf-8"))
    campioni = campioni_da_json(grezzo)
    modelli = _modelli_da_valutare(args.modelli)
    if not modelli:
        raise SystemExit("nessun modello da valutare: configura almeno un provider")

    repo = _repository()

    if not args.conferma:
        _stampa_stima(modelli, len(campioni), repo)
        return

    run_id = args.run_id or f"run-{datetime.now(UTC):%Y%m%d-%H%M%S}"
    _esegui_run(modelli, campioni, args.campioni.parent, run_id, repo)


if __name__ == "__main__":
    main()
