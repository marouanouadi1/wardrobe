"""Le regole dell'armadio: filtri, incertezze, dormienti, vestizioni."""

from __future__ import annotations

from datetime import date

from conftest import ADESSO, OGGI, costruisci_capo
from domain.models import (
    AttributoCapo,
    Capo,
    Colore,
    FiltroArmadio,
    NuovoCapoManuale,
    SlotAvatar,
    StatoCapo,
    TipoCapo,
    Vestizione,
)
from domain.wardrobe import (
    attributi_incerti,
    colori_vestizione,
    correggi_attributo,
    crea_capo_manuale,
    dormienti,
    filtra,
    mesi_fa,
    per_id,
    riepilogo,
    segna_indossato,
    sintetizza,
    slot_da_tipo,
    vestizione_da_capi,
    vestizione_indossabile,
)


class TestFiltra:
    def test_senza_criteri_torna_tutto(self, armadio: list[Capo]):
        assert len(filtra(armadio, FiltroArmadio())) == len(armadio)

    def test_filtra_per_tipo(self, armadio: list[Capo]):
        assert len(filtra(armadio, FiltroArmadio(tipo=TipoCapo.TOP))) == 2

    def test_filtra_per_stato(self, armadio: list[Capo]):
        sporchi = filtra(armadio, FiltroArmadio(stato=StatoCapo.DA_LAVARE))
        assert [c.id for c in sporchi] == ["t2"]

    def test_cerca_anche_nel_materiale(self, armadio: list[Capo]):
        armadio = [*armadio, costruisci_capo("t9", nome="Camicia", materiale="Lino 100%")]
        trovati = filtra(armadio, FiltroArmadio(testo="lino"))
        assert [c.id for c in trovati] == ["t9"]

    def test_la_ricerca_ignora_le_maiuscole(self, armadio: list[Capo]):
        assert filtra(armadio, FiltroArmadio(testo="JEANS"))

    def test_i_criteri_si_sommano(self, armadio: list[Capo]):
        assert filtra(armadio, FiltroArmadio(tipo=TipoCapo.TOP, stato=StatoCapo.DA_LAVARE))
        assert not filtra(armadio, FiltroArmadio(tipo=TipoCapo.SCARPE, stato=StatoCapo.DA_LAVARE))


class TestAttributiIncerti:
    def test_segnala_solo_quelli_sotto_soglia(self):
        capo = costruisci_capo(
            "t1",
            confidenze={
                AttributoCapo.TIPO: 96,
                AttributoCapo.MATERIALE: 70,
                AttributoCapo.LAVAGGIO: 40,
            },
        )
        assert attributi_incerti(capo) == [AttributoCapo.LAVAGGIO, AttributoCapo.MATERIALE]

    def test_un_attributo_corretto_a_mano_non_e_piu_incerto(self):
        capo = costruisci_capo("t1", confidenze={AttributoCapo.MATERIALE: 20})
        corretto = correggi_attributo(capo, AttributoCapo.MATERIALE, "Lino 100%", ADESSO)
        assert attributi_incerti(corretto) == []
        assert corretto.materiale == "Lino 100%"

    def test_senza_analisi_non_c_e_incertezza(self):
        capo = costruisci_capo("t1").model_copy(update={"analisi": None})
        assert attributi_incerti(capo) == []


class TestCorreggiAttributo:
    def test_correggere_il_tipo_sposta_lo_slot(self):
        capo = costruisci_capo("t1", TipoCapo.TOP)
        corretto = correggi_attributo(capo, AttributoCapo.TIPO, TipoCapo.CAPOSPALLA, ADESSO)
        # Senza questo, un capospalla resterebbe appeso allo slot «sopra»
        # dell'avatar e l'outfit sarebbe sbagliato in silenzio.
        assert corretto.slot is slot_da_tipo(TipoCapo.CAPOSPALLA)

    def test_porta_la_confidenza_a_cento(self):
        capo = costruisci_capo("t1", confidenze={AttributoCapo.COLORE: 55})
        corretto = correggi_attributo(
            capo, AttributoCapo.COLORE, Colore(nome="Nero", hex="#111111"), ADESSO
        )
        assert corretto.analisi is not None
        assert corretto.analisi.confidenze[AttributoCapo.COLORE] == 100
        assert corretto.colore.hex == "#111111"

    def test_aggiorna_il_timestamp(self):
        capo = costruisci_capo("t1")
        corretto = correggi_attributo(capo, AttributoCapo.MATERIALE, "Lana", ADESSO)
        assert corretto.aggiornato_il == ADESSO


class TestDormienti:
    def test_mai_indossato_conta_come_dormiente(self):
        assert dormienti([costruisci_capo("t1")], OGGI) != []

    def test_indossato_ieri_no(self):
        recente = costruisci_capo("t1", ultimo_uso=date(2026, 7, 23))
        assert dormienti([recente], OGGI) == []

    def test_fermo_da_sette_mesi_si(self):
        vecchio = costruisci_capo("t1", ultimo_uso=date(2025, 12, 20))
        assert [c.id for c in dormienti([vecchio], OGGI)] == ["t1"]

    def test_il_confine_e_esattamente_sei_mesi(self):
        # 24 gennaio 2026 è esattamente il limite: non è ancora dormiente.
        al_limite = costruisci_capo("t1", ultimo_uso=date(2026, 1, 24))
        assert dormienti([al_limite], OGGI) == []
        appena_oltre = costruisci_capo("t2", ultimo_uso=date(2026, 1, 23))
        assert [c.id for c in dormienti([appena_oltre], OGGI)] == ["t2"]


class TestMesiFa:
    def test_torna_indietro_di_sei_mesi(self):
        assert mesi_fa(date(2026, 7, 24), 6) == date(2026, 1, 24)

    def test_attraversa_l_anno(self):
        assert mesi_fa(date(2026, 2, 10), 6) == date(2025, 8, 10)

    def test_non_inventa_il_31_febbraio(self):
        assert mesi_fa(date(2026, 3, 31), 1) == date(2026, 2, 28)

    def test_conosce_gli_anni_bisestili(self):
        assert mesi_fa(date(2024, 3, 31), 1) == date(2024, 2, 29)


class TestRiepilogo:
    def test_conta_totale_sporchi_e_dormienti(self, armadio: list[Capo]):
        numeri = riepilogo(armadio, OGGI)
        assert numeri.totale == 5
        assert numeri.da_lavare == 1
        assert numeri.dormienti == 5  # nessuno ha una data d'uso


class TestVestizione:
    def test_assegna_ogni_capo_al_suo_slot(self, armadio: list[Capo]):
        vestizione, scartati = vestizione_da_capi(["t1", "b1", "s1", "o1"], per_id(armadio))
        assert scartati == []
        assert (vestizione.top, vestizione.bottom) == ("t1", "b1")
        assert (vestizione.shoes, vestizione.outer) == ("s1", "o1")

    def test_il_secondo_capo_dello_stesso_slot_viene_scartato(self, armadio: list[Capo]):
        vestizione, scartati = vestizione_da_capi(["t1", "t2"], per_id(armadio))
        assert vestizione.top == "t1"
        assert scartati == ["t2"]

    def test_serve_sopra_e_sotto(self):
        assert not vestizione_indossabile(Vestizione(top="t1"))
        assert vestizione_indossabile(Vestizione(top="t1", bottom="b1"))

    def test_un_abito_basta_da_solo(self):
        assert vestizione_indossabile(Vestizione(dress="d1"))

    def test_risolve_la_vestizione_in_colori(self, armadio: list[Capo]):
        # È il ponte fra la visione e l'avatar: il manichino non riceve capi,
        # riceve cinque colori.
        vestizione = Vestizione(top="t1", bottom="b1", shoes="s1")
        colori = colori_vestizione(vestizione, per_id(armadio))
        assert colori.top == "#EFEBE3"
        assert colori.bottom == "#46536B"
        assert colori.shoes == "#EDE7DB"
        assert colori.outer is None

    def test_ignora_i_capi_che_non_esistono_piu(self, armadio: list[Capo]):
        colori = colori_vestizione(Vestizione(top="cancellato"), per_id(armadio))
        assert colori.top is None


class TestSegnaIndossato:
    def test_indossare_consuma_il_capo(self):
        capo = costruisci_capo("t1")
        usato = segna_indossato(capo, OGGI, ADESSO)
        assert usato.ultimo_uso == OGGI
        assert usato.volte_indossato == capo.volte_indossato + 1
        assert usato.stato is StatoCapo.DA_LAVARE


class TestCreaCapoManuale:
    def test_costruisce_un_capo_senza_analisi(self):
        nuovo = NuovoCapoManuale(
            nome="Camicia in lino",
            tipo=TipoCapo.TOP,
            colore=Colore(nome="Panna", hex="#E7DFD2"),
            chiave_foto="capi/demo/manuale.jpg",
        )
        capo = crea_capo_manuale(nuovo, capo_id="c1", adesso=ADESSO)
        assert capo.nome == "Camicia in lino"
        assert capo.slot is SlotAvatar.TOP
        assert capo.foto.chiave == "capi/demo/manuale.jpg"
        # Un capo inserito a mano non è mai passato da un modello: niente
        # confidenze da mostrare, e niente attributi incerti da correggere.
        assert capo.analisi is None
        assert attributi_incerti(capo) == []

    def test_lo_slot_segue_il_tipo_anche_a_mano(self):
        nuovo = NuovoCapoManuale(
            nome="Giacca",
            tipo=TipoCapo.CAPOSPALLA,
            colore=Colore(nome="Blu", hex="#112233"),
            chiave_foto="capi/demo/giacca.jpg",
        )
        capo = crea_capo_manuale(nuovo, capo_id="c2", adesso=ADESSO)
        assert capo.slot is slot_da_tipo(TipoCapo.CAPOSPALLA)

    def test_porta_etichette_e_appunti(self):
        nuovo = NuovoCapoManuale(
            nome="Felpa",
            tipo=TipoCapo.TOP,
            colore=Colore(nome="Grigio", hex="#AABBCC"),
            chiave_foto="capi/demo/felpa.jpg",
            etichette=["da lavoro", "comodo"],
            appunti="regalo di compleanno",
        )
        capo = crea_capo_manuale(nuovo, capo_id="c3", adesso=ADESSO)
        assert capo.etichette == ["da lavoro", "comodo"]
        assert capo.appunti == "regalo di compleanno"


class TestSintetizza:
    def test_porta_le_etichette_nel_contesto(self):
        capo = costruisci_capo("t1").model_copy(update={"etichette": ["da lavoro"]})
        sintetico = sintetizza(capo)
        assert sintetico.etichette == ["da lavoro"]

    def test_senza_etichette_la_lista_e_vuota(self):
        assert sintetizza(costruisci_capo("t1")).etichette == []
