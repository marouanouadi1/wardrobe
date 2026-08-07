"""Il manifest dei 10 campioni si carica e valida, anche vuoto.

Non verifica il contenuto (la verità nota la scrive l'utente fotografando i
capi): verifica solo che il formato regga `CampioneValutazione`, così un
errore di sintassi nel JSON si scopre qui, non a metà di un batch a pagamento.
"""

from __future__ import annotations

import json
from pathlib import Path

from domain.valutazione import campioni_da_json

PERCORSO = Path(__file__).parent / "campioni" / "campioni.json"


def test_il_manifest_valida_contro_campione_valutazione():
    grezzo = json.loads(PERCORSO.read_text(encoding="utf-8"))
    campioni = campioni_da_json(grezzo)
    assert len(campioni) == 10
    assert len({c.id for c in campioni}) == 10
