"""`domain/accesso.py`: il token che dimostra chi chiama, e i percorsi suoi.

La verifica si prova con token veri firmati ES256 (le chiavi di prova del
conftest). I casi che contano sono quelli che **non** devono passare: ognuno è
un modo noto di spacciarsi per qualcun altro.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from conftest import CHIAVI, EMITTENTE
from domain.accesso import (
    Sessione,
    basta_per_un_lavoro_lungo,
    emittente_di,
    percorso_dell_utente,
    verifica_token,
)

A = "00000000-0000-4000-8000-00000000000a"
B = "00000000-0000-4000-8000-00000000000b"


def _verifica(token: str) -> Sessione | None:
    return verifica_token(token, CHIAVI.chiave, EMITTENTE)


class TestVerificaToken:
    def test_un_token_buono_da_la_sessione_con_il_suo_token(self):
        token = CHIAVI.token(A, EMITTENTE)

        sessione = _verifica(token)

        assert sessione is not None
        assert sessione.utente_id == A
        assert sessione.token == token
        assert sessione.scade_il > datetime.now(UTC)

    def test_un_token_malformato_non_vale(self):
        assert _verifica("non-un-jwt") is None

    def test_senza_kid_non_vale(self):
        import jwt

        token = jwt.encode(
            {"sub": A, "aud": "authenticated", "iss": EMITTENTE, "role": "authenticated"},
            CHIAVI.privata,
            algorithm="ES256",
        )
        assert _verifica(token) is None

    def test_un_sub_vuoto_non_e_nessuno(self):
        assert _verifica(CHIAVI.token("", EMITTENTE)) is None

    def test_un_accesso_anonimo_non_e_un_invitato(self):
        """Supabase gli dà `role` e `aud` come a tutti: lo distingue solo questo."""
        assert _verifica(CHIAVI.token(A, EMITTENTE, is_anonymous=True)) is None
        assert _verifica(CHIAVI.token(A, EMITTENTE, is_anonymous="true")) is None

    def test_chi_non_e_anonimo_lo_dice_e_passa(self):
        assert _verifica(CHIAVI.token(A, EMITTENTE, is_anonymous=False)) is not None

    def test_un_token_emesso_un_attimo_nel_futuro_passa(self):
        """L'orologio del VPS indietro di qualche secondo rispetto a Supabase:
        il token appena rinnovato «nasce nel futuro», e resta buono."""
        assert _verifica(CHIAVI.token(A, EMITTENTE, emesso_tra=timedelta(seconds=10))) is not None

    def test_la_scadenza_invece_non_ha_margine(self):
        assert _verifica(CHIAVI.token(A, EMITTENTE, scade_tra=timedelta(seconds=-1))) is None

    def test_l_emittente_e_quello_del_progetto(self):
        assert emittente_di("https://abc.supabase.co/") == "https://abc.supabase.co/auth/v1"


class TestLavoroLungo:
    def test_un_token_che_vale_ancora_un_ora_basta(self):
        adesso = datetime.now(UTC)
        sessione = Sessione(A, "t", adesso + timedelta(hours=1))
        assert basta_per_un_lavoro_lungo(sessione, adesso)

    def test_uno_che_scade_fra_due_minuti_no(self):
        adesso = datetime.now(UTC)
        sessione = Sessione(A, "t", adesso + timedelta(minutes=2))
        assert not basta_per_un_lavoro_lungo(sessione, adesso)

    def test_il_token_non_finisce_nella_rappresentazione(self):
        """Una sessione stampata in un log non deve portarsi dietro il token."""
        sessione = Sessione(A, "segretissimo", datetime.now(UTC))
        assert "segretissimo" not in repr(sessione)


class TestPercorsoDellUtente:
    def test_la_propria_cartella(self):
        assert percorso_dell_utente(A, f"{A}/capi/2026-09-27/x.jpg")

    def test_la_cartella_di_un_altro(self):
        assert not percorso_dell_utente(A, f"{B}/capi/x.jpg")

    def test_risalendo_con_i_punti(self):
        assert not percorso_dell_utente(A, f"{A}/../{B}/capi/x.jpg")
        assert not percorso_dell_utente(A, f"{A}/./x.jpg")

    def test_con_una_doppia_barra(self):
        assert not percorso_dell_utente(A, f"{A}//x.jpg")

    def test_un_prefisso_che_somiglia(self):
        assert not percorso_dell_utente(A, f"{A}-finto/x.jpg")

    def test_la_cartella_da_sola_non_e_un_file(self):
        """Con `chiave_foto` uguale alla cartella, la derivata `-scontornata`
        cadrebbe fuori da lei."""
        assert not percorso_dell_utente(A, A)
        assert not percorso_dell_utente(A, f"{A}/")
