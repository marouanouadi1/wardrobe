from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

# Prima di qualsiasi import degli handler: in modalità sviluppo il container
# monta il repository in memoria, e nessun test tocca la rete.
os.environ["DEV_MODE"] = "1"
os.environ["PLAYGROUND_ABILITATO"] = "1"
# Non più un bypass (AUTH_APERTA è sparita): ogni test che chiama un handler
# autenticato passa da un JWT vero, firmato con questo segreto — vedi
# `intestazioni_utente()` sotto.
os.environ["JWT_SECRET"] = "segreto-di-test-lungo-abbastanza-per-hmac-sha256"

from domain.autenticazione import emetti_token
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

ADESSO = datetime(2026, 7, 24, 9, 30, tzinfo=UTC)
OGGI = ADESSO.date()

# Una lettura del modello di visione fatta bene: la usano sia i test della
# visione sia quelli del playground, e sta qui perché un test non deve
# importare un altro test.
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


def intestazioni_utente(utente: str = "demo") -> dict[str, str]:
    """Le intestazioni HTTP che identificano `utente` in un evento di test: un
    JWT vero, firmato con `JWT_SECRET`, non più un header non verificato.

    Emesso con l'ora reale, non `ADESSO`: `ADESSO` è fissa nel passato per
    rendere deterministica la logica di dominio (capi dormienti, ecc.), ma un
    token con `iat`/`exp` calcolati su quella data scade per davvero quando
    l'orologio reale la supera di 30 giorni — è già successo una volta."""
    token = emetti_token(utente, os.environ["JWT_SECRET"], datetime.now(UTC))
    return {"authorization": f"Bearer {token}"}


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


@pytest.fixture(autouse=True)
def _container_pulito():
    """Ogni test parte da un armadio nuovo.

    Il container usa `functools.cache` perché in produzione l'istanza deve
    vivere quanto il processo, per riusare la stessa connessione. In pytest
    quello stesso comportamento farebbe condividere il repository in memoria
    fra i test: uno che segna un capo come «da lavare» falserebbe i conteggi
    di quello dopo.
    """
    from handlers import _container

    def svuota() -> None:
        for cache in (
            _container.repository,
            _container.repository_utenti,
            _container.archivio_foto,
            _container.orologio,
            _container.generatore_id,
        ):
            cache.cache_clear()

    svuota()
    yield
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
