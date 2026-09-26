"""Il database e il dominio Python dicono le stesse cose? (ADR 0010)

    uv run python scripts/verifica_database.py      # contro lo stack locale

Le enum, la mappa tipo → slot, i limiti delle misure, il formato del colore e
l'intervallo delle confidenze esistono in due posti: nello schema di Supabase
(`supabase/migrations/`), che è la fonte per i dati salvati, e in
`domain/models.py` e `domain/wardrobe.py`, che l'IA usa per leggere le foto e
proporre outfit. Due copie senza un confronto divergono in silenzio — è già
successo con `MESI_PER_DORMIENTE` — quindi questo script le confronta e **esce
1** alla prima differenza. Gira nel job `database` della CI.

I vincoli non si leggono dal testo dei CHECK: si provano. Un valore al bordo
deve passare, uno appena fuori no — da entrambe le parti, database e Pydantic.

Solo contro lo stack locale, di proposito: per provare i vincoli inserisce un
utente e i suoi dati, dentro una transazione che poi annulla. Sul progetto vero
non ha niente da fare.
"""

from __future__ import annotations

import sys
import uuid
from enum import StrEnum
from pathlib import Path

RADICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RADICE / "src"))

import psycopg  # noqa: E402
from psycopg import sql  # noqa: E402
from pydantic import TypeAdapter, ValidationError  # noqa: E402

from domain import models  # noqa: E402
from domain.wardrobe import slot_da_tipo  # noqa: E402

# Il database di `supabase start`: porta 54322, credenziali fisse dello stack locale.
DSN_LOCALE = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

Connessione = psycopg.Connection[tuple[object, ...]]

ENUM: dict[str, type[StrEnum]] = {
    "tipo_capo": models.TipoCapo,
    "slot_avatar": models.SlotAvatar,
    "stagione": models.Stagione,
    "stato_capo": models.StatoCapo,
    "attributo_capo": models.AttributoCapo,
    "origine_outfit": models.OrigineOutfit,
    "ruolo_chat": models.RuoloChat,
    "stato_segnalazione": models.StatoSegnalazione,
    "stato_analisi": models.StatoAnalisi,
    "sistema_taglie": models.SistemaTaglie,
    "taglia": models.Taglia,
    "corporatura": models.Corporatura,
    "unita_lunghezza": models.UnitaLunghezza,
}

COLONNE_MISURE = {
    "altezza": "altezza_cm",
    "spalle": "spalle_cm",
    "lunghezza_gamba": "lunghezza_gamba_cm",
}

# Valori al bordo e appena fuori, per ciascuno dei due vincoli sul capo.
COLORI = ["#A1B2C3", "#a1b2c3", "#000000", "A1B2C3", "#A1B2C", "#A1B2C3D", "#GGGGGG", "nero"]
CONFIDENZE = [0, 100, -1, 101]


def confronta_enum(conn: Connessione) -> list[str]:
    differenze = []
    for nome, enum in ENUM.items():
        riga = conn.execute(
            sql.SQL("select enum_range(null::public.{})::text[]").format(sql.Identifier(nome))
        ).fetchone()
        valori = riga[0] if riga else None
        nel_database = [str(valore) for valore in valori] if isinstance(valori, list) else []
        in_python = [valore.value for valore in enum]
        if nel_database != in_python:
            differenze.append(f"enum {nome}: database {nel_database}, Python {in_python}")
    return differenze


def confronta_slot(conn: Connessione) -> list[str]:
    differenze = []
    for tipo in models.TipoCapo:
        riga = conn.execute(
            "select privato.slot_da_tipo(%s::public.tipo_capo)::text", (tipo.value,)
        ).fetchone()
        nel_database = riga[0] if riga else None
        in_python = slot_da_tipo(tipo).value
        if nel_database != in_python:
            differenze.append(f"slot di {tipo.value}: database {nel_database}, Python {in_python}")
    return differenze


def _accettato(
    conn: Connessione, istruzione: sql.SQL | sql.Composed, parametri: tuple[object, ...]
) -> bool:
    """Prova una scrittura in un savepoint: `True` se il vincolo la lascia passare."""
    try:
        with conn.transaction():
            conn.execute(istruzione, parametri)
    except psycopg.errors.CheckViolation:
        return False
    return True


def _pydantic_accetta(tipo: object, valore: object) -> bool:
    try:
        TypeAdapter(tipo).validate_python(valore)
    except ValidationError:
        return False
    return True


def _si_no(valore: bool) -> str:
    return "sì" if valore else "no"


def confronta_vincoli(conn: Connessione) -> list[str]:
    differenze = []
    utente = uuid.uuid4()
    with conn.transaction(force_rollback=True):
        # Un utente di prova: il suo profilo nasce dal trigger, e sparisce con
        # il rollback insieme a lui e ai suoi capi.
        conn.execute(
            "insert into auth.users (id, email, aud, role)"
            " values (%s, %s, 'authenticated', 'authenticated')",
            (utente, f"verifica-{utente}@esempio.invalid"),
        )

        for misura, limiti in models.LIMITI_MISURE_CM.items():
            colonna = COLONNE_MISURE[misura]
            aggiorna = sql.SQL("update public.profili set {} = %s where id = %s").format(
                sql.Identifier(colonna)
            )
            minimo, massimo = limiti["min"], limiti["max"]
            attesi = {minimo: True, massimo: True, minimo - 1: False, massimo + 1: False}
            for valore, deve_passare in attesi.items():
                if _accettato(conn, aggiorna, (valore, utente)) != deve_passare:
                    esito = "rifiuta" if deve_passare else "accetta"
                    differenze.append(
                        f"{colonna}: il database {esito} {valore}, Python vuole {minimo}-{massimo}"
                    )

        inserisci_capo = sql.SQL(
            "insert into public.capi (utente_id, nome, tipo, colore_nome, colore_hex,"
            " foto_percorso, confidenze) values (%s, 'Prova', 'top', 'Prova', %s, %s, %s::jsonb)"
        )
        percorso = f"{utente}/capi/prova.jpg"
        for colore in COLORI:
            nel_database = _accettato(conn, inserisci_capo, (utente, colore, percorso, "{}"))
            in_python = _pydantic_accetta(models.EsaColore, colore)
            if nel_database != in_python:
                differenze.append(
                    f"colore {colore!r}: database {_si_no(nel_database)},"
                    f" Python {_si_no(in_python)}"
                )
        for confidenza in CONFIDENZE:
            confidenze = f'{{"tipo": {confidenza}}}'
            nel_database = _accettato(
                conn, inserisci_capo, (utente, "#000000", percorso, confidenze)
            )
            in_python = _pydantic_accetta(models.Confidenza, confidenza)
            if nel_database != in_python:
                differenze.append(
                    f"confidenza {confidenza}: database {_si_no(nel_database)},"
                    f" Python {_si_no(in_python)}"
                )
    return differenze


def main() -> None:
    with psycopg.connect(DSN_LOCALE) as conn:
        differenze = confronta_enum(conn) + confronta_slot(conn) + confronta_vincoli(conn)

    if differenze:
        for differenza in differenze:
            print(f"✗ {differenza}", file=sys.stderr)
        print(
            "Database e dominio Python divergono: si corregge la migrazione o il "
            "modello nella stessa PR, così che dicano la stessa cosa.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    print(
        f"✓ {len(ENUM)} enum, la mappa degli slot, i limiti delle misure, il colore"
        " e le confidenze coincidono"
    )


if __name__ == "__main__":
    main()
