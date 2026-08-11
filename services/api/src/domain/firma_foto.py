"""Firma HMAC per le URL delle foto: a vita breve, verificabile senza stato.

`/foto/{chiave}` (vedi `handlers/local_server.py`) è il bersaglio reale di
`ArchivioFileSystem`/`ArchivioInMemoria`: senza una firma, chiunque conosca —
o indovini — una chiave potrebbe leggere o sovrascrivere qualunque foto
sull'archivio, PUT compresa. `hmac`/`hashlib` sono calcolo puro come `bcrypt`
e `pyjwt` in `domain/autenticazione.py`: stesso confine, stesso posto.
"""

from __future__ import annotations

import hashlib
import hmac


def firma_foto(chiave: str, scade_epoch: int, segreto: str) -> str:
    messaggio = f"{chiave}:{scade_epoch}".encode()
    return hmac.new(segreto.encode(), messaggio, hashlib.sha256).hexdigest()


def firma_valida(
    chiave: str, scade_epoch: int, firma: str, segreto: str, adesso_epoch: int
) -> bool:
    """`False` se la firma non corrisponde, o se la scadenza è già passata —
    `compare_digest` per non aprire un canale a tempo su un confronto di
    stringhe che altrimenti si fermerebbe al primo carattere sbagliato."""
    if adesso_epoch > scade_epoch:
        return False
    return hmac.compare_digest(firma_foto(chiave, scade_epoch, segreto), firma)
