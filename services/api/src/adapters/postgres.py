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
import threading
from datetime import date
from typing import Any

import boto3
import psycopg
from psycopg.rows import dict_row

from domain.models import (
    Capo,
    EsecuzionePlayground,
    EsitoAnalisi,
    MessaggioChat,
    Outfit,
    PresetPrompt,
    Profilo,
    Valutazione,
    ValutazioneImmagine,
)


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
        # Una connessione per thread, non una condivisa: su Lambda un
        # container esegue una richiesta alla volta, ma sotto un server
        # multi-thread (ThreadingHTTPServer di local_server.py su un VPS)
        # due thread che eseguono cursori sulla stessa connessione psycopg in
        # parallelo possono interferire a livello di protocollo.
        self._locale = threading.local()

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
        """Riusa la connessione del thread corrente fra chiamate."""
        connessione: psycopg.Connection[Any] | None = getattr(self._locale, "connessione", None)
        if connessione is None or connessione.closed:
            connessione = psycopg.connect(self._dsn(), row_factory=dict_row, autocommit=True)
            self._locale.connessione = connessione
        return connessione

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

    # ── preset del playground ────────────────────────────────────────────────
    def leggi_preset(self, preset_id: str) -> PresetPrompt | None:
        with self._conn().cursor() as cur:
            cur.execute("select dati from preset_prompt where id = %s", (preset_id,))
            riga = cur.fetchone()
            return PresetPrompt.model_validate(riga["dati"]) if riga else None

    def salva_preset(self, preset: PresetPrompt) -> PresetPrompt:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into preset_prompt (id, dati) values (%s, %s)
                on conflict (id) do update set dati = excluded.dati, aggiornato_il = now()
                """,
                (preset.id, preset.model_dump_json()),
            )
        return preset

    # ── chat continua ──────────────────────────────────────────────────────
    def elenca_messaggi_chat(self, utente_id: str, limite: int = 200) -> list[MessaggioChat]:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                select dati from (
                    select dati, creato_il from messaggi_chat
                    where utente_id = %s
                    order by creato_il desc
                    limit %s
                ) recenti
                order by creato_il asc
                """,
                (utente_id, limite),
            )
            return [MessaggioChat.model_validate(r["dati"]) for r in cur.fetchall()]

    def salva_messaggio_chat(self, utente_id: str, messaggio: MessaggioChat) -> MessaggioChat:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into messaggi_chat (id, utente_id, creato_il, dati)
                values (%s, %s, %s, %s)
                """,
                (messaggio.id, utente_id, messaggio.creato_il, messaggio.model_dump_json()),
            )
        return messaggio

    # ── banco di valutazione ──────────────────────────────────────────────
    def salva_valutazione(self, valutazione: Valutazione) -> None:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into valutazioni (run_id, provider, modello, campione_id, eseguita_il, dati)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (run_id, provider, modello, campione_id) do update set
                    eseguita_il = excluded.eseguita_il,
                    dati = excluded.dati
                """,
                (
                    valutazione.run_id,
                    valutazione.provider,
                    valutazione.modello,
                    valutazione.campione_id,
                    valutazione.eseguita_il,
                    valutazione.model_dump_json(),
                ),
            )

    def elenca_valutazioni(self, run_id: str) -> list[Valutazione]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from valutazioni where run_id = %s order by eseguita_il asc",
                (run_id,),
            )
            return [Valutazione.model_validate(r["dati"]) for r in cur.fetchall()]

    def ultimo_run_valutazione(self) -> str | None:
        with self._conn().cursor() as cur:
            cur.execute("select run_id from valutazioni order by eseguita_il desc limit 1")
            riga = cur.fetchone()
            return riga["run_id"] if riga else None

    # ── banco immagini ────────────────────────────────────────────────────
    def salva_valutazione_immagine(self, valutazione: ValutazioneImmagine) -> None:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into valutazioni_immagini
                    (run_id, servizio, modello, campione_id, eseguita_il, dati)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (run_id, servizio, modello, campione_id) do update set
                    eseguita_il = excluded.eseguita_il,
                    dati = excluded.dati
                """,
                (
                    valutazione.run_id,
                    valutazione.servizio,
                    valutazione.modello,
                    valutazione.campione_id,
                    valutazione.eseguita_il,
                    valutazione.model_dump_json(),
                ),
            )

    def elenca_valutazioni_immagini(self, run_id: str) -> list[ValutazioneImmagine]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from valutazioni_immagini where run_id = %s order by eseguita_il asc",
                (run_id,),
            )
            return [ValutazioneImmagine.model_validate(r["dati"]) for r in cur.fetchall()]

    def ultimo_run_valutazione_immagine(self) -> str | None:
        with self._conn().cursor() as cur:
            cur.execute("select run_id from valutazioni_immagini order by eseguita_il desc limit 1")
            riga = cur.fetchone()
            return riga["run_id"] if riga else None

    # ── esiti dell'analisi inline ────────────────────────────────────────
    def salva_esito_analisi(self, esito: EsitoAnalisi) -> None:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into analisi_esiti (esecuzione_id, dati) values (%s, %s)
                on conflict (esecuzione_id) do update set dati = excluded.dati
                """,
                (esito.esecuzione_id, esito.model_dump_json()),
            )

    def leggi_esito_analisi(self, esecuzione_id: str) -> EsitoAnalisi | None:
        with self._conn().cursor() as cur:
            cur.execute("select dati from analisi_esiti where esecuzione_id = %s", (esecuzione_id,))
            riga = cur.fetchone()
            return EsitoAnalisi.model_validate(riga["dati"]) if riga else None

    # ── utenti (login) ────────────────────────────────────────────────────
    def trova_per_email(self, email: str) -> tuple[str, str] | None:
        with self._conn().cursor() as cur:
            cur.execute("select id, hash_password from utenti where email = %s", (email,))
            riga = cur.fetchone()
            return (str(riga["id"]), riga["hash_password"]) if riga else None

    def crea(self, email: str, hash_password: str) -> str:
        with self._conn().cursor() as cur:
            cur.execute(
                "insert into utenti (email, hash_password) values (%s, %s) returning id",
                (email, hash_password),
            )
            riga = cur.fetchone()
            assert riga is not None
            return str(riga["id"])
