"""Le controparti finte delle porte del dominio.

Ogni Protocol in `domain.ports` ha due implementazioni: una vera in `adapters/`
e una qui. Questi oggetti non sono mock generati: sono venti righe di codice che
si leggono, e quando un test fallisce si capisce perché.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from domain.accesso import ALGORITMO, PUBBLICO, Sessione
from domain.errors import AccessoNegato, FotoNonTrovata, RichiestaNonValida
from domain.models import (
    Capo,
    ConversazioneChat,
    EsitoAnalisi,
    MessaggioChat,
    ModelloDisponibile,
    Outfit,
    Profilo,
    Segnalazione,
    UsoToken,
)
from domain.ports import RichiestaLlm, RispostaLlm


class OrologioFermo:
    """Il tempo come dipendenza: «fermo da sei mesi» diventa verificabile."""

    def __init__(self, adesso: datetime) -> None:
        self._adesso = adesso

    def adesso(self) -> datetime:
        return self._adesso

    def oggi(self) -> date:
        return self._adesso.date()


class IdPrevedibili:
    def __init__(self, prefisso: str = "id") -> None:
        self._prefisso = prefisso
        self._contatore = 0

    def nuovo(self) -> str:
        self._contatore += 1
        return f"{self._prefisso}-{self._contatore}"


class ProviderFinto:
    """Risponde quello che gli dici, e ricorda cosa gli è stato chiesto."""

    nome = "finto"

    def __init__(self, testo: str = "{}", *, errore: Exception | None = None) -> None:
        self._testo = testo
        self._errore = errore
        self.richieste: list[RichiestaLlm] = []

    def modelli(self) -> list[ModelloDisponibile]:
        return [
            ModelloDisponibile(
                provider=self.nome, id="finto-1", etichetta="Finto", visione=True, configurato=True
            )
        ]

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        self.richieste.append(richiesta)
        if self._errore is not None:
            raise self._errore
        return RispostaLlm(
            testo=self._testo,
            modello=richiesta.modello,
            uso=UsoToken(token_input=1000, token_output=500),
            latenza_ms=42,
        )


# ── Supabase, per finta ─────────────────────────────────────────────────────


class ChiaviFinte:
    """Una coppia di chiavi ES256 generata per i test: la privata firma i token
    come farebbe Supabase Auth, la pubblica li verifica come fa il backend."""

    KID = "chiave-di-prova"

    def __init__(self) -> None:
        self.privata = ec.generate_private_key(ec.SECP256R1())
        self.pubblica = self.privata.public_key()

    def chiave(self, kid: str) -> object | None:
        return self.pubblica if kid == self.KID else None

    def token(
        self,
        utente_id: str,
        emittente: str,
        *,
        scade_tra: timedelta = timedelta(hours=1),
        pubblico: str = PUBBLICO,
        ruolo: str = PUBBLICO,
        kid: str | None = None,
        emesso_tra: timedelta = timedelta(0),
        **altre: object,
    ) -> str:
        """`emesso_tra` sposta l'`iat`: positivo è un token che sembra emesso nel
        futuro, come lo vede un VPS con l'orologio indietro. `altre` aggiunge
        rivendicazioni, come `is_anonymous`."""
        adesso = datetime.now(UTC)
        return jwt.encode(
            {
                "sub": utente_id,
                "aud": pubblico,
                "iss": emittente,
                "role": ruolo,
                "iat": int((adesso + emesso_tra).timestamp()),
                "exp": int((adesso + scade_tra).timestamp()),
                **altre,
            },
            self.privata,
            algorithm=ALGORITMO,
            headers={"kid": kid or self.KID},
        )


class DepositoFinto:
    """Le tabelle e i bucket di Supabase, in memoria, **per utente**: un
    repository o un archivio nati per una sessione vedono solo le righe e i file
    di quella persona, come farebbe l'RLS. Non è l'RLS — quella si prova con
    pgTAP contro il database vero — ma basta perché un handler che chiedesse i
    dati di un altro, qui, non li trovi."""

    def __init__(self) -> None:
        self.capi: dict[str, list[Capo]] = defaultdict(list)
        self.profili: dict[str, Profilo] = {}
        self.outfit: dict[str, list[Outfit]] = defaultdict(list)
        self.segnalazioni: dict[str, list[Segnalazione]] = defaultdict(list)
        self.esiti: dict[str, dict[str, EsitoAnalisi]] = defaultdict(dict)
        self.conversazioni: dict[str, dict[str, ConversazioneChat]] = defaultdict(dict)
        self.messaggi: dict[str, dict[str, list[MessaggioChat]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self.file: dict[tuple[str, str], tuple[bytes, str]] = {}


class RepositoryFinto:
    def __init__(self, sessione: Sessione, deposito: DepositoFinto) -> None:
        self._utente = sessione.utente_id
        self._d = deposito

    def elenca_capi(self) -> list[Capo]:
        return list(self._d.capi[self._utente])

    def crea_capo(self, capo: Capo) -> Capo:
        self._d.capi[self._utente].insert(0, capo)
        return capo

    def leggi_profilo(self) -> Profilo | None:
        return self._d.profili.get(self._utente)

    def elenca_outfit(self) -> list[Outfit]:
        return list(self._d.outfit[self._utente])

    def elenca_segnalazioni(self) -> list[Segnalazione]:
        return list(self._d.segnalazioni[self._utente])

    def registra_esito_analisi(self, esito: EsitoAnalisi) -> None:
        # Una POST, come quella vera: lo stesso id due volte è una chiave
        # primaria violata, non una sovrascrittura.
        if esito.esecuzione_id in self._d.esiti[self._utente]:
            raise RichiestaNonValida("esito già registrato (23505)")
        self._d.esiti[self._utente][esito.esecuzione_id] = esito

    def leggi_conversazione_chat(self, conversazione_id: str) -> ConversazioneChat | None:
        return self._d.conversazioni[self._utente].get(conversazione_id)

    def crea_conversazione_chat(self, conversazione: ConversazioneChat) -> ConversazioneChat:
        self._d.conversazioni[self._utente][conversazione.id] = conversazione
        return conversazione

    def elenca_conversazioni_chat(self) -> list[ConversazioneChat]:
        return sorted(
            self._d.conversazioni[self._utente].values(),
            key=lambda c: c.ultimo_turno_il,
            reverse=True,
        )

    def elenca_messaggi_chat(self, conversazione_id: str, limite: int = 200) -> list[MessaggioChat]:
        return self._d.messaggi[self._utente][conversazione_id][-limite:]

    def salva_messaggi_chat(
        self, conversazione_id: str, messaggi: list[MessaggioChat]
    ) -> list[MessaggioChat]:
        self._d.messaggi[self._utente][conversazione_id].extend(messaggi)
        # Come il trigger del database: la conversazione sale in cima.
        conversazione = self._d.conversazioni[self._utente][conversazione_id]
        ultimo = max(m.creato_il for m in messaggi)
        if ultimo > conversazione.ultimo_turno_il:
            self._d.conversazioni[self._utente][conversazione_id] = conversazione.model_copy(
                update={"ultimo_turno_il": ultimo}
            )
        return list(messaggi)


class ArchivioFinto:
    """Un bucket, con la regola delle policy di Storage: si legge e si scrive
    solo nella propria cartella."""

    def __init__(self, sessione: Sessione, bucket: str, deposito: DepositoFinto) -> None:
        self._utente = sessione.utente_id
        self._bucket = bucket
        self._d = deposito

    def _proprio(self, percorso: str) -> bool:
        return percorso.split("/", 1)[0] == self._utente and ".." not in percorso

    def leggi(self, percorso: str) -> tuple[bytes, str]:
        trovato = self._d.file.get((self._bucket, percorso))
        if trovato is None or not self._proprio(percorso):
            raise FotoNonTrovata(f"«{percorso}» non c'è")
        return trovato

    def salva(self, percorso: str, contenuto: bytes, media_type: str) -> None:
        if not self._proprio(percorso):
            raise AccessoNegato("fuori dalla propria cartella")
        self._d.file[(self._bucket, percorso)] = (contenuto, media_type)

    def firma_lettura(self, percorso: str, scade_in_s: int) -> str:
        return f"https://storage.finto/{self._bucket}/{percorso}?token=finto&scade={scade_in_s}"
