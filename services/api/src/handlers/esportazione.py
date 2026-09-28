"""POST /esportazione — «Scarica i tuoi dati».

L'app chiede col suo token; qui si raccoglie tutto quello che è di quella
persona, **con lo stesso token** (ADR 0010), si compone lo zip, lo si carica
nella sua cartella dello Storage e si restituisce un indirizzo firmato dallo
Storage, che l'app apre nel browser di sistema — un'app React Native non ha un
«scarica», il browser sì.

L'indirizzo è una credenziale al portatore per un quarto d'ora, e finisce nella
cronologia del browser. La scelta è stata presa sapendolo (`Q-12`), e vale
finché la registrazione resta su invito (`Q-13`). Rispetto a prima non si
rigioca più una firma nostra: la firma è dello Storage, e l'indirizzo apre
**solo** quello zip.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

from domain.accesso import Sessione
from domain.errors import FotoNonTrovata
from domain.esportazione import componi_esportazione, senza_campi_interni
from domain.models import (
    ContenutoEsportazione,
    ConversazioneEsportata,
    EsportazionePronta,
)
from handlers._container import BUCKET_ESPORTAZIONI, BUCKET_FOTO, archivio, orologio, repository
from handlers._http import Evento, Risposta, endpoint, ok, sessione

#: Quindici minuti: il tempo fra il tocco e il download, non una settimana.
#: `Linking.openURL` lascia l'indirizzo nella cronologia del browser di sistema,
#: e questo indirizzo vale l'armadio intero più le conversazioni.
SCADENZA_S = 900

#: Sempre lo stesso nome: ogni esportazione sovrascrive la precedente, e di una
#: persona c'è al più una copia (docstring di domain/esportazione.py).
NOME_NELLO_STORAGE = "aura-i-tuoi-dati.zip"


@endpoint
def crea(evento: Evento) -> Risposta:
    chi = sessione(evento)
    adesso = orologio().adesso()

    percorso = f"{chi.utente_id}/{NOME_NELLO_STORAGE}"
    zip_ = archivio(chi, BUCKET_ESPORTAZIONI)
    zip_.salva(percorso, archivio_per(chi), "application/zip")
    # `download=` fa scegliere al browser il nome del file: con la data, perché
    # due esportazioni nella stessa cartella non si sovrascrivano in silenzio.
    url = f"{zip_.firma_lettura(percorso, SCADENZA_S)}&download={nome_file(adesso)}"
    return ok(EsportazionePronta(url=url, scade_il=adesso + timedelta(seconds=SCADENZA_S)))


def contenuto(chi: Sessione) -> ContenutoEsportazione:
    """Tutto quello che è di questa persona, letto adesso.

    Sta in un handler e non nel dominio perché **legge**: repository e archivio
    sono I/O. Ciò che resta puro — comporre lo zip — è in `domain/esportazione.py`,
    e si prova con i finti.
    """
    deposito = repository(chi)
    conversazioni = [
        ConversazioneEsportata(
            conversazione=conversazione,
            messaggi=deposito.elenca_messaggi_chat(conversazione.id, limite=10_000),
        )
        for conversazione in deposito.elenca_conversazioni_chat()
    ]
    return ContenutoEsportazione(
        esportato_il=orologio().adesso(),
        profilo=deposito.leggi_profilo(),
        capi=deposito.elenca_capi(),
        outfit=deposito.elenca_outfit(),
        conversazioni=conversazioni,
        segnalazioni=deposito.elenca_segnalazioni(),
    )


def _estensione(chiave: str, ripiego: str) -> str:
    coda = chiave.rsplit(".", 1)
    return coda[1] if len(coda) == 2 and 1 <= len(coda[1]) <= 5 else ripiego


def da_portare(dati: ContenutoEsportazione) -> list[tuple[str, str]]:
    """Le coppie `(percorso nello Storage, nome dentro lo zip)`.

    **Il nome viene dall'id del capo, non dal percorso.** Il percorso porta l'id
    dell'utente: usarlo tale e quale ricostruirebbe quell'albero dentro
    l'archivio, scrivendo un identificatore interno in ogni cartella di un file
    che la persona apre e magari gira a qualcun altro. L'id del capo invece
    **è già in `dati.json`**, quindi il LEGGIMI può dire una regola vera — «il
    capo `abc123` è `foto/abc123.jpg`» — e non c'è niente da deduplicare.

    Ci vanno **tre** cose, non una: la foto, la sua versione scontornata, che è
    un secondo file vero, e la foto a figura intera dell'avatar, cioè il file
    più personale che ci sia.
    """
    coppie: list[tuple[str, str]] = []
    for capo in dati.capi:
        coppie.append((capo.foto.chiave, f"{capo.id}.{_estensione(capo.foto.chiave, 'jpg')}"))
        if capo.foto.chiave_scontornata:
            estensione = _estensione(capo.foto.chiave_scontornata, "png")
            coppie.append((capo.foto.chiave_scontornata, f"{capo.id}-senza-sfondo.{estensione}"))
    if dati.profilo and dati.profilo.avatar_foto_chiave:
        chiave = dati.profilo.avatar_foto_chiave
        coppie.append((chiave, f"avatar.{_estensione(chiave, 'jpg')}"))
    return coppie


def archivio_per(chi: Sessione) -> bytes:
    """Lo zip completo: i dati, e le foto vere.

    **Le foto ci vanno dentro, non come link**: un archivio con gli indirizzi
    delle foto smetterebbe di essere una copia quando quegli indirizzi scadono.
    Per la stessa ragione, dal JSON i percorsi e gli indirizzi **si tolgono**.

    Una foto che **non c'è più** non fa cadere l'esportazione: si salta. Un
    archivio in meno di una foto sparita è ancora l'armadio di qualcuno. Uno
    Storage che non risponde invece la fa cadere: 502, e nessuno zip.
    """
    dati = contenuto(chi)
    foto = archivio(chi, BUCKET_FOTO)

    def leggi_tutte() -> list[tuple[str, bytes]]:
        raccolte: list[tuple[str, bytes]] = []
        for percorso, nome in da_portare(dati):
            try:
                contenuto_foto, _ = foto.leggi(percorso)
            except FotoNonTrovata:
                # Stretto di proposito: una foto che non c'è più si salta. Uno
                # Storage che non risponde no — lo zip uscirebbe con dei buchi
                # e un 200, e chi lo scarica crederebbe di avere tutto.
                continue
            raccolte.append((nome, contenuto_foto))
        return raccolte

    grezzo = dati.model_dump(mode="json")
    return componi_esportazione(
        json.dumps(senza_campi_interni(grezzo), ensure_ascii=False, indent=2), leggi_tutte()
    )


def nome_file(adesso: datetime) -> str:
    """`aura-i-tuoi-dati-2026-09-23.zip` — il nome con cui il browser lo salva."""
    return f"aura-i-tuoi-dati-{adesso.date().isoformat()}.zip"
