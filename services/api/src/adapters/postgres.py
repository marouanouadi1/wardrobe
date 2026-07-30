"""Postgres.

Schema ibrido di proposito: le colonne che filtriamo o ordiniamo davvero
(utente, tipo, stato, ultimo uso) sono colonne vere e indicizzate; tutto il
resto del capo vive in un `jsonb` che è la serializzazione del modello di
dominio. Così aggiungere un attributo letto dalla foto non richiede una
migrazione, ma «i capi fermi da sei mesi» resta una query e non una scansione
in Python.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

import boto3
import psycopg
from psycopg.rows import dict_row

from domain.models import Capo, EsecuzionePlayground, Outfit, Profilo


class RepositoryPostgres:
    def __init__(
        self, dsn_secret_arn: str | None = None, regione: str = "eu-south-1", dsn: str | None = None
    ) -> None:
        """`dsn` diretto per Postgres locale (docker-compose): salta Secrets
        Manager, che in locale non esiste. In cloud si passa `dsn_secret_arn`."""
        if dsn is None and dsn_secret_arn is None:
            raise ValueError("serve dsn oppure dsn_secret_arn")
        self._dsn_diretto = dsn
        self._secret_arn = dsn_secret_arn
        self._regione = regione
        self._connessione: psycopg.Connection[Any] | None = None

    # ── connessione ────────────────────────────────────────────────────────
    def _dsn(self) -> str:
        if self._dsn_diretto is not None:
            return self._dsn_diretto
        assert self._secret_arn is not None
        segreti = boto3.client("secretsmanager", region_name=self._regione)
        segreto = json.loads(segreti.get_secret_value(SecretId=self._secret_arn)["SecretString"])
        return (
            f"host={segreto['host']} port={segreto.get('port', 5432)} "
            f"dbname={segreto.get('dbname', 'wardrobe')} "
            f"user={segreto['username']} password={segreto['password']} sslmode=require"
        )

    def _conn(self) -> psycopg.Connection[Any]:
        """Riusa la connessione fra invocazioni: su Lambda vive quanto il container."""
        if self._connessione is None or self._connessione.closed:
            self._connessione = psycopg.connect(self._dsn(), row_factory=dict_row, autocommit=True)
        return self._connessione

    # ── capi ───────────────────────────────────────────────────────────────
    def elenca_capi(self, utente_id: str) -> list[Capo]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from capi where utente_id = %s order by creato_il desc",
                (utente_id,),
            )
            return [Capo.model_validate(riga["dati"]) for riga in cur.fetchall()]

    def leggi_capo(self, utente_id: str, capo_id: str) -> Capo | None:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from capi where utente_id = %s and id = %s", (utente_id, capo_id)
            )
            riga = cur.fetchone()
            return Capo.model_validate(riga["dati"]) if riga else None

    def salva_capo(self, utente_id: str, capo: Capo) -> Capo:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into capi (id, utente_id, tipo, stato, ultimo_uso, creato_il, dati)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                    tipo = excluded.tipo,
                    stato = excluded.stato,
                    ultimo_uso = excluded.ultimo_uso,
                    dati = excluded.dati
                """,
                (
                    capo.id,
                    utente_id,
                    capo.tipo.value,
                    capo.stato.value,
                    capo.ultimo_uso,
                    capo.creato_il,
                    capo.model_dump_json(),
                ),
            )
        return capo

    def elimina_capo(self, utente_id: str, capo_id: str) -> None:
        with self._conn().cursor() as cur:
            cur.execute("delete from capi where utente_id = %s and id = %s", (utente_id, capo_id))

    # ── outfit ─────────────────────────────────────────────────────────────
    def elenca_outfit(self, utente_id: str) -> list[Outfit]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from outfit where utente_id = %s order by creato_il desc",
                (utente_id,),
            )
            return [Outfit.model_validate(riga["dati"]) for riga in cur.fetchall()]

    def salva_outfit(self, utente_id: str, outfit: Outfit) -> Outfit:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into outfit (id, utente_id, creato_il, dati)
                values (%s, %s, %s, %s)
                on conflict (id) do update set dati = excluded.dati
                """,
                (outfit.id, utente_id, outfit.creato_il, outfit.model_dump_json()),
            )
        return outfit

    # ── profilo ────────────────────────────────────────────────────────────
    def leggi_profilo(self, utente_id: str) -> Profilo | None:
        with self._conn().cursor() as cur:
            cur.execute("select dati from profili where id = %s", (utente_id,))
            riga = cur.fetchone()
            return Profilo.model_validate(riga["dati"]) if riga else None

    def salva_profilo(self, profilo: Profilo) -> Profilo:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into profili (id, creato_il, dati) values (%s, %s, %s)
                on conflict (id) do update set dati = excluded.dati
                """,
                (profilo.id, profilo.creato_il, profilo.model_dump_json()),
            )
        return profilo

    # ── diario d'uso ───────────────────────────────────────────────────────
    def registra_uso(self, utente_id: str, capo_ids: list[str], giorno: date) -> None:
        """Il calendario di «cosa ho messo»: una riga per capo per giorno."""
        with self._conn().cursor() as cur:
            cur.executemany(
                """
                insert into usi (utente_id, capo_id, giorno) values (%s, %s, %s)
                on conflict (utente_id, capo_id, giorno) do nothing
                """,
                [(utente_id, capo_id, giorno) for capo_id in capo_ids],
            )

    # ── playground ─────────────────────────────────────────────────────────
    def storico_playground(self, limite: int = 20) -> list[EsecuzionePlayground]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from playground_esecuzioni order by eseguita_il desc limit %s",
                (limite,),
            )
            return [EsecuzionePlayground.model_validate(r["dati"]) for r in cur.fetchall()]

    def salva_esecuzione_playground(self, esecuzione: EsecuzionePlayground) -> None:
        with self._conn().cursor() as cur:
            cur.execute(
                "insert into playground_esecuzioni (id, eseguita_il, dati) values (%s, %s, %s)",
                (esecuzione.id, esecuzione.eseguita_il, esecuzione.model_dump_json()),
            )
