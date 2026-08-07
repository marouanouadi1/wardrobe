"""domain.valutazione: confronto lettura-vs-verità, calibrazione, aggregazione.

Tutto puro, zero rete: la verità nota è scritta a mano nei test, esattamente
come la scriverà l'utente in `campioni.json`.
"""

from __future__ import annotations

from conftest import ADESSO
from domain.models import (
    AttributoCapo,
    CampioneValutazione,
    Colore,
    EsitoAttributo,
    EsitoEsecuzione,
    EsitoPlayground,
    LetturaCapo,
    TipoCapo,
    VeritaAttributo,
)
from domain.valutazione import (
    accuratezza,
    aggrega,
    calibrazione,
    campioni_da_json,
    confronta,
    confronta_attributo,
    distanza_hex,
    normalizza,
    valuta,
)


def _lettura(**campi: object) -> LetturaCapo:
    base: dict[str, object] = {"confidenze": {}}
    base.update(campi)
    return LetturaCapo.model_validate(base)


def _campione(**verita: VeritaAttributo) -> CampioneValutazione:
    return CampioneValutazione(id="c01", descrizione="prova", foto="c01.jpg", verita=verita)


class TestCampioniDaJson:
    def test_valida_una_lista_di_dizionari(self):
        grezzo = [{"id": "c01", "descrizione": "prova", "foto": "c01.jpg", "verita": {}}]
        campioni = campioni_da_json(grezzo)
        assert campioni == [CampioneValutazione(id="c01", descrizione="prova", foto="c01.jpg")]


class TestNormalizza:
    def test_ignora_accenti_maiuscole_e_punteggiatura(self):
        assert normalizza("Lino 100%!") == normalizza("lino 100")

    def test_ordine_delle_parole_non_conta(self):
        assert normalizza("misto lana") == normalizza("lana misto")


class TestDistanzaHex:
    def test_stesso_colore_distanza_zero(self):
        assert distanza_hex("#E7DFD2", "#E7DFD2") == 0

    def test_colori_diversi_distanza_positiva(self):
        assert distanza_hex("#000000", "#FFFFFF") > 400


class TestConfrontaAttributo:
    def test_senza_verita_e_non_valutato(self):
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, None, "Lino 100%", 90)
        assert giudizio.esito is EsitoAttributo.NON_VALUTATO

    def test_assente_e_il_modello_tace_e_esatto(self):
        verita = VeritaAttributo(assente=True)
        giudizio = confronta_attributo(AttributoCapo.LAVAGGIO, verita, None, None)
        assert giudizio.esito is EsitoAttributo.ESATTO

    def test_assente_ma_il_modello_risponde_e_inventato(self):
        verita = VeritaAttributo(assente=True)
        giudizio = confronta_attributo(AttributoCapo.LAVAGGIO, verita, "30°", 70)
        assert giudizio.esito is EsitoAttributo.INVENTATO

    def test_atteso_ma_il_modello_tace_e_mancante(self):
        verita = VeritaAttributo(attesi=["lino"])
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, verita, None, None)
        assert giudizio.esito is EsitoAttributo.MANCANTE

    def test_testo_che_contiene_l_atteso_e_esatto(self):
        verita = VeritaAttributo(attesi=["lino"])
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, verita, "Lino 100%", 90)
        assert giudizio.esito is EsitoAttributo.ESATTO

    def test_un_sinonimo_in_vicini_e_vicino(self):
        verita = VeritaAttributo(attesi=["panna"], vicini=["ecru", "avorio"])
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, verita, "écru", 80)
        assert giudizio.esito is EsitoAttributo.VICINO

    def test_niente_di_tutto_questo_e_sbagliato(self):
        verita = VeritaAttributo(attesi=["lino"], vicini=["cotone"])
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, verita, "poliestere", 80)
        assert giudizio.esito is EsitoAttributo.SBAGLIATO

    def test_colore_dentro_tolleranza_e_esatto(self):
        verita = VeritaAttributo(attesi=["panna"], hex="#E7DFD2", tolleranza_hex=40)
        colore = Colore(nome="Panna chiaro", hex="#E9E1D4")
        giudizio = confronta_attributo(AttributoCapo.COLORE, verita, colore, 90)
        assert giudizio.esito is EsitoAttributo.ESATTO

    def test_colore_a_meta_tolleranza_e_vicino(self):
        verita = VeritaAttributo(attesi=["panna"], hex="#000000", tolleranza_hex=10)
        colore = Colore(nome="Grigio scuro", hex="#0A0A0A")
        giudizio = confronta_attributo(AttributoCapo.COLORE, verita, colore, 90)
        assert giudizio.esito is EsitoAttributo.VICINO

    def test_colore_lontano_e_sbagliato(self):
        verita = VeritaAttributo(attesi=["nero"], hex="#000000", tolleranza_hex=10)
        colore = Colore(nome="Bianco", hex="#FFFFFF")
        giudizio = confronta_attributo(AttributoCapo.COLORE, verita, colore, 90)
        assert giudizio.esito is EsitoAttributo.SBAGLIATO

    def test_colore_senza_risposta_e_mancante(self):
        verita = VeritaAttributo(attesi=["nero"], hex="#000000")
        giudizio = confronta_attributo(AttributoCapo.COLORE, verita, None, None)
        assert giudizio.esito is EsitoAttributo.MANCANTE


class TestConfronta:
    def test_un_giudizio_per_attributo(self):
        lettura = _lettura(tipo=TipoCapo.TOP, colore=Colore(nome="Panna", hex="#E7DFD2"))
        campione = _campione(
            tipo=VeritaAttributo(attesi=["top"]),
            colore=VeritaAttributo(attesi=["panna"], hex="#E7DFD2"),
        )
        giudizi = confronta(lettura, campione)
        assert len(giudizi) == len(AttributoCapo)
        per_attributo = {g.attributo: g.esito for g in giudizi}
        assert per_attributo[AttributoCapo.TIPO] is EsitoAttributo.ESATTO
        assert per_attributo[AttributoCapo.COLORE] is EsitoAttributo.ESATTO
        assert per_attributo[AttributoCapo.MATERIALE] is EsitoAttributo.NON_VALUTATO


class TestAccuratezza:
    def test_lista_vuota_e_zero(self):
        assert accuratezza([]) == 0.0

    def test_tutto_non_valutato_e_zero(self):
        giudizi = [confronta_attributo(AttributoCapo.MATERIALE, None, "x", None)]
        assert accuratezza(giudizi) == 0.0

    def test_tipo_pesa_il_doppio_di_fantasia(self):
        # Tipo sbagliato e fantasia esatta: con pesi 2 e 1 il punteggio è
        # 1/3, non 1/2 come sarebbe con un peso uniforme.
        tipo_sbagliato = confronta_attributo(
            AttributoCapo.TIPO, VeritaAttributo(attesi=["top"]), "pantaloni", 90
        )
        fantasia_esatta = confronta_attributo(
            AttributoCapo.FANTASIA, VeritaAttributo(attesi=["tinta unita"]), "tinta unita", 90
        )
        assert accuratezza([tipo_sbagliato, fantasia_esatta]) == round(1 / 3, 4)

    def test_vicino_vale_meta(self):
        giudizio = confronta_attributo(
            AttributoCapo.MATERIALE,
            VeritaAttributo(attesi=["panna"], vicini=["ecru"]),
            "ecru",
            80,
        )
        assert accuratezza([giudizio]) == 0.5


class TestCalibrazione:
    def test_sicuro_e_sbagliato_viene_contato(self):
        giudizio = confronta_attributo(
            AttributoCapo.MATERIALE, VeritaAttributo(attesi=["lino"]), "poliestere", 95
        )
        esito = calibrazione([giudizio])
        assert esito.sicuri_e_sbagliati == 1
        assert esito.timidi_e_giusti == 0

    def test_timido_e_giusto_viene_contato(self):
        giudizio = confronta_attributo(
            AttributoCapo.MATERIALE, VeritaAttributo(attesi=["lino"]), "lino", 40
        )
        esito = calibrazione([giudizio])
        assert esito.timidi_e_giusti == 1
        assert esito.sicuri_e_sbagliati == 0

    def test_nessun_giudizio_valutabile_e_scarto_none(self):
        giudizio = confronta_attributo(AttributoCapo.MATERIALE, None, "x", 90)
        esito = calibrazione([giudizio])
        assert esito.scarto_confidenza is None

    def test_sopravvalutarsi_da_uno_scarto_positivo(self):
        giudizio = confronta_attributo(
            AttributoCapo.MATERIALE, VeritaAttributo(attesi=["lino"]), "poliestere", 90
        )
        esito = calibrazione([giudizio])
        assert esito.scarto_confidenza is not None
        assert esito.scarto_confidenza > 0


class TestValuta:
    def test_esito_fallito_diventa_una_riga_errore_senza_giudizi(self):
        esito = EsitoPlayground(
            ok=False,
            esito=EsitoEsecuzione.ERRORE,
            provider="anthropic",
            modello="claude-opus-5",
            latenza_ms=100,
            errore="JSON irrecuperabile",
        )
        valutazione = valuta(
            esito,
            _campione(),
            valutazione_id="v1",
            run_id="run-1",
            eseguita_il=ADESSO,
        )
        assert valutazione.esito is EsitoEsecuzione.ERRORE
        assert valutazione.giudizi == []
        assert valutazione.accuratezza == 0.0
        assert valutazione.errore == "JSON irrecuperabile"

    def test_esito_riuscito_produce_accuratezza_e_giudizi(self):
        lettura = _lettura(
            tipo=TipoCapo.TOP,
            colore=Colore(nome="Panna", hex="#E7DFD2"),
            confidenze={"tipo": 96, "colore": 90},
        )
        esito = EsitoPlayground(
            ok=True,
            esito=EsitoEsecuzione.OK,
            provider="anthropic",
            modello="claude-opus-5",
            latenza_ms=800,
            costo_eur=0.002,
            lettura=lettura,
        )
        campione = _campione(
            tipo=VeritaAttributo(attesi=["top"]),
            colore=VeritaAttributo(attesi=["panna"], hex="#E7DFD2"),
        )
        valutazione = valuta(
            esito, campione, valutazione_id="v1", run_id="run-1", eseguita_il=ADESSO
        )
        assert valutazione.accuratezza == 1.0
        assert valutazione.costo_eur == 0.002
        assert len(valutazione.giudizi) == len(AttributoCapo)

    def test_il_parametro_modello_sovrascrive_lo_snapshot_del_provider(self):
        """Anthropic risponde con lo snapshot datato, non con l'alias richiesto:
        il banco deve raggruppare per l'alias, non per lo snapshot che ruota."""
        esito = EsitoPlayground(
            ok=True,
            esito=EsitoEsecuzione.OK,
            provider="anthropic",
            modello="claude-haiku-4-5-20251001",
            latenza_ms=100,
            lettura=_lettura(),
        )
        valutazione = valuta(
            esito,
            _campione(),
            valutazione_id="v1",
            run_id="run-1",
            eseguita_il=ADESSO,
            modello="claude-haiku-4-5",
        )
        assert valutazione.modello == "claude-haiku-4-5"

    def test_il_parametro_modello_sovrascrive_anche_su_errore(self):
        esito = EsitoPlayground(
            ok=False,
            esito=EsitoEsecuzione.ERRORE,
            provider="anthropic",
            modello="claude-haiku-4-5-20251001",
            latenza_ms=100,
            errore="boom",
        )
        valutazione = valuta(
            esito,
            _campione(),
            valutazione_id="v1",
            run_id="run-1",
            eseguita_il=ADESSO,
            modello="claude-haiku-4-5",
        )
        assert valutazione.modello == "claude-haiku-4-5"


class TestAggrega:
    def _valutazione(self, provider: str, modello: str, *, accuratezza: float, costo: float | None):
        return valuta(
            EsitoPlayground(
                ok=True,
                esito=EsitoEsecuzione.OK,
                provider=provider,
                modello=modello,
                latenza_ms=500,
                costo_eur=costo,
                lettura=_lettura(
                    tipo=TipoCapo.TOP if accuratezza == 1.0 else TipoCapo.PANTALONI,
                    confidenze={"tipo": 90},
                ),
            ),
            _campione(tipo=VeritaAttributo(attesi=["top"])),
            valutazione_id=f"{provider}-{modello}",
            run_id="run-1",
            eseguita_il=ADESSO,
        )

    def test_raggruppa_per_provider_e_modello(self):
        valutazioni = [
            self._valutazione("anthropic", "claude-opus-5", accuratezza=1.0, costo=0.01),
            self._valutazione("anthropic", "claude-opus-5", accuratezza=0.0, costo=0.01),
            self._valutazione("google", "gemini-pro-latest", accuratezza=1.0, costo=0.02),
        ]
        righe = aggrega(valutazioni)
        assert len(righe) == 2
        anthropic = next(r for r in righe if r.provider == "anthropic")
        assert anthropic.campioni == 2
        assert anthropic.accuratezza_media == 0.5

    def test_ordina_per_accuratezza_decrescente(self):
        valutazioni = [
            self._valutazione("anthropic", "peggiore", accuratezza=0.0, costo=None),
            self._valutazione("google", "migliore", accuratezza=1.0, costo=None),
        ]
        righe = aggrega(valutazioni)
        assert [r.modello for r in righe] == ["migliore", "peggiore"]

    def test_costo_none_non_entra_nella_media(self):
        valutazioni = [
            self._valutazione("anthropic", "x", accuratezza=1.0, costo=None),
            self._valutazione("anthropic", "x", accuratezza=1.0, costo=0.02),
        ]
        righe = aggrega(valutazioni)
        assert righe[0].costo_medio_eur == 0.02
