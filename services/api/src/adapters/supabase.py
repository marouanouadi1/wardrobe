"""Supabase visto dal backend dell'IA: PostgREST, Storage, e le chiavi dell'Auth.

**Il backend agisce come l'utente** (ADR 0010). Ogni richiesta verso Supabase porta
il token di chi ha chiamato, e quello che vede e scrive lo decide l'RLS: sul VPS
non c'è la chiave di servizio, né la password del database, né una chiave S3.
Se un filtro qui sotto mancasse, il database lo fermerebbe lo stesso.

Il filtro c'è comunque (`utente_id=eq.…`), e non per sfiducia: l'amministratore
vede le segnalazioni di tutti, e l'esportazione di una persona deve contenere le
sue, non quelle che l'RLS le lascia vedere.

Il pool di connessioni (`httpx.HTTPTransport`) si condivide fra le richieste; il
client no, perché il client ha uno stato — i cookie che una risposta imposta — e
quello, condiviso, ripartirebbe con la richiesta di un altro. Un repository o un
archivio nasce per una sessione, con il suo client e il suo token, e muore con la
richiesta (`handlers/_container.py`): tenerlo in una cache darebbe al prossimo
chiamante il token del precedente.
"""

from __future__ import annotations

import functools
import logging
import threading
import time
from datetime import date, datetime
from typing import Any
from urllib.parse import quote

import httpx
import jwt

from domain.accesso import ALGORITMO, Sessione
from domain.errors import (
    AccessoNegato,
    AccessoNonDisponibile,
    ArchivioNonDisponibile,
    FotoNonTrovata,
    NonAutenticato,
    RichiestaNonValida,
)
from domain.models import (
    AnalisiVisione,
    Capo,
    Colore,
    ConversazioneChat,
    EsitoAnalisi,
    FotoCapo,
    MessaggioChat,
    Misure,
    Outfit,
    PreferenzeStile,
    Profilo,
    Segnalazione,
    Vestizione,
)

logger = logging.getLogger("wardrobe")

TIMEOUT_S = 20.0


@functools.cache
def trasporto_condiviso() -> httpx.HTTPTransport:
    """Il pool di connessioni verso Supabase, uno per processo. Non porta niente
    di nessuno: né token né cookie, che vivono nel client."""
    return httpx.HTTPTransport()


def nuovo_client() -> httpx.Client:
    """Un client per sessione, sopra il pool condiviso. **Non si chiude**:
    chiudere un client chiude il suo trasporto, cioè il pool di tutti."""
    return httpx.Client(transport=trasporto_condiviso(), timeout=TIMEOUT_S)


def _intestazioni(chiave_pubblica: str, sessione: Sessione, **altre: str) -> dict[str, str]:
    return {"apikey": chiave_pubblica, "authorization": f"Bearer {sessione.token}", **altre}


def _traduci(risposta: httpx.Response, cosa: str) -> None:
    """Un errore di Supabase diventa un errore di dominio, mai un 500 anonimo.

    401 è un token che non basta più (scaduto nel frattempo): l'app rinnova. 403
    è l'RLS che dice no. Un vincolo violato (CHECK, chiave esterna: `23…`) o un
    valore che non è del tipo della colonna (un id che non è un uuid: `22…`) è
    un dato sbagliato: 422. Il resto è Supabase che non risponde come deve: 502,
    con il dettaglio nei log."""
    if risposta.is_success:
        return
    stato = risposta.status_code
    try:
        corpo: dict[str, Any] = risposta.json()
    except ValueError:
        corpo = {}
    codice = str(corpo.get("code", ""))
    if stato == 401:
        raise NonAutenticato("il token non vale più: rinnova la sessione")
    if stato == 403 or codice == "42501":
        raise AccessoNegato(f"{cosa}: non consentito")
    if stato in (400, 409, 422) and codice.startswith(("22", "23")):
        raise RichiestaNonValida(f"{cosa}: i dati non rispettano lo schema ({codice})")
    logger.warning("Supabase ha risposto %s su %s: %s", stato, cosa, risposta.text[:400])
    raise ArchivioNonDisponibile(f"{cosa}: Supabase non ha risposto come doveva")


def _chiama(
    client: httpx.Client, metodo: str, url: str, cosa: str, **opzioni: Any
) -> httpx.Response:
    try:
        return client.request(metodo, url, **opzioni)
    except httpx.HTTPError as exc:
        logger.warning("Supabase irraggiungibile su %s: %s", cosa, exc)
        raise ArchivioNonDisponibile(f"{cosa}: Supabase non risponde") from exc


# ── righe ↔ modelli ─────────────────────────────────────────────────────────
# Le tabelle hanno colonne vere (supabase/migrations/); i modelli Pydantic sono
# annidati. La traduzione sta qui, in un posto solo.


def capo_da_riga(riga: dict[str, Any]) -> Capo:
    analisi = None
    if riga.get("analisi_provider") and riga.get("analisi_eseguita_il"):
        analisi = AnalisiVisione(
            provider=riga["analisi_provider"],
            modello=riga.get("analisi_modello") or "",
            eseguita_il=riga["analisi_eseguita_il"],
            confidenze=riga.get("confidenze") or {},
            corretti_a_mano=riga.get("corretti_a_mano") or [],
            note=riga.get("analisi_note"),
        )
    return Capo(
        id=riga["id"],
        nome=riga["nome"],
        tipo=riga["tipo"],
        slot=riga["slot"],
        colore=Colore(nome=riga["colore_nome"], hex=riga["colore_hex"]),
        foto=FotoCapo(
            chiave=riga["foto_percorso"],
            larghezza=riga.get("foto_larghezza"),
            altezza=riga.get("foto_altezza"),
            chiave_scontornata=riga.get("foto_scontornata_percorso"),
        ),
        brand=riga.get("brand"),
        sottotipo=riga.get("sottotipo"),
        materiale=riga.get("materiale"),
        fantasia=riga.get("fantasia"),
        stagione=riga.get("stagione"),
        vestibilita=riga.get("vestibilita"),
        lavaggio=riga.get("lavaggio"),
        stato=riga["stato"],
        preferito=riga["preferito"],
        ultimo_uso=riga.get("ultimo_uso"),
        volte_indossato=riga["volte_indossato"],
        analisi=analisi,
        etichette=riga.get("etichette") or [],
        appunti=riga.get("appunti"),
        creato_il=riga["creato_il"],
        aggiornato_il=riga["aggiornato_il"],
    )


def riga_da_capo(capo: Capo) -> dict[str, Any]:
    """Tutto tranne `slot`, che il database genera dal tipo e rifiuta se lo si
    manda, e `utente_id`, che prende da sé dal token (`default auth.uid()`)."""
    dati = capo.model_dump(mode="json")
    analisi = dati.get("analisi") or {}
    return {
        "id": dati["id"],
        "nome": dati["nome"],
        "tipo": dati["tipo"],
        "colore_nome": dati["colore"]["nome"],
        "colore_hex": dati["colore"]["hex"],
        "foto_percorso": dati["foto"]["chiave"],
        "foto_larghezza": dati["foto"].get("larghezza"),
        "foto_altezza": dati["foto"].get("altezza"),
        "foto_scontornata_percorso": dati["foto"].get("chiave_scontornata"),
        "brand": dati.get("brand"),
        "sottotipo": dati.get("sottotipo"),
        "materiale": dati.get("materiale"),
        "fantasia": dati.get("fantasia"),
        "stagione": dati.get("stagione"),
        "vestibilita": dati.get("vestibilita"),
        "lavaggio": dati.get("lavaggio"),
        "stato": dati["stato"],
        "preferito": dati["preferito"],
        "ultimo_uso": dati.get("ultimo_uso"),
        "volte_indossato": dati["volte_indossato"],
        "analisi_provider": analisi.get("provider"),
        "analisi_modello": analisi.get("modello"),
        "analisi_eseguita_il": analisi.get("eseguita_il"),
        "analisi_note": analisi.get("note"),
        "confidenze": analisi.get("confidenze") or {},
        "corretti_a_mano": analisi.get("corretti_a_mano") or [],
        "etichette": dati.get("etichette") or [],
        "appunti": dati.get("appunti"),
        "creato_il": dati["creato_il"],
        "aggiornato_il": dati["aggiornato_il"],
    }


def profilo_da_riga(riga: dict[str, Any]) -> Profilo:
    campi_misure = (
        "sistema_taglie",
        "taglia",
        "altezza_cm",
        "corporatura",
        "spalle_cm",
        "lunghezza_gamba_cm",
    )
    misure = {campo: riga.get(campo) for campo in campi_misure}
    return Profilo(
        id=riga["id"],
        nome=riga.get("nome") or "",
        citta=riga.get("citta"),
        preferenze=PreferenzeStile(
            stili=riga.get("stili") or [],
            palette=riga.get("palette") or [],
            evita=riga.get("evita") or [],
        ),
        misure=Misure(**misure) if any(v is not None for v in misure.values()) else None,
        unita_lunghezza=riga.get("unita_lunghezza") or "cm",
        avatar_foto_chiave=riga.get("avatar_foto_percorso"),
        creato_il=riga["creato_il"],
    )


def outfit_da_riga(riga: dict[str, Any]) -> Outfit:
    return Outfit(
        id=riga["id"],
        nome=riga["nome"],
        vestizione=Vestizione(
            top=riga.get("capo_top"),
            bottom=riga.get("capo_bottom"),
            outer=riga.get("capo_outer"),
            shoes=riga.get("capo_shoes"),
            dress=riga.get("capo_dress"),
        ),
        occasione=riga.get("occasione"),
        origine=riga["origine"],
        volte_indossato=riga["volte_indossato"],
        ultimo_uso=riga.get("ultimo_uso"),
        creato_il=riga["creato_il"],
    )


def conversazione_da_riga(riga: dict[str, Any]) -> ConversazioneChat:
    return ConversazioneChat(
        id=riga["id"],
        titolo=riga["titolo"],
        creata_il=riga["creata_il"],
        ultimo_turno_il=riga["ultimo_turno_il"],
    )


def messaggio_da_riga(riga: dict[str, Any]) -> MessaggioChat:
    return MessaggioChat(
        id=riga["id"],
        ruolo=riga["ruolo"],
        testo=riga["testo"],
        suggerimenti=riga.get("suggerimenti") or [],
        creato_il=riga["creato_il"],
    )


def segnalazione_da_riga(riga: dict[str, Any]) -> Segnalazione:
    return Segnalazione(
        id=riga["id"],
        utente_id=riga["utente_id"],
        testo=riga["testo"],
        stato=riga["stato"],
        creata_il=riga["creata_il"],
        aggiornata_il=riga["aggiornata_il"],
    )


def _iso(valore: date | datetime) -> str:
    return valore.isoformat()


# ── PostgREST ───────────────────────────────────────────────────────────────


class RepositorySupabase:
    """`RepositoryArmadio` sopra PostgREST, con il token di una sessione."""

    def __init__(
        self,
        sessione: Sessione,
        url_progetto: str,
        chiave_pubblica: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._sessione = sessione
        self._rest = f"{url_progetto.rstrip('/')}/rest/v1"
        self._chiave = chiave_pubblica
        self._client = client or nuovo_client()

    def _proprio(self) -> str:
        return f"eq.{self._sessione.utente_id}"

    def _leggi(self, tabella: str, parametri: dict[str, str]) -> list[dict[str, Any]]:
        risposta = _chiama(
            self._client,
            "GET",
            f"{self._rest}/{tabella}",
            f"lettura di {tabella}",
            params=parametri,
            headers=_intestazioni(self._chiave, self._sessione),
        )
        _traduci(risposta, f"lettura di {tabella}")
        righe: list[dict[str, Any]] = risposta.json()
        return righe

    def _scrivi(
        self,
        metodo: str,
        tabella: str,
        corpo: dict[str, Any] | list[dict[str, Any]],
        parametri: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        risposta = _chiama(
            self._client,
            metodo,
            f"{self._rest}/{tabella}",
            f"scrittura su {tabella}",
            params=parametri,
            json=corpo,
            headers=_intestazioni(self._chiave, self._sessione, prefer="return=representation"),
        )
        _traduci(risposta, f"scrittura su {tabella}")
        righe: list[dict[str, Any]] = risposta.json()
        return righe

    # capi, profilo, outfit, segnalazioni
    def elenca_capi(self) -> list[Capo]:
        righe = self._leggi(
            "capi", {"select": "*", "utente_id": self._proprio(), "order": "creato_il.desc"}
        )
        return [capo_da_riga(riga) for riga in righe]

    def crea_capo(self, capo: Capo) -> Capo:
        righe = self._scrivi("POST", "capi", riga_da_capo(capo))
        return capo_da_riga(righe[0])

    def leggi_profilo(self) -> Profilo | None:
        righe = self._leggi("profili", {"select": "*", "id": self._proprio()})
        return profilo_da_riga(righe[0]) if righe else None

    def elenca_outfit(self) -> list[Outfit]:
        righe = self._leggi(
            "outfit", {"select": "*", "utente_id": self._proprio(), "order": "creato_il.desc"}
        )
        return [outfit_da_riga(riga) for riga in righe]

    def elenca_segnalazioni(self) -> list[Segnalazione]:
        righe = self._leggi(
            "segnalazioni",
            {"select": "*", "utente_id": self._proprio(), "order": "creata_il.desc"},
        )
        return [segnalazione_da_riga(riga) for riga in righe]

    # esiti dell'analisi
    def registra_esito_analisi(self, esito: EsitoAnalisi) -> None:
        self._scrivi(
            "POST",
            "analisi_esiti",
            {
                "id": esito.esecuzione_id,
                "stato": esito.stato.value,
                "capo_id": esito.capo.id if esito.capo else None,
                "errore": esito.errore,
            },
        )

    # chat
    def leggi_conversazione_chat(self, conversazione_id: str) -> ConversazioneChat | None:
        righe = self._leggi(
            "conversazioni_chat",
            {"select": "*", "id": f"eq.{conversazione_id}", "utente_id": self._proprio()},
        )
        return conversazione_da_riga(righe[0]) if righe else None

    def crea_conversazione_chat(self, conversazione: ConversazioneChat) -> ConversazioneChat:
        righe = self._scrivi(
            "POST",
            "conversazioni_chat",
            {
                "id": conversazione.id,
                "titolo": conversazione.titolo,
                "creata_il": _iso(conversazione.creata_il),
                "ultimo_turno_il": _iso(conversazione.ultimo_turno_il),
            },
        )
        return conversazione_da_riga(righe[0])

    def elenca_conversazioni_chat(self) -> list[ConversazioneChat]:
        righe = self._leggi(
            "conversazioni_chat",
            {"select": "*", "utente_id": self._proprio(), "order": "ultimo_turno_il.desc"},
        )
        return [conversazione_da_riga(riga) for riga in righe]

    def elenca_messaggi_chat(self, conversazione_id: str, limite: int = 200) -> list[MessaggioChat]:
        righe = self._leggi(
            "messaggi_chat",
            {
                "select": "*",
                "conversazione_id": f"eq.{conversazione_id}",
                "utente_id": self._proprio(),
                "order": "creato_il.desc",
                "limit": str(limite),
            },
        )
        return [messaggio_da_riga(riga) for riga in reversed(righe)]

    def salva_messaggi_chat(
        self, conversazione_id: str, messaggi: list[MessaggioChat]
    ) -> list[MessaggioChat]:
        # Un array in una POST sola è un'istruzione sola per PostgREST, quindi
        # una transazione: o entrano tutte le righe, o nessuna.
        corpo = [
            {
                "id": dati["id"],
                "conversazione_id": conversazione_id,
                "ruolo": dati["ruolo"],
                "testo": dati["testo"],
                "suggerimenti": dati["suggerimenti"],
                "creato_il": dati["creato_il"],
            }
            for dati in (messaggio.model_dump(mode="json") for messaggio in messaggi)
        ]
        righe = self._scrivi("POST", "messaggi_chat", corpo)
        per_id = {riga["id"]: messaggio_da_riga(riga) for riga in righe}
        return [per_id[messaggio.id] for messaggio in messaggi]


# ── Storage ─────────────────────────────────────────────────────────────────


class ArchivioSupabase:
    """`Archivio` sopra lo Storage di Supabase: un bucket privato, con il token
    di una sessione. Le policy lasciano passare solo la cartella di chi chiede."""

    def __init__(
        self,
        sessione: Sessione,
        bucket: str,
        url_progetto: str,
        chiave_pubblica: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._sessione = sessione
        self._bucket = bucket
        self._storage = f"{url_progetto.rstrip('/')}/storage/v1"
        self._chiave = chiave_pubblica
        self._client = client or nuovo_client()

    def _oggetto(self, percorso: str) -> str:
        return f"{self._bucket}/{quote(percorso, safe='/')}"

    def leggi(self, percorso: str) -> tuple[bytes, str]:
        cosa = f"lettura di {self._bucket}/{percorso}"
        risposta = _chiama(
            self._client,
            "GET",
            f"{self._storage}/object/authenticated/{self._oggetto(percorso)}",
            cosa,
            headers=_intestazioni(self._chiave, self._sessione),
        )
        # Lo Storage risponde 400 con un «not_found» nel corpo, sia quando il
        # file non c'è sia quando l'RLS non lo lascia vedere: è giusto che per
        # chi chiede le due cose siano una.
        if risposta.status_code in (400, 404) and "not_found" in risposta.text.lower():
            raise FotoNonTrovata(f"«{percorso}» non c'è")
        _traduci(risposta, cosa)
        media_type = risposta.headers.get("content-type", "application/octet-stream").split(";")[0]
        return risposta.content, media_type

    def salva(self, percorso: str, contenuto: bytes, media_type: str) -> None:
        cosa = f"scrittura di {self._bucket}/{percorso}"
        risposta = _chiama(
            self._client,
            "POST",
            f"{self._storage}/object/{self._oggetto(percorso)}",
            cosa,
            content=contenuto,
            headers=_intestazioni(
                self._chiave, self._sessione, **{"content-type": media_type, "x-upsert": "true"}
            ),
        )
        if risposta.status_code in (400, 403) and "row-level security" in risposta.text.lower():
            raise AccessoNegato(f"{cosa}: fuori dalla propria cartella")
        _traduci(risposta, cosa)

    def firma_lettura(self, percorso: str, scade_in_s: int) -> str:
        cosa = f"firma di {self._bucket}/{percorso}"
        risposta = _chiama(
            self._client,
            "POST",
            f"{self._storage}/object/sign/{self._oggetto(percorso)}",
            cosa,
            json={"expiresIn": scade_in_s},
            headers=_intestazioni(self._chiave, self._sessione),
        )
        _traduci(risposta, cosa)
        relativo = risposta.json().get("signedURL") or risposta.json().get("signedUrl")
        if not isinstance(relativo, str):
            raise ArchivioNonDisponibile(f"{cosa}: lo Storage non ha restituito un indirizzo")
        return f"{self._storage}{relativo}" if relativo.startswith("/") else relativo


# ── le chiavi pubbliche dell'Auth ───────────────────────────────────────────

_NON_VERIFICO = "non riesco a verificare l'accesso: riprova fra poco"


class ChiaviAuthSupabase:
    """Il JWKS del progetto, in cache: le chiavi pubbliche con cui Supabase Auth
    firma i token.

    Si riscarica quando la cache invecchia, o quando arriva un `kid` che non
    conosce (una chiave ruotata), ma non più spesso di `ATTESA_MINIMA_S`: un
    token con un `kid` inventato non deve trasformarsi in una richiesta a
    Supabase per ogni chiamata. Senza nessuna chiave — il JWKS non risponde, o
    risponde qualcosa che non è un JWKS, e non ce n'è una in cache — si chiude:
    `AccessoNonDisponibile`, cioè 503.

    Delle chiavi pubblicate si tengono solo quelle che il backend sa usare (EC,
    ES256), una per una: una chiave di un altro tipo accanto a quella buona non
    deve far buttare tutto il set. E un `kid` già noto, con la cache fresca, si
    serve senza prendere il lock: non aspetta dietro un download lento che un
    `kid` inventato ha fatto partire."""

    DURATA_S = 600.0
    ATTESA_MINIMA_S = 30.0

    def __init__(self, url_progetto: str, client: httpx.Client | None = None) -> None:
        self._url = f"{url_progetto.rstrip('/')}/auth/v1/.well-known/jwks.json"
        self._client = client or nuovo_client()
        self._chiavi: dict[str, object] = {}
        self._scaricate_il = 0.0
        self._tentato_il = -self.ATTESA_MINIMA_S
        self._serratura = threading.Lock()

    def _scarica(self) -> None:
        self._tentato_il = time.monotonic()
        risposta = self._client.get(self._url)
        risposta.raise_for_status()
        corpo = risposta.json()
        elenco = corpo.get("keys") if isinstance(corpo, dict) else None
        if not isinstance(elenco, list):
            raise ValueError("il JWKS non ha un elenco di chiavi")
        chiavi: dict[str, object] = {}
        for dati in elenco:
            if not isinstance(dati, dict) or not isinstance(dati.get("kid"), str):
                continue
            if dati.get("kty") != "EC" or dati.get("alg", ALGORITMO) != ALGORITMO:
                continue
            try:
                chiavi[dati["kid"]] = jwt.PyJWK(dati).key
            except (jwt.PyJWTError, ValueError, TypeError) as exc:
                logger.warning("chiave %s del JWKS non leggibile, saltata: %s", dati["kid"], exc)
        if not chiavi:
            raise ValueError("il JWKS non ha nessuna chiave ES256 leggibile")
        self._chiavi = chiavi
        self._scaricate_il = time.monotonic()

    def chiave(self, kid: str) -> object | None:
        # Senza lock: `_chiavi` si sostituisce intero, mai si modifica, quindi
        # quello che si legge qui è un set completo, vecchio o nuovo.
        chiavi = self._chiavi
        if kid in chiavi and time.monotonic() - self._scaricate_il <= self.DURATA_S:
            return chiavi[kid]
        with self._serratura:
            adesso = time.monotonic()
            if adesso - self._tentato_il < self.ATTESA_MINIMA_S:
                # Un tentativo recente, riuscito o no: non si riprova ancora.
                if not self._chiavi:
                    raise AccessoNonDisponibile(_NON_VERIFICO)
                return self._chiavi.get(kid)
            vecchia = adesso - self._scaricate_il > self.DURATA_S
            if not self._chiavi or vecchia or kid not in self._chiavi:
                try:
                    self._scarica()
                except (httpx.HTTPError, ValueError) as exc:
                    logger.warning("JWKS di Supabase non utilizzabile: %s", exc)
                    if not self._chiavi:
                        raise AccessoNonDisponibile(_NON_VERIFICO) from exc
            return self._chiavi.get(kid)
