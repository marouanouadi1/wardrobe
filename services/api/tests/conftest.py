from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest

# Prima di qualsiasi import degli handler: leggono l'indirizzo del progetto al
# momento della verifica di un token. Un progetto che non esiste: nessun test
# parla con Supabase, le porte sono i finti di `tests/fakes.py`.
os.environ["SUPABASE_URL"] = "https://progetto-di-prova.supabase.co"
os.environ["SUPABASE_CHIAVE_PUBBLICA"] = "sb_publishable_di_prova"

from domain.accesso import emittente_di
from domain.models import (
    AnalisiVisione,
    AttributoCapo,
    Capo,
    Colore,
    FotoCapo,
    Stagione,
    StatoCapo,
    TipoCapo,
)
from domain.wardrobe import slot_da_tipo
from fakes import ArchivioFinto, ChiaviFinte, DepositoFinto, RepositoryFinto

ADESSO = datetime(2026, 7, 24, 9, 30, tzinfo=UTC)
OGGI = ADESSO.date()

# Una lettura del modello di visione fatta bene: sta qui perché un test non
# deve importare un altro test.
LETTURA_BUONA: dict[str, object] = {
    "tipo": "top",
    "sottotipo": "camicia",
    "nome_proposto": "Camicia in lino",
    "colore": {"nome": "Panna", "hex": "#E7DFD2"},
    "materiale": "Lino 100%",
    "fantasia": "Tinta unita",
    "stagione": "estate",
    "vestibilita": "Oversize",
    "lavaggio": "40°",
    "confidenze": {
        "tipo": 96,
        "colore": 94,
        "materiale": 88,
        "fantasia": 90,
        "stagione": 80,
        "vestibilita": 72,
        "lavaggio": 85,
    },
}


EMITTENTE = emittente_di(os.environ["SUPABASE_URL"])

#: Le chiavi con cui i test firmano i token: una coppia per tutta la sessione di
#: pytest, generata qui, che nessun progetto vero conosce.
CHIAVI = ChiaviFinte()


def token_di(utente: str, *, scade_tra: timedelta = timedelta(hours=1)) -> str:
    """Un token come quelli di Supabase Auth: ES256, `aud` e `iss` del progetto
    di prova, firmato con `CHIAVI`. Scade rispetto all'ora vera, non ad
    `ADESSO`: `pyjwt` controlla la scadenza sull'orologio reale."""
    return CHIAVI.token(utente, EMITTENTE, scade_tra=scade_tra)


def intestazioni_utente(utente: str = "utente-a", **opzioni: timedelta) -> dict[str, str]:
    """Le intestazioni HTTP di una richiesta dell'app per `utente`."""
    return {"authorization": f"Bearer {token_di(utente, **opzioni)}"}


def costruisci_capo(
    capo_id: str,
    tipo: TipoCapo = TipoCapo.TOP,
    *,
    nome: str | None = None,
    hex_colore: str = "#AABBCC",
    stato: StatoCapo = StatoCapo.PULITO,
    ultimo_uso: object = "assente",
    preferito: bool = False,
    confidenze: dict[AttributoCapo, int] | None = None,
    materiale: str | None = "Cotone 100%",
) -> Capo:
    return Capo(
        id=capo_id,
        nome=nome or f"Capo {capo_id}",
        tipo=tipo,
        slot=slot_da_tipo(tipo),
        colore=Colore(nome="Grigio", hex=hex_colore),
        foto=FotoCapo(chiave=f"capi/{capo_id}.jpg"),
        materiale=materiale,
        stagione=Stagione.TUTTO_LANNO,
        stato=stato,
        preferito=preferito,
        ultimo_uso=None if ultimo_uso == "assente" else ultimo_uso,  # type: ignore[arg-type]
        analisi=AnalisiVisione(
            provider="finto",
            modello="finto-1",
            eseguita_il=ADESSO,
            confidenze=confidenze or {},
        ),
        creato_il=ADESSO,
        aggiornato_il=ADESSO,
    )


@dataclass
class Supabase:
    """Quello che la fixture `supabase` mette al posto del progetto vero: i dati
    in memoria, per utente, e le chiavi che firmano i token."""

    deposito: DepositoFinto
    chiavi: ChiaviFinte


@pytest.fixture(autouse=True)
def supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[Supabase]:
    """Ogni test parte da un Supabase vuoto, e nessuno parla con quello vero.

    Si sostituiscono le fabbriche del container **dove gli handler le hanno
    importate**: `from handlers._container import repository` copia il nome nel
    modulo dell'handler, e cambiarlo solo in `_container` non basterebbe. Le
    cache del container si azzerano prima e dopo: in produzione un'istanza vive
    quanto il processo, qui farebbe condividere lo stato fra un test e l'altro.
    """
    from handlers import _container, analisi, chat, esportazione, suggerimenti

    deposito = DepositoFinto()

    def repository(sessione: object) -> RepositoryFinto:
        return RepositoryFinto(sessione, deposito)  # type: ignore[arg-type]

    def archivio(sessione: object, bucket: str) -> ArchivioFinto:
        return ArchivioFinto(sessione, bucket, deposito)  # type: ignore[arg-type]

    # Presi prima di sostituirne uno: a fine test la fixture si chiude prima che
    # `monkeypatch` rimetta gli originali, e al posto di `chiavi_auth` ci sarebbe
    # ancora il finto, che una cache non ce l'ha.
    in_cache = (
        _container.orologio,
        _container.generatore_id,
        _container.chiavi_auth,
        _container.servizio_scontorno,
    )

    def svuota() -> None:
        for cache in in_cache:
            cache.cache_clear()

    svuota()
    monkeypatch.setattr(_container, "chiavi_auth", lambda: CHIAVI)
    for modulo in (analisi, chat, esportazione, suggerimenti):
        if hasattr(modulo, "repository"):
            monkeypatch.setattr(modulo, "repository", repository)
        if hasattr(modulo, "archivio"):
            monkeypatch.setattr(modulo, "archivio", archivio)
    yield Supabase(deposito=deposito, chiavi=CHIAVI)
    svuota()


@pytest.fixture
def armadio() -> list[Capo]:
    """Un armadio minimo ma indossabile: sopra, sotto, scarpe, capospalla."""
    return [
        costruisci_capo("t1", TipoCapo.TOP, nome="T-shirt bianca", hex_colore="#EFEBE3"),
        costruisci_capo("t2", TipoCapo.TOP, nome="T-shirt nera", stato=StatoCapo.DA_LAVARE),
        costruisci_capo("b1", TipoCapo.PANTALONI, nome="Jeans dritti", hex_colore="#46536B"),
        costruisci_capo("s1", TipoCapo.SCARPE, nome="Sneaker bianche", hex_colore="#EDE7DB"),
        costruisci_capo("o1", TipoCapo.CAPOSPALLA, nome="Giacca di jeans", hex_colore="#6B85A6"),
    ]
