from __future__ import annotations

from conftest import ADESSO
from domain.models import StatoSegnalazione
from domain.segnalazioni import cambia_stato, crea_segnalazione


class TestCreaSegnalazione:
    def test_nasce_ricevuta(self):
        segnalazione = crea_segnalazione(
            "l'app si è chiusa caricando una foto",
            segnalazione_id="s1",
            utente_id="demo",
            adesso=ADESSO,
        )

        assert segnalazione.stato == StatoSegnalazione.RICEVUTA
        assert segnalazione.utente_id == "demo"
        assert segnalazione.creata_il == ADESSO
        assert segnalazione.aggiornata_il == ADESSO


class TestCambiaStato:
    def test_aggiorna_stato_e_data(self):
        segnalazione = crea_segnalazione(
            "il colore non si vede sull'avatar",
            segnalazione_id="s1",
            utente_id="demo",
            adesso=ADESSO,
        )
        piu_tardi = ADESSO.replace(hour=18)

        aggiornata = cambia_stato(segnalazione, StatoSegnalazione.IN_LAVORAZIONE, piu_tardi)

        assert aggiornata.stato == StatoSegnalazione.IN_LAVORAZIONE
        assert aggiornata.aggiornata_il == piu_tardi
        # Il resto della segnalazione non cambia.
        assert aggiornata.id == segnalazione.id
        assert aggiornata.testo == segnalazione.testo
        assert aggiornata.creata_il == segnalazione.creata_il
