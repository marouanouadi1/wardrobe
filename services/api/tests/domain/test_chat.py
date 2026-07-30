"""domain.chat: come si costruisce, con memoria, la richiesta al modello."""

from __future__ import annotations

from conftest import ADESSO, OGGI
from domain.chat import MASSIMO_TURNI_CRONOLOGIA, cronologia_da_messaggi, richiesta_chat
from domain.models import MessaggioChat, RuoloChat
from domain.stylist import costruisci_contesto


def _messaggio(ruolo: RuoloChat, testo: str, *, indice: int) -> MessaggioChat:
    return MessaggioChat(id=f"m{indice}", ruolo=ruolo, testo=testo, creato_il=ADESSO)


class TestCronologiaDaMessaggi:
    def test_traduce_i_ruoli_per_il_provider(self):
        messaggi = [
            _messaggio(RuoloChat.UTENTE, "Cosa metto oggi?", indice=1),
            _messaggio(RuoloChat.TELA, '{"proposte": []}', indice=2),
        ]
        cronologia = cronologia_da_messaggi(messaggi)
        assert [turno.ruolo for turno in cronologia] == ["utente", "assistente"]
        assert cronologia[0].testo == "Cosa metto oggi?"

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
