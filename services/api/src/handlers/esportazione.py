"""«Scarica i tuoi dati»: chi raccoglie, e chi mette insieme l'URL.

Il giro è in due tempi, e il motivo è che **un'app React Native non ha un
«scarica»**:

1. `POST /esportazione` — l'app chiede, col suo token. Qui si firma un URL a
   vita breve legato a *quell'* utente e lo si restituisce.
2. `GET /esportazione?utente=…&scade=…&firma=…` — l'apre il **browser di
   sistema**, che di scaricare sa. Non ha il token, e per questo l'URL è
   firmato: la firma è l'autorizzazione, e `local_server` la verifica prima di
   comporre alcunché.

**Detto con precisione**, perché la versione corta di questa frase è falsa e
qualcuno la userebbe per decidere: `expo-file-system` è già una dipendenza e
`src/dati/api.ts` ne importa già `File`, che sa fare
`downloadFileAsync(url, destinazione, { headers })` — cioè scaricare **col
bearer token**, senza una seconda credenziale e senza `utente` in una query.
Non lo facciamo per un motivo diverso: quel file atterra nella sandbox
dell'app, dove la persona non lo raggiunge, e portarcelo vuole un foglio di
condivisione, cioè `expo-sharing`. Quella sì è una dipendenza in più, su un
lock che qui ha già fatto male tre volte (`T-03`, `T-23`, `T-31`) — la stessa
risposta data a `expo-blur` nel piano del redesign.

Il prezzo lo paghiamo in chiaro: l'indirizzo firmato è **una credenziale al
portatore**, rigiocabile per tutta la sua vita, non revocabile se non ruotando
`JWT_SECRET`, e finisce nella cronologia del browser di sistema. La scelta è
stata presa sapendolo (`Q-12`, chiusa il 2026-09-23) perché **quel costo
cresce col numero di account**, e oggi sono le persone che lavorano al
progetto. **Si riapre quando `EMAIL_AMMESSE` smette di essere una lista di
persone che si conoscono** — la stessa condizione di `T-46` e `T-47`.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta

from domain.errors import ErroreDominio
from domain.esportazione import (
    componi_esportazione,
    firma_esportazione,
    senza_campi_interni,
)
from domain.models import (
    ContenutoEsportazione,
    ConversazioneEsportata,
    EsportazionePronta,
)
from handlers._container import archivio_foto, orologio, repository
from handlers._http import Evento, Risposta, endpoint, ok, utente_id

#: Quindici minuti. `url_lettura` delle foto vive **sette giorni**, e lì è una
#: scelta ragionata (`adapters/filesystem.py`: le miniature restano in memoria
#: per tutta la sessione). Qui no: `Linking.openURL` lascia l'indirizzo nella
#: cronologia del browser di sistema, e questo indirizzo vale l'armadio intero
#: più le conversazioni. Il tempo che serve è quello fra il tocco e il
#: download, non una settimana.
SCADENZA_S = 900


def _scadenza(adesso: datetime) -> datetime:
    return adesso + timedelta(seconds=SCADENZA_S)


@endpoint
def crea(evento: Evento) -> Risposta:
    """Firma l'indirizzo, non prepara niente.

    Non si costruisce lo zip qui e non lo si salva da nessuna parte: una copia
    completa dei dati di una persona in giacenza avrebbe bisogno di una
    scadenza e di qualcosa che la ripulisca, e la prossima voce delle
    impostazioni è «Elimina l'armadio» — una cancellazione che non trovasse
    quelle copie starebbe mentendo. L'archivio si compone quando lo si chiede.
    """
    utente = utente_id(evento)
    scade = _scadenza(orologio().adesso())
    scade_epoch = int(scade.timestamp())
    firma = firma_esportazione(utente, scade_epoch, os.environ["JWT_SECRET"])
    from adapters.filesystem import base_url

    indirizzo = f"{base_url()}/esportazione?utente={utente}&scade={scade_epoch}&firma={firma}"
    return ok(EsportazionePronta(url=indirizzo, scade_il=scade))


def contenuto(utente: str) -> ContenutoEsportazione:
    """Tutto quello che è di questa persona, letto adesso.

    Sta in un handler e non nel dominio perché **legge**: repository e archivio
    sono I/O. Ciò che resta puro — comporre lo zip, firmare — è in
    `domain/esportazione.py`, e si prova con i finti.
    """
    deposito = repository()
    conversazioni = [
        ConversazioneEsportata(
            conversazione=voce.conversazione,
            messaggi=deposito.elenca_messaggi_chat(utente, voce.conversazione.id, limite=10_000),
        )
        for voce in deposito.elenca_conversazioni_chat(utente)
    ]
    return ContenutoEsportazione(
        esportato_il=orologio().adesso(),
        profilo=deposito.leggi_profilo(utente),
        capi=deposito.elenca_capi(utente),
        outfit=deposito.elenca_outfit(utente),
        conversazioni=conversazioni,
        segnalazioni=deposito.elenca_segnalazioni(utente),
    )


def _estensione(chiave: str, ripiego: str) -> str:
    coda = chiave.rsplit(".", 1)
    return coda[1] if len(coda) == 2 and 1 <= len(coda[1]) <= 5 else ripiego


def da_portare(dati: ContenutoEsportazione) -> list[tuple[str, str]]:
    """Le coppie `(chiave d'archivio, nome dentro lo zip)`.

    **Il nome viene dall'id del capo, non dalla chiave.** Una chiave è un
    percorso (`capi/abc123.jpg`, e in produzione può portare l'id
    dell'utente): usarla tale e quale ricostruirebbe quell'albero dentro
    l'archivio, scrivendo un identificatore interno in ogni cartella di un file
    che la persona apre e magari gira a qualcun altro. L'id del capo invece
    **è già in `dati.json`**, quindi il LEGGIMI può dire una regola vera — «il
    capo `abc123` è `foto/abc123.jpg`» — e non c'è niente da deduplicare,
    perché due capi non hanno lo stesso id.

    Ci vanno **tre** cose, non una. La foto scontornata è un secondo file vero
    sull'archivio, non una vista della prima; e `avatar_foto_chiave` è la foto
    a figura intera della persona, cioè il file più personale che ci sia — era
    quello che un'esportazione non può permettersi di dimenticare.
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


def archivio_per(utente: str) -> bytes:
    """Lo zip completo: i dati, e le foto vere.

    **Le foto ci vanno dentro, non come link.** Un archivio che contenesse gli
    URL firmati delle foto smetterebbe di essere una copia nel momento in cui
    quegli URL scadono — sarebbe una copia che si svuota da sola. Il deck
    promette «puoi scaricare tutto» e «le foto dei capi restano tue»: un elenco
    di indirizzi morti non mantiene nessuna delle due. Per la stessa ragione,
    al contrario, dal JSON gli URL firmati **si tolgono**: non sono un dato, e
    in questo backend un URL firmato di lettura vale anche come scrittura
    (`T-46`).

    Una foto che non si riesce a leggere **non fa cadere l'esportazione**: si
    salta. Un archivio in meno di una foto è ancora l'armadio di qualcuno; un
    500 perché un file è sparito dal disco non è niente.
    """
    dati = contenuto(utente)
    deposito_foto = archivio_foto()

    def leggi_tutte() -> list[tuple[str, bytes]]:
        raccolte: list[tuple[str, bytes]] = []
        for chiave, nome in da_portare(dati):
            try:
                contenuto_foto, _ = deposito_foto.leggi(chiave)
            except (ErroreDominio, OSError):
                # Stretto di proposito, non un `except Exception`: una foto
                # che non c'è più sul disco si salta, ma un difetto vero
                # nell'archivio deve ancora arrivare fino in cima. Le due che
                # si catturano sono quelle che `_foto_get` tratta già come
                # «questa foto non c'è» (`ErroreDominio`) e il disco che non
                # risponde.
                continue
            raccolte.append((nome, contenuto_foto))
        return raccolte

    grezzo = dati.model_dump(mode="json")
    return componi_esportazione(
        json.dumps(senza_campi_interni(grezzo), ensure_ascii=False, indent=2), leggi_tutte()
    )


def nome_file(adesso: datetime | None = None) -> str:
    """`aura-i-tuoi-dati-2026-09-23.zip` — una data nel nome, perché due
    esportazioni nella stessa cartella non si sovrascrivano in silenzio."""
    giorno = (adesso or datetime.now(UTC)).date().isoformat()
    return f"aura-i-tuoi-dati-{giorno}.zip"
