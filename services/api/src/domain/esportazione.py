"""«Scarica i tuoi dati»: comporre l'archivio, e firmare chi può prenderlo.

Due cose stanno qui perché sono **calcolo puro** — `zipfile`, `hmac` e
`hashlib` non fanno I/O, come `bcrypt` e `pyjwt` in `domain/autenticazione.py`:
stesso confine, stesso posto. Chi legge il database e chi legge le foto resta
fuori: `handlers/esportazione.py` raccoglie, questo modulo compone.

**Perché non si salva da nessuna parte.** La strada facile sarebbe scrivere lo
zip nell'archivio e restituirne l'URL. Lascerebbe però una copia completa dei
dati di una persona in giacenza, senza scadenza e senza niente che la ripulisca
— e la prossima voce delle impostazioni è «Elimina l'armadio»: una
cancellazione che non trovasse quelle copie starebbe mentendo. L'archivio si
compone **al momento della richiesta** e non esiste prima né dopo.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import zipfile
from collections.abc import Iterable
from urllib.parse import parse_qs

#: Separa questa firma da quella delle foto. `firma_foto` firma
#: `f"{chiave}:{scade}"`, e senza prefisso una firma d'esportazione avrebbe la
#: stessa forma di una firma di foto per la chiave `<utente_id>`: chi ottiene
#: l'una potrebbe rigiocarla come l'altra.
#:
#: **Da cosa viene davvero la separazione**, perché chi un giorno volesse
#: «semplificare» questo prefisso sappia cosa toglie. Non da una proprietà
#: delle chiavi: una chiave di foto *sembra* un percorso, ma `chiave_foto` è
#: una `str` libera in `RichiestaAnalisi` e un JSON può scriverci `\u0000` —
#: quella garanzia non la impone nessuno. Viene invece dalla forma dei due
#: messaggi: entrambi finiscono con `separatore + cifre ASCII`, e il separatore
#: è `:` da una parte e `\x00` dall'altra. Perché coincidessero, lo stesso
#: byte dovrebbe essere insieme `:` e NUL. E poiché **entrambi** i lati
#: rigenerano la scadenza da un `int`, nemmeno le grafie Unicode delle cifre
#: possono produrre due messaggi diversi per la stessa firma.
_CONTESTO = b"esportazione\x00"


def _messaggio(utente_id: str, scade_epoch: int) -> bytes:
    return _CONTESTO + utente_id.encode() + b"\x00" + str(scade_epoch).encode()


def firma_esportazione(utente_id: str, scade_epoch: int, segreto: str) -> str:
    digest = hmac.new(segreto.encode(), _messaggio(utente_id, scade_epoch), hashlib.sha256)
    return digest.hexdigest()


def firma_esportazione_valida(
    utente_id: str, scade_epoch: int, firma: str, segreto: str, adesso_epoch: int
) -> bool:
    """`False` se la firma non corrisponde, o se è già scaduta.

    `compare_digest` e non `==`: un confronto di stringhe si ferma al primo
    carattere diverso, e il tempo che ci mette racconta quanti ne ha
    indovinati. Stessa ragione di `firma_foto.firma_valida`.

    Ma su **byte**, non su `str`: `compare_digest` fra stringhe solleva
    `TypeError` appena una delle due esce dall'ASCII, e la `firma` arriva da
    una query, cioè da fuori. Un `?firma=é` non deve diventare un'eccezione in
    un ramo che non ha chi la traduca in uno status — deve diventare un `False`.
    """
    if adesso_epoch > scade_epoch:
        return False
    atteso = firma_esportazione(utente_id, scade_epoch, segreto).encode()
    return hmac.compare_digest(atteso, firma.encode())


def utente_da_query(query: str, segreto: str, adesso_epoch: int) -> str | None:
    """Da `?utente=…&scade=…&firma=…` all'utente autorizzato, o `None`.

    **Sta qui e non nel ramo di `local_server.py`** che la usa, e non è una
    preferenza di stile: quel file è l'unico escluso dal conto della coverage
    degli handler, quindi ogni riga che ci stesse sarebbe non provata per
    costruzione — e questa è la riga che decide di chi è l'armadio che si sta
    per consegnare.

    Ogni ingresso malformato torna `None`, mai un'eccezione. Il ramo che la
    chiama è **fuori da `@endpoint`**, quindi non ha il `except` che traduce un
    errore in uno status: un'eccezione qui uscirebbe dal thread e chiuderebbe
    la connessione senza risposta né codice. Due modi concreti di farlo
    succedere, entrambi provati: `scade=²` — `'²'.isdigit()` è **vero**, è un
    apice, e `int('²')` solleva — e una `firma` non-ASCII, che fa sollevare
    `compare_digest`. Da qui `isdecimal()` e il confronto su `bytes`.
    """
    parametri = parse_qs(query)
    utente = parametri.get("utente", [""])[0]
    scade = parametri.get("scade", [""])[0]
    firma = parametri.get("firma", [""])[0]
    if not utente or not firma or not scade.isdecimal() or len(scade) > 20:
        return None
    if not firma_esportazione_valida(utente, int(scade), firma, segreto, adesso_epoch):
        return None
    return utente


def componi_esportazione(
    dati: str,
    foto: Iterable[tuple[str, bytes]],
) -> bytes:
    """Lo zip: un `dati.json` e una cartella `foto/`.

    `dati` arriva già serializzato — è `ContenutoEsportazione.model_dump_json()`,
    fatto da chi ha i modelli in mano. Le foto arrivano come coppie
    `(nome, byte)`, **già lette**: così questa funzione non sa cosa sia un
    archivio né un disco, e si prova con un dizionario.

    `ZIP_DEFLATED` e non `ZIP_STORED`: le foto sono già compresse e non
    guadagnano niente, ma il JSON di un armadio pieno è testo molto ripetitivo
    e si riduce di parecchio. Il costo è trascurabile rispetto alla lettura
    delle foto.
    """
    tampone = io.BytesIO()
    with zipfile.ZipFile(tampone, "w", zipfile.ZIP_DEFLATED) as archivio:
        archivio.writestr("dati.json", dati)
        archivio.writestr("LEGGIMI.txt", _LEGGIMI)
        for nome, contenuto in foto:
            archivio.writestr(f"foto/{nome}", contenuto)
    return tampone.getvalue()


_LEGGIMI = """I tuoi dati di Aura
===================

dati.json  — i capi, gli outfit salvati, il profilo con le misure, le
             conversazioni con lo stilista (con tutti i turni) e le
             segnalazioni che hai mandato.
foto/      — le foto dei capi, una per capo, col nome dell'id che trovi in
             dati.json: il capo `abc123` è `foto/abc123.jpg`. Se una foto e'
             stata scontornata trovi anche `foto/abc123-senza-sfondo.png`.
             La tua foto a figura intera, se l'hai data, e' `foto/avatar.jpg`.

Cosa NON c'e' dentro, e perche'
-------------------------------
- Gli indirizzi web temporanei delle foto: scadono, e non sono un dato tuo —
  le foto vere ce le hai gia' qui dentro.
- La tua email e la tua password: l'email la sai, la password non la
  conosciamo nemmeno noi (ne teniamo solo un'impronta da cui non si torna
  indietro).
- Il registro di quando hai messo cosa: Aura lo scrive ma non lo rilegge
  ancora da nessuna parte, quindi non c'e' niente da darti.

Il file e' tuo: nessuno te lo ha chiesto e nessuno sa che lo hai scaricato.
Se cancelli l'armadio, questa copia resta.
"""


#: I campi che non sono un dato della persona ma un **indirizzo interno**, e
#: che da un archivio destinato a girare vanno tolti. Due famiglie, due motivi:
#:
#: - gli **URL firmati** (`url`, `url_scontornata`, `foto_url`) sono decorazione
#:   di risposta, minta dall'adapter a ogni lettura: scadono, quindi non sono
#:   una copia di niente, e in questo backend un indirizzo firmato di lettura
#:   vale anche come `PUT` (`T-46`);
#: - le **chiavi d'archivio** (`chiave`, `chiave_scontornata`,
#:   `avatar_foto_chiave`) sono il percorso del file sul nostro storage. Per chi
#:   apre lo zip non valgono niente — le foto le riappaia dall'id del capo, che
#:   è la regola scritta nel LEGGIMI — mentre per chi le ottiene valgono
#:   parecchio: `POST /capi/analisi` accetta una `chiave_foto` **senza
#:   controllare di chi sia** (`T-47`), e da lì si arriva a leggere e
#:   sovrascrivere la foto di un altro. Metterle in chiaro in un file che il
#:   prodotto invita a conservare trasformerebbe una debolezza teorica in una
#:   sfruttabile: questa fetta non la allarga.
CAMPI_INTERNI = frozenset(
    {
        "url",
        "url_scontornata",
        "foto_url",
        "chiave",
        "chiave_scontornata",
        "avatar_foto_chiave",
    }
)


def senza_campi_interni(valore: object) -> object:
    """Toglie i campi di `CAMPI_INTERNI` a qualunque profondità.

    **Per nome e ricorsiva, non con un `exclude` di Pydantic**: un `exclude`
    elenca i percorsi di oggi e tace su quelli di domani — un campo `url`
    aggiunto fra un anno dentro un modello annidato passerebbe senza che niente
    fallisca. Il difetto vero lo prende il gate: `test_esportazione` pretende
    che in `dati.json` non compaia **mai** la stringa `firma=`, qualunque forma
    prendano i modelli.
    """
    if isinstance(valore, dict):
        return {
            nome: senza_campi_interni(dentro)
            for nome, dentro in valore.items()
            if nome not in CAMPI_INTERNI
        }
    if isinstance(valore, list):
        return [senza_campi_interni(dentro) for dentro in valore]
    return valore


__all__ = [
    "CAMPI_INTERNI",
    "componi_esportazione",
    "firma_esportazione",
    "firma_esportazione_valida",
    "senza_campi_interni",
    "utente_da_query",
]
