"""«Scarica i tuoi dati»: comporre l'archivio.

Lo zip si compone qui perché è **calcolo puro** — `zipfile` non fa I/O. Chi legge
le tabelle e le foto resta fuori: `handlers/esportazione.py` raccoglie, con il
token di chi chiede (ADR 0010), e questo modulo compone.

**Dove finisce, e perché una copia sola.** Il browser di sistema, che sa
scaricare, non ha il token dell'app; e il backend, senza quel token, non legge
niente. Quindi lo zip si carica nella cartella di chi lo chiede nello Storage
(`esportazioni/{utente_id}/`), **sempre con lo stesso nome**, e si restituisce un
indirizzo firmato dallo Storage che vale un quarto d'ora. Ogni esportazione
sovrascrive la precedente: di una persona c'è al più una copia, nella sua
cartella, e se ne va con il resto dei suoi file.
"""

from __future__ import annotations

import io
import zipfile
from collections.abc import Iterable


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
  conosciamo nemmeno noi (chi gestisce l'accesso ne tiene solo un'impronta da
  cui non si torna indietro).
- Il registro di quando hai messo cosa: Aura lo scrive ma non lo rilegge
  ancora da nessuna parte, quindi non c'e' niente da darti.

Il file e' tuo. Una copia dell'ultimo che hai chiesto resta nella tua
cartella privata di Aura, finche' non ne chiedi un altro: la sostituisce.
"""


#: I campi che non sono un dato della persona ma un **indirizzo interno**, e
#: che da un archivio destinato a girare vanno tolti. Due famiglie, due motivi:
#:
#: - gli **URL firmati** (`url`, `url_scontornata`, `foto_url`): scadono, quindi
#:   non sono una copia di niente;
#: - le **chiavi d'archivio** (`chiave`, `chiave_scontornata`,
#:   `avatar_foto_chiave`): il percorso del file nel nostro Storage, che porta
#:   l'id dell'utente. Per chi apre lo zip non valgono niente — le foto le
#:   ritrova dall'id del capo, la regola scritta nel LEGGIMI — e in un file che
#:   la persona conserva, e magari gira, un identificatore interno non serve.
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
    fallisca.
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


__all__ = ["CAMPI_INTERNI", "componi_esportazione", "senza_campi_interni"]
