"""Il banco immagini, a pagamento: stessa foto, stessa istruzione, ogni modello.

    uv run python scripts/genera_immagini.py --stima
    uv run python scripts/genera_immagini.py --conferma

Di default stima e basta: non chiama nessun servizio, non spende niente.
Genera un'immagine per ogni (campione, modello) e la registra nel banco —
senza voto: il voto (1-5 su fedeltà colore, pulizia, artefatti) lo dà una
persona dopo, dalla schermata di valutazione (`POST /dev/immagini`). Questo
script produce le immagini e registra solo quanto sono costate.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RADICE / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(RADICE / ".env")

from adapters.filesystem import ArchivioFileSystem  # noqa: E402
from adapters.imagegen.google_nano_banana import (  # noqa: E402
    ServizioGenerazioneImmaginiGoogle,
    catalogo,
)
from adapters.postgres import RepositoryPostgres  # noqa: E402
from domain.errors import ErroreDominio  # noqa: E402
from domain.models import CampioneValutazione, ModelloImmagine, ValutazioneImmagine  # noqa: E402
from domain.valutazione import campioni_da_json  # noqa: E402

CAMPIONI_DEFAULT = RADICE / "tests" / "fixtures" / "campioni" / "campioni.json"

# La stessa istruzione per ogni modello: è quello che si sta confrontando.
# «Solo capo, senza persona» non è una preferenza estetica: è lo scope scelto
# per questo banco (vedi GUIDA.md) — nessun virtual try-on.
ISTRUZIONI_DEFAULT = (
    "Isola questo capo su uno sfondo bianco pulito e uniforme, da catalogo. "
    "Non modificare il capo: stessa forma, stesso colore, stesso materiale, "
    "stessi dettagli. Non aggiungere una persona, un manichino o un modello "
    "che lo indossi: resta un capo appoggiato o appeso, come nella foto "
    "originale."
)


def _repository() -> RepositoryPostgres:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit(
            "manca DATABASE_URL: avvia Postgres con `npm run db:up` e riprova — "
            "un run a pagamento senza un posto dove salvare i risultati non serve a niente"
        )
    return RepositoryPostgres(dsn=dsn)


def _archivio() -> ArchivioFileSystem:
    cartella = os.environ.get("CARTELLA_FOTO")
    if not cartella:
        raise SystemExit(
            "manca CARTELLA_FOTO: imposta la stessa cartella di `npm run api:local`, "
            "così le immagini generate sopravvivono al riavvio e la schermata di "
            "valutazione le può leggere"
        )
    return ArchivioFileSystem(cartella)


def _modelli_da_valutare(filtro: str | None) -> list[ModelloImmagine]:
    tutti = catalogo(configurato=bool(os.environ.get("GOOGLE_API_KEY")))
    if filtro is None:
        return [m for m in tutti if m.configurato]

    richiesti = [pezzo.strip() for pezzo in filtro.split(",") if pezzo.strip()]
    scelti: list[ModelloImmagine] = []
    for richiesta in richiesti:
        trovato = next((m for m in tutti if m.id == richiesta), None)
        if trovato is None:
            raise SystemExit(f"modello sconosciuto: «{richiesta}»")
        if not trovato.configurato:
            raise SystemExit(f"«{richiesta}» non è configurato (manca GOOGLE_API_KEY)")
        scelti.append(trovato)
    return scelti


def _stampa_stima(modelli: list[ModelloImmagine], n_campioni: int) -> None:
    print(f"Stima costi su {n_campioni} campioni:\n")
    totale = 0.0
    for modello in modelli:
        if modello.costo_eur_immagine is None:
            print(f"  {modello.id:28}  prezzo sconosciuto")
            continue
        costo = modello.costo_eur_immagine * n_campioni
        totale += costo
        print(f"  {modello.id:28}  ~{costo:.4f} EUR")
    print(f"\nTotale stimato: ~{totale:.4f} EUR")
    print("\nNessuna chiamata effettuata. Rilancia con --conferma per spendere davvero.")


def _leggi_foto(cartella_campioni: Path, nome_file: str) -> bytes | None:
    percorso = cartella_campioni / "foto" / nome_file
    if not percorso.exists():
        return None
    return percorso.read_bytes()


def _esegui_run(
    modelli: list[ModelloImmagine],
    campioni: list[CampioneValutazione],
    cartella_campioni: Path,
    run_id: str,
    repo: RepositoryPostgres,
    archivio: ArchivioFileSystem,
    istruzioni: str,
) -> None:
    servizio = ServizioGenerazioneImmaginiGoogle()

    for campione in campioni:
        contenuto = _leggi_foto(cartella_campioni, campione.foto)
        if contenuto is None:
            print(f"[{campione.id}] manca la foto «{campione.foto}»: saltato")
            continue

        for modello in modelli:
            inizio = time.monotonic()
            errore: str | None = None
            risultato: bytes | None = None
            try:
                risultato = servizio.genera(contenuto, "image/jpeg", istruzioni, modello.id)
            except ErroreDominio as exc:
                errore = str(exc)
            latenza_ms = int((time.monotonic() - inizio) * 1000)

            chiave_immagine = None
            if risultato is not None:
                chiave_immagine = f"valutazioni/{run_id}/{campione.id}-{modello.id}.jpg"
                archivio.salva(chiave_immagine, risultato, "image/jpeg")

            valutazione = ValutazioneImmagine(
                id=uuid.uuid4().hex,
                run_id=run_id,
                eseguita_il=datetime.now(UTC),
                campione_id=campione.id,
                servizio=modello.servizio,
                modello=modello.id,
                chiave_immagine=chiave_immagine,
                costo_eur=modello.costo_eur_immagine if risultato is not None else None,
                latenza_ms=latenza_ms,
                errore=errore,
            )
            repo.salva_valutazione_immagine(valutazione)
            esito = "ok" if risultato is not None else f"errore: {errore}"
            print(f"[{campione.id}] {modello.id}: {esito}, {latenza_ms} ms")

    salvate = len(repo.elenca_valutazioni_immagini(run_id))
    print(f"\nRun «{run_id}» salvato: {salvate} immagini. Vota da GET/POST /dev/immagini.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--conferma", action="store_true", help="chiama davvero il servizio")
    parser.add_argument(
        "--stima", action="store_true", help="solo stima, non chiama nessuno (default)"
    )
    parser.add_argument("--modelli", help="lista di id modello separata da virgole")
    parser.add_argument("--campioni", type=Path, default=CAMPIONI_DEFAULT)
    parser.add_argument("--run-id", dest="run_id", default=None)
    parser.add_argument("--istruzioni", default=ISTRUZIONI_DEFAULT)
    args = parser.parse_args()

    if args.conferma and args.stima:
        raise SystemExit("--conferma e --stima sono alternativi")

    grezzo = json.loads(args.campioni.read_text(encoding="utf-8"))
    campioni = campioni_da_json(grezzo)
    modelli = _modelli_da_valutare(args.modelli)
    if not modelli:
        raise SystemExit("nessun modello da valutare: configura GOOGLE_API_KEY")

    if not args.conferma:
        _stampa_stima(modelli, len(campioni))
        return

    repo = _repository()
    archivio = _archivio()
    run_id = args.run_id or f"run-img-{datetime.now(UTC):%Y%m%d-%H%M%S}"
    _esegui_run(modelli, campioni, args.campioni.parent, run_id, repo, archivio, args.istruzioni)


if __name__ == "__main__":
    main()
