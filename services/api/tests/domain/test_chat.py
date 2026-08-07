"""domain.chat: come si costruisce, con memoria, la richiesta al modello."""

from __future__ import annotations

import json

import pytest

from conftest import ADESSO, OGGI
from domain.chat import (
    MASSIMO_TURNI_CRONOLOGIA,
    cronologia_da_messaggi,
    interpreta_risposta_chat,
    richiesta_chat,
)
from domain.errors import ErroreDominio, SuggerimentoNonValido
from domain.models import Capo, MessaggioChat, RuoloChat, Suggerimento, Vestizione
from domain.stylist import costruisci_contesto


def _messaggio(
    ruolo: RuoloChat, testo: str, *, indice: int, suggerimenti: list[Suggerimento] | None = None
) -> MessaggioChat:
    return MessaggioChat(
        id=f"m{indice}",
        ruolo=ruolo,
        testo=testo,
        suggerimenti=suggerimenti or [],
        creato_il=ADESSO,
    )


class TestCronologiaDaMessaggi:
    def test_traduce_i_ruoli_per_il_provider(self):
        messaggi = [
            _messaggio(RuoloChat.UTENTE, "Cosa metto oggi?", indice=1),
            _messaggio(RuoloChat.WARDROBE, "Ti direi questo.", indice=2),
        ]
        cronologia = cronologia_da_messaggi(messaggi)
        assert [turno.ruolo for turno in cronologia] == ["utente", "assistente"]
        assert cronologia[0].testo == "Cosa metto oggi?"
        assert cronologia[1].testo == "Ti direi questo."

    def test_riappende_gli_id_delle_proposte_al_turno_di_wardrobe(self):
        # Senza gli id, «fa più freddo, cambia» non avrebbe niente a cui
        # appoggiarsi: `testo` da solo è ormai prosa libera.
        suggerimento = Suggerimento(
            titolo="Comodo",
            match=80,
            vestizione=Vestizione(top="t1", bottom="b1"),
            perche=["motivo"],
        )
        messaggi = [
            _messaggio(
                RuoloChat.WARDROBE,
                "Ti direi jeans e maglietta.",
                indice=1,
                suggerimenti=[suggerimento],
            ),
        ]
        cronologia = cronologia_da_messaggi(messaggi)
        assert "Ti direi jeans e maglietta." in cronologia[0].testo
        assert "t1" in cronologia[0].testo
        assert "b1" in cronologia[0].testo

    def test_un_turno_di_solo_testo_non_aggiunge_niente(self):
        messaggi = [_messaggio(RuoloChat.WARDROBE, "Figurati!", indice=1)]
        cronologia = cronologia_da_messaggi(messaggi)
        assert cronologia[0].testo == "Figurati!"

    def test_taglia_i_turni_piu_vecchi(self):
        messaggi = [_messaggio(RuoloChat.UTENTE, f"messaggio {n}", indice=n) for n in range(30)]
        cronologia = cronologia_da_messaggi(messaggi, limite=5)
        assert len(cronologia) == 5
        assert cronologia[0].testo == "messaggio 25"

    def test_di_default_rispetta_il_tetto_del_modulo(self):
        messaggi = [_messaggio(RuoloChat.UTENTE, f"m{n}", indice=n) for n in range(50)]
        assert len(cronologia_da_messaggi(messaggi)) == MASSIMO_TURNI_CRONOLOGIA


class TestRichiestaChat:
    def test_porta_system_prompt_e_cronologia_al_provider(self, armadio):
        contesto = costruisci_contesto(armadio, oggi=OGGI)
        precedenti = [_messaggio(RuoloChat.UTENTE, "Cosa metto oggi?", indice=1)]

        richiesta = richiesta_chat(
            contesto,
            precedenti,
            "finto-1",
            system_prompt="Prompt di prova",
            temperatura=0.3,
            max_token=800,
        )

        assert richiesta.system == "Prompt di prova"
        assert richiesta.forza_json is True
        assert richiesta.temperatura == 0.3
        assert richiesta.max_token == 800
        assert len(richiesta.cronologia) == 1
        assert richiesta.cronologia[0].testo == "Cosa metto oggi?"
        assert "capi_disponibili" in richiesta.prompt


class TestInterpretaRispostaChat:
    def test_prosa_senza_proposte_e_una_risposta_valida(self, armadio: list[Capo]):
        testo = json.dumps({"risposta": "Fa più o meno lo stesso di ieri.", "proposte": None})
        risposta = interpreta_risposta_chat(testo, armadio)
        assert risposta.risposta == "Fa più o meno lo stesso di ieri."
        assert risposta.proposte == []

    def test_prosa_con_proposte_valide(self, armadio: list[Capo]):
        testo = json.dumps(
            {
                "risposta": "Ti direi questo.",
                "proposte": [
                    {"titolo": "Comodo", "match": 80, "capi": ["t1", "b1"], "perche": ["motivo"]}
                ],
            }
        )
        risposta = interpreta_risposta_chat(testo, armadio)
        assert risposta.proposte[0].vestizione.top == "t1"

    def test_una_proposta_rotta_non_fa_fallire_il_turno(self, armadio: list[Capo]):
        # Un capo inventato in coda alla lista non deve buttare via la prosa:
        # è la differenza con `interpreta_suggerimenti`, che qui resta severa.
        testo = json.dumps(
            {
                "risposta": "Ti direi questo.",
                "proposte": [
                    {"titolo": "Rotta", "match": 80, "capi": ["non-esiste"], "perche": []}
                ],
            }
        )
        risposta = interpreta_risposta_chat(testo, armadio)
        assert risposta.risposta == "Ti direi questo."
        assert risposta.proposte == []

    def test_senza_risposta_e_un_errore(self, armadio: list[Capo]):
        with pytest.raises(SuggerimentoNonValido, match="risposta"):
            interpreta_risposta_chat(json.dumps({"proposte": []}), armadio)

    def test_json_irrecuperabile_e_un_errore(self, armadio: list[Capo]):
        with pytest.raises(ErroreDominio):
            interpreta_risposta_chat("non è json", armadio)
