"""Postgres.

Schema ibrido di proposito: le colonne che filtriamo o ordiniamo davvero
(utente, tipo, stato, ultimo uso) sono colonne vere e indicizzate; tutto il
resto del capo vive in un `jsonb` che è la serializzazione del modello di
dominio. Così aggiungere un attributo letto dalla foto non richiede una
migrazione, ma «i capi fermi da sei mesi» resta una query e non una scansione
in Python.
"""

from __future__ import annotations

import threading
from datetime import date
from typing import Any

import psycopg
from psycopg.rows import dict_row

from domain.errors import EmailGiaRegistrata
from domain.models import (
    Capo,
    EsecuzionePlayground,
    EsitoAnalisi,
    MessaggioChat,
    Outfit,
    PresetPrompt,
    Profilo,
    Segnalazione,
    Valutazione,
    ValutazioneImmagine,
)


class RepositoryPostgres:
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        # Una connessione per thread, non una condivisa: sotto un server
        # multi-thread (ThreadingHTTPServer di local_server.py) due thread
        # che eseguono cursori sulla stessa connessione psycopg in parallelo
        # possono interferire a livello di protocollo.
        self._locale = threading.local()

    # ── connessione ────────────────────────────────────────────────────────
    def _conn(self) -> psycopg.Connection[Any]:
        """Riusa la connessione del thread corrente fra chiamate."""
        connessione: psycopg.Connection[Any] | None = getattr(self._locale, "connessione", None)
        if connessione is None or connessione.closed:
            connessione = psycopg.connect(self._dsn, row_factory=dict_row, autocommit=True)
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
        try:
            with self._conn().cursor() as cur:
                cur.execute(
                    "insert into utenti (email, hash_password) values (%s, %s) returning id",
                    (email, hash_password),
                )
                riga = cur.fetchone()
                assert riga is not None
                return str(riga["id"])
        except psycopg.errors.UniqueViolation as exc:
            raise EmailGiaRegistrata(email) from exc

    def trova_email(self, utente_id: str) -> str | None:
        with self._conn().cursor() as cur:
            cur.execute("select email from utenti where id = %s", (utente_id,))
            riga = cur.fetchone()
            return str(riga["email"]) if riga else None

    # ── segnalazioni ───────────────────────────────────────────────────────
    def salva_segnalazione(self, segnalazione: Segnalazione) -> Segnalazione:
        with self._conn().cursor() as cur:
            cur.execute(
                """
                insert into segnalazioni (id, utente_id, creata_il, dati)
                values (%s, %s, %s, %s)
                on conflict (id) do update set dati = excluded.dati
                """,
                (
                    segnalazione.id,
                    segnalazione.utente_id,
                    segnalazione.creata_il,
                    segnalazione.model_dump_json(),
                ),
            )
        return segnalazione

    def leggi_segnalazione(self, segnalazione_id: str) -> Segnalazione | None:
        with self._conn().cursor() as cur:
            cur.execute("select dati from segnalazioni where id = %s", (segnalazione_id,))
            riga = cur.fetchone()
            return Segnalazione.model_validate(riga["dati"]) if riga else None

    def elenca_segnalazioni(self, utente_id: str) -> list[Segnalazione]:
        with self._conn().cursor() as cur:
            cur.execute(
                "select dati from segnalazioni where utente_id = %s order by creata_il desc",
                (utente_id,),
            )
            return [Segnalazione.model_validate(r["dati"]) for r in cur.fetchall()]

    def elenca_tutte_segnalazioni(self) -> list[Segnalazione]:
        with self._conn().cursor() as cur:
            cur.execute("select dati from segnalazioni order by creata_il desc")
            return [Segnalazione.model_validate(r["dati"]) for r in cur.fetchall()]
