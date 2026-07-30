"""Repository in memoria, seminato con l'armadio del design.

Esiste per una ragione pratica: `DEV_MODE=1 npm run api:local` dà all'app un
backend vero, con dodici capi e delle foto, senza aprire un account AWS. È il
modo più corto fra «ho clonato il repo» e «vedo l'armadio sul telefono».

Le foto sono di Pexels (uso libero), le stesse del design. Nel prodotto vero
sono gli scatti dell'utente.
"""

from __future__ import annotations

import base64
import os
from datetime import UTC, date, datetime, timedelta

import httpx

from domain.errors import ErroreDominio
from domain.models import (
    AnalisiVisione,
    AttributoCapo,
    Capo,
    Colore,
    EsecuzionePlayground,
    FotoCapo,
    Outfit,
    PreferenzeStile,
    Profilo,
    Stagione,
    StatoCapo,
    TipoCapo,
    UploadFirmato,
)
from domain.wardrobe import slot_da_tipo

# Un PNG 1x1 trasparente. Serve solo come corpo di una PUT finta: NON viene
# mai restituito da `leggi()`, perché un modello di visione che riceve un pixel
# trasparente risponde tutto null — e si passerebbe un'ora a sospettare il
# prompt invece dell'immagine.
_PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAX+j5XQAAAABJRU5ErkJggg=="
)


def _porta_locale() -> str:
    """La stessa porta su cui ascolta `local_server.py` (default 8787)."""
    return os.environ.get("PORTA", "8787")


def _foto_pexels(identificativo: int) -> str:
    return (
        f"https://images.pexels.com/photos/{identificativo}/pexels-photo-{identificativo}.jpeg"
        "?auto=compress&cs=tinysrgb&w=800&h=1000&fit=crop"
    )


Seme = tuple[str, str, str, TipoCapo, int, str, str, str, str, Stagione, str, str, int, int | None]

# La tabella dei semi. `fmt: off` perché qui la leggibilità sta nelle colonne
# allineate: esplosa a una voce per riga diventa duecento righe illeggibili.
# fmt: off
# (id, nome, brand, tipo, pexels, colore, hex, materiale, fantasia, stagione,
#  vestibilità, lavaggio, confidenza, giorni dall'ultimo uso)
_SEMI: tuple[Seme, ...] = (
    ("t1", "T-shirt bianca",      "Uniqlo",         TipoCapo.TOP,        18257675, "Bianco ottico", "#EFEBE3", "Cotone 100%",            "Tinta unita", Stagione.TUTTO_LANNO,   "Regular",  "30°",              96,   3),
    ("t2", "T-shirt nera",        "COS",            TipoCapo.TOP,        18186105, "Nero",          "#1C1C21", "Cotone pesante",         "Tinta unita", Stagione.TUTTO_LANNO,   "Boxy",     "30° rovescio",     94,   6),
    ("t3", "Camicia in lino",     "Arket",          TipoCapo.TOP,        37704849, "Panna",         "#E7DFD2", "Lino 100%",              "Tinta unita", Stagione.ESTATE,        "Oversize", "40° stira umida",  88,  11),
    ("t4", "Maglione di lana",    "Arket",          TipoCapo.TOP,        14553511, "Bianco caldo",  "#E4DED2", "Lana merino 80%",        "Tinta unita", Stagione.INVERNO,       "Regular",  "A mano",           81, 120),
    ("b1", "Jeans dritti",        "Levi's 501",     TipoCapo.PANTALONI,  17630811, "Indaco medio",  "#46536B", "Denim cotone 100%",      "Tinta unita", Stagione.TUTTO_LANNO,   "Dritta",   "30° rovescio",     95,   1),
    ("b2", "Jeans chiari",        "Weekday",        TipoCapo.PANTALONI,   8217466, "Indaco chiaro", "#8496AE", "Denim leggero",          "Tinta unita", Stagione.PRIMAVERA,     "Loose",    "30°",              90,   9),
    ("b3", "Pantalone cammello",  "Massimo Dutti",  TipoCapo.PANTALONI,   9558716, "Cammello",      "#A9805A", "Cotone 98%, elastan 2%", "Tinta unita", Stagione.MEZZA_STAGIONE,"Slim",     "30°",              86,  30),
    ("b4", "Gonna nera",          "Zara",           TipoCapo.PANTALONI,  19215446, "Nero",          "#232328", "Misto lana",             "Tinta unita", Stagione.INVERNO,       "Midi",     "Lavasecco",        79, 190),
    ("s1", "Sneaker bianche",     "Veja",           TipoCapo.SCARPE,      2529148, "Bianco crema",  "#EDE7DB", "Pelle riciclata",        "Tinta unita", Stagione.TUTTO_LANNO,   "43",       "Panno umido",      97,   1),
    ("s2", "Stivaletti neri",     "Dr. Martens",    TipoCapo.SCARPE,      1321875, "Nero",          "#1D1D20", "Pelle",                  "Tinta unita", Stagione.TUTTO_LANNO,   "43",       "Spazzola a secco", 93,   8),
    ("o1", "Giacca di jeans",     "Levi's Trucker", TipoCapo.CAPOSPALLA,  7514171, "Indaco chiaro", "#6B85A6", "Denim rigido",           "Tinta unita", Stagione.PRIMAVERA,     "Regular",  "Raramente",        92,  12),
    ("o2", "Cardigan panna",      "Mango",          TipoCapo.CAPOSPALLA, 19136784, "Panna",         "#DED7C9", "Lana e cotone",          "Tinta unita", Stagione.AUTUNNO,       "Oversize", "A mano",           84, 210),
)
# fmt: on

# La foto vera di ogni capo seminato, per chiave d'archivio: così il playground
# può analizzare un capo di esempio senza che nessuno abbia caricato niente.
_URL_DEI_SEMI: dict[str, str] = {f"semi/{seme[0]}.jpg": _foto_pexels(seme[4]) for seme in _SEMI}

_DA_LAVARE = {"t2", "b2", "s2"}
_PREFERITI = {"t1", "b1"}


def _capo_da_seme(seme: Seme, oggi: date, adesso: datetime) -> Capo:
    (
        capo_id,
        nome,
        brand,
        tipo,
        pexels,
        colore,
        esa,
        materiale,
        fantasia,
        stagione,
        vestibilita,
        lavaggio,
        confidenza,
        giorni,
    ) = seme

    # Le confidenze del design: alcune volutamente basse, così nell'app si vede
    # subito com'è fatto un attributo incerto.
    confidenze = {
        AttributoCapo.TIPO: confidenza,
        AttributoCapo.COLORE: min(99, confidenza + 3),
        AttributoCapo.MATERIALE: confidenza - 8,
        AttributoCapo.FANTASIA: confidenza - 2,
        AttributoCapo.STAGIONE: confidenza - 11,
        AttributoCapo.VESTIBILITA: confidenza - 14,
        AttributoCapo.LAVAGGIO: confidenza - 5,
    }

    return Capo(
        id=capo_id,
        nome=nome,
        brand=brand,
        tipo=tipo,
        slot=slot_da_tipo(tipo),
        colore=Colore(nome=colore, hex=esa),
        foto=FotoCapo(chiave=f"semi/{capo_id}.jpg", url=_foto_pexels(pexels)),
        materiale=materiale,
        fantasia=fantasia,
        stagione=stagione,
        vestibilita=vestibilita,
        lavaggio=lavaggio,
        stato=StatoCapo.DA_LAVARE if capo_id in _DA_LAVARE else StatoCapo.PULITO,
        preferito=capo_id in _PREFERITI,
        ultimo_uso=(oggi - timedelta(days=giorni)) if giorni is not None else None,
        volte_indossato=max(1, 40 // max(giorni or 40, 1)),
        analisi=AnalisiVisione(
            provider="anthropic",
            modello="claude-opus-5",
            eseguita_il=adesso,
            confidenze={k: max(0, min(100, v)) for k, v in confidenze.items()},
        ),
        creato_il=adesso,
        aggiornato_il=adesso,
    )


class ArchivioInMemoria:
    """Archivio foto per lo sviluppo.

    Le foto caricate stanno in memoria. Per i capi seminati invece scarica lo
    scatto vero da Pexels: è ciò che permette di provare il modello di visione
    dal playground senza aver caricato niente. Se non riesce lo dice, invece di
    restituire un'immagine vuota che farebbe sembrare stupido il modello.
    """

    def __init__(self) -> None:
        self._oggetti: dict[str, bytes] = {}
        self._scaricate: dict[str, bytes] = {}

    def url_upload(self, chiave: str, content_type: str, scade_in_s: int = 900) -> UploadFirmato:
        self._oggetti[chiave] = _PIXEL
        return UploadFirmato(
            chiave=chiave,
            # In locale non c'è S3: la PUT vera dell'app atterra su una rotta
            # di `local_server.py` che scrive nel dizionario qui sotto — vedi
            # `scrivi()`. Senza questo, la PUT finiva su un indirizzo che il
            # backend non rileggeva mai, e `leggi()` restituiva il pixel
            # finto anche per foto vere.
            url=f"http://localhost:{_porta_locale()}/dev/foto/{chiave}",
            intestazioni={"content-type": content_type},
            scade_in_s=scade_in_s,
        )

    def url_lettura(self, chiave: str, scade_in_s: int = 3600) -> str:
        del scade_in_s
        return f"http://localhost:{_porta_locale()}/dev/foto/{chiave}"

    def salva(self, chiave: str, contenuto: bytes, media_type: str) -> None:
        """Riceve il corpo della PUT vera dell'app, o una foto scontornata.

        `media_type` è ignorato qui (`leggi()` restituisce sempre
        «image/png» per gli oggetti caricati): in memoria non c'è un posto
        dove tenerlo per chiave, ed è un dettaglio che conta solo per S3.
        """
        del media_type
        self._oggetti[chiave] = contenuto

    def leggi(self, chiave: str) -> tuple[bytes, str]:
        caricata = self._oggetti.get(chiave)
        if caricata is not None:
            return caricata, "image/png"

        scaricata = self._scaricate.get(chiave)
        if scaricata is not None:
            return scaricata, "image/jpeg"

        url = _URL_DEI_SEMI.get(chiave)
        if url is None:
            raise ErroreDominio(
                f"la foto «{chiave}» non è in questo archivio: caricane una, "
                "oppure usa la chiave di un capo di esempio (semi/t1.jpg…)"
            )

        try:
            risposta = httpx.get(url, timeout=20, follow_redirects=True)
            risposta.raise_for_status()
        except httpx.HTTPError as exc:
            raise ErroreDominio(f"non riesco a scaricare la foto di esempio: {exc}") from exc

        self._scaricate[chiave] = risposta.content
        return risposta.content, "image/jpeg"


class RepositoryInMemoria:
    """Sta in piedi solo dentro un processo: perfetto per lo sviluppo e i test."""

    def __init__(self) -> None:
        self._capi: dict[str, dict[str, Capo]] = {}
        self._outfit: dict[str, dict[str, Outfit]] = {}
        self._profili: dict[str, Profilo] = {}
        self._usi: set[tuple[str, str, date]] = set()
        self._playground: list[EsecuzionePlayground] = []

    @classmethod
    def con_semi(cls, utente_id: str = "demo") -> RepositoryInMemoria:
        repo = cls()
        adesso = datetime.now(UTC)
        oggi = adesso.date()

        for seme in _SEMI:
            capo = _capo_da_seme(seme, oggi, adesso)
            repo.salva_capo(utente_id, capo)

        repo.salva_profilo(
            Profilo(
                id=utente_id,
                nome="Youssef B.",
                citta="Milano",
                preferenze=PreferenzeStile(
                    stili=["comodo", "classico"],
                    palette=["neutri", "terra"],
                    evita=["fantasie vistose"],
                ),
                creato_il=adesso,
            )
        )
        return repo

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

    # ── uso e playground ───────────────────────────────────────────────────
    def registra_uso(self, utente_id: str, capo_ids: list[str], giorno: date) -> None:
        for capo_id in capo_ids:
            self._usi.add((utente_id, capo_id, giorno))

    def storico_playground(self, limite: int = 20) -> list[EsecuzionePlayground]:
        return sorted(self._playground, key=lambda e: e.eseguita_il, reverse=True)[:limite]

    def salva_esecuzione_playground(self, esecuzione: EsecuzionePlayground) -> None:
        self._playground.append(esecuzione)
