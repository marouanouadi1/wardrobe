"""Le segnalazioni: logica pura, senza I/O.

`crea_segnalazione` e `cambia_stato` sono le due sole operazioni che il
dominio conosce — chi può chiamarle (chiunque per la prima, solo
l'amministratore per la seconda) è una decisione HTTP, e vive in
`handlers/segnalazioni.py`, non qui.
"""

from __future__ import annotations

from datetime import datetime

from domain.models import Segnalazione, StatoSegnalazione


def crea_segnalazione(
    testo: str, *, segnalazione_id: str, utente_id: str, adesso: datetime
) -> Segnalazione:
    return Segnalazione(
        id=segnalazione_id,
        utente_id=utente_id,
        testo=testo,
        stato=StatoSegnalazione.RICEVUTA,
        creata_il=adesso,
        aggiornata_il=adesso,
    )


def cambia_stato(
    segnalazione: Segnalazione, stato: StatoSegnalazione, adesso: datetime
) -> Segnalazione:
    return segnalazione.model_copy(update={"stato": stato, "aggiornata_il": adesso})
