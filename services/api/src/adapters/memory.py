"""Repository in memoria: nessuna persistenza, nessun dato precaricato.

Sta in piedi solo dentro un processo. Usato dai test (niente Postgres, niente
rete) e come fallback quando `DATABASE_URL` non è impostata in `DEV_MODE=1` —
un armadio vuoto, non un armadio finto.
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, date, datetime

from domain.errors import EmailGiaRegistrata, ErroreDominio
from domain.firma_foto import firma_foto
from domain.models import (
    Capo,
    ConversazioneChat,
    EsitoAnalisi,
    MessaggioChat,
    Outfit,
    Profilo,
    Segnalazione,
    UploadFirmato,
    VoceElencoConversazioni,
)


def _porta_locale() -> str:
    """La stessa porta su cui ascolta `local_server.py` (default 8787)."""
    return os.environ.get("PORTA", "8787")


def _url_firmata(chiave: str, scade_in_s: int) -> str:
    """Stessa firma di `ArchivioFileSystem._url_firmata`: `/foto/{chiave}` la
    verifica allo stesso modo qualunque sia l'archivio dietro."""
    scade_epoch = int(datetime.now(UTC).timestamp()) + scade_in_s
    firma = firma_foto(chiave, scade_epoch, os.environ["JWT_SECRET"])
    return f"http://localhost:{_porta_locale()}/foto/{chiave}?scade={scade_epoch}&firma={firma}"


class ArchivioInMemoria:
    """Archivio foto per lo sviluppo: le foto caricate stanno in memoria e si
    perdono a ogni riavvio. Per foto persistenti, vedi `ArchivioFileSystem`."""

    def __init__(self) -> None:
        self._oggetti: dict[str, bytes] = {}

    def url_upload(self, chiave: str, content_type: str, scade_in_s: int = 900) -> UploadFirmato:
        return UploadFirmato(
            chiave=chiave,
            # La PUT vera dell'app atterra su una rotta di `local_server.py`
            # che scrive nel dizionario qui sotto — vedi `salva()`.
            url=_url_firmata(chiave, scade_in_s),
            intestazioni={"content-type": content_type},
            scade_in_s=scade_in_s,
        )

    def url_lettura(self, chiave: str, scade_in_s: int = 604_800) -> str:
        """Stesso motivo di `ArchivioFileSystem.url_lettura`: 7 giorni, non 1
        ora, perché l'app tiene le foto già caricate in memoria per tutta la
        sessione."""
        return _url_firmata(chiave, scade_in_s)

    def salva(self, chiave: str, contenuto: bytes, media_type: str) -> None:
        """Riceve il corpo della PUT vera dell'app, o una foto scontornata.

        `media_type` è ignorato qui (`leggi()` restituisce sempre
        «image/png» per gli oggetti caricati): in memoria non c'è un posto
        dove tenerlo per chiave, ed è un dettaglio che conta solo per un
        archivio persistente (vedi `ArchivioFileSystem`).
        """
        del media_type
        self._oggetti[chiave] = contenuto

    def leggi(self, chiave: str) -> tuple[bytes, str]:
        caricata = self._oggetti.get(chiave)
        if caricata is None:
            raise ErroreDominio(f"la foto «{chiave}» non è in questo archivio: caricane una")
        return caricata, "image/png"


class RepositoryInMemoria:
    """Sta in piedi solo dentro un processo: perfetto per lo sviluppo e i test."""

    def __init__(self) -> None:
        self._capi: dict[str, dict[str, Capo]] = {}
        self._outfit: dict[str, dict[str, Outfit]] = {}
        self._profili: dict[str, Profilo] = {}
        self._usi: set[tuple[str, str, date]] = set()
        # Chiave (utente_id, conversazione_id): un dizionario solo non basta
        # più, dalla decisione di ADR 0006 di avere più conversazioni per utente.
        self._chat: dict[tuple[str, str], list[MessaggioChat]] = {}
        self._conversazioni: dict[str, dict[str, ConversazioneChat]] = {}
        self._esiti_analisi: dict[str, EsitoAnalisi] = {}
        self._utenti: dict[str, tuple[str, str]] = {}  # email -> (id, hash_password)
        self._segnalazioni: dict[str, Segnalazione] = {}

    # ── capi ───────────────────────────────────────────────────────────────
    def elenca_capi(self, utente_id: str) -> list[Capo]:
        return list(self._capi.get(utente_id, {}).values())

    def leggi_capo(self, utente_id: str, capo_id: str) -> Capo | None:
        return self._capi.get(utente_id, {}).get(capo_id)

    def salva_capo(self, utente_id: str, capo: Capo) -> Capo:
        self._capi.setdefault(utente_id, {})[capo.id] = capo
        return capo

    def elimina_capo(self, utente_id: str, capo_id: str) -> None:
        self._capi.get(utente_id, {}).pop(capo_id, None)

    # ── outfit ─────────────────────────────────────────────────────────────
    def elenca_outfit(self, utente_id: str) -> list[Outfit]:
        return list(self._outfit.get(utente_id, {}).values())

    def salva_outfit(self, utente_id: str, outfit: Outfit) -> Outfit:
        self._outfit.setdefault(utente_id, {})[outfit.id] = outfit
        return outfit

    # ── profilo ────────────────────────────────────────────────────────────
    def leggi_profilo(self, utente_id: str) -> Profilo | None:
        return self._profili.get(utente_id)

    def salva_profilo(self, profilo: Profilo) -> Profilo:
        self._profili[profilo.id] = profilo
        return profilo

    # ── uso ────────────────────────────────────────────────────────────────
    def registra_uso(self, utente_id: str, capo_ids: list[str], giorno: date) -> None:
        for capo_id in capo_ids:
            self._usi.add((utente_id, capo_id, giorno))

    # ── chat: conversazioni ──────────────────────────────────────────────────
    def elenca_messaggi_chat(
        self, utente_id: str, conversazione_id: str, limite: int = 200
    ) -> list[MessaggioChat]:
        return self._chat.get((utente_id, conversazione_id), [])[-limite:]

    def salva_messaggio_chat(
        self, utente_id: str, conversazione_id: str, messaggio: MessaggioChat
    ) -> MessaggioChat:
        self._chat.setdefault((utente_id, conversazione_id), []).append(messaggio)
        return messaggio

    def elenca_conversazioni_chat(self, utente_id: str) -> list[VoceElencoConversazioni]:
        voci = []
        for conversazione in self._conversazioni.get(utente_id, {}).values():
            messaggi = self._chat.get((utente_id, conversazione.id), [])
            voci.append(
                VoceElencoConversazioni(
                    conversazione=conversazione,
                    turni=len(messaggi),
                    anteprima=messaggi[-1].testo if messaggi else "",
                )
            )
        return sorted(voci, key=lambda v: v.conversazione.ultimo_turno_il, reverse=True)

    def leggi_conversazione_chat(
        self, utente_id: str, conversazione_id: str
    ) -> ConversazioneChat | None:
        return self._conversazioni.get(utente_id, {}).get(conversazione_id)

    def salva_conversazione_chat(
        self, utente_id: str, conversazione: ConversazioneChat
    ) -> ConversazioneChat:
        self._conversazioni.setdefault(utente_id, {})[conversazione.id] = conversazione
        return conversazione

    def elimina_conversazione_chat(self, utente_id: str, conversazione_id: str) -> None:
        self._conversazioni.get(utente_id, {}).pop(conversazione_id, None)
        self._chat.pop((utente_id, conversazione_id), None)

    # ── esiti dell'analisi inline ────────────────────────────────────────
    def salva_esito_analisi(self, esito: EsitoAnalisi) -> None:
        self._esiti_analisi[esito.esecuzione_id] = esito

    def leggi_esito_analisi(self, esecuzione_id: str) -> EsitoAnalisi | None:
        return self._esiti_analisi.get(esecuzione_id)

    # ── utenti (login) ────────────────────────────────────────────────────
    def trova_per_email(self, email: str) -> tuple[str, str] | None:
        return self._utenti.get(email)

    def crea(self, email: str, hash_password: str) -> str:
        if email in self._utenti:
            raise EmailGiaRegistrata(email)
        utente_id = uuid.uuid4().hex
        self._utenti[email] = (utente_id, hash_password)
        return utente_id

    def trova_email(self, utente_id: str) -> str | None:
        for email, (id_utente, _) in self._utenti.items():
            if id_utente == utente_id:
                return email
        return None

    # ── segnalazioni ────────────────────────────────────────────────────────
    def salva_segnalazione(self, segnalazione: Segnalazione) -> Segnalazione:
        self._segnalazioni[segnalazione.id] = segnalazione
        return segnalazione

    def leggi_segnalazione(self, segnalazione_id: str) -> Segnalazione | None:
        return self._segnalazioni.get(segnalazione_id)

    def elenca_segnalazioni(self, utente_id: str) -> list[Segnalazione]:
        trovate = [s for s in self._segnalazioni.values() if s.utente_id == utente_id]
        return sorted(trovate, key=lambda s: s.creata_il, reverse=True)

    def elenca_tutte_segnalazioni(self) -> list[Segnalazione]:
        return sorted(self._segnalazioni.values(), key=lambda s: s.creata_il, reverse=True)
