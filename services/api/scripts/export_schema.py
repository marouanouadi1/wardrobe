"""Esporta il JSON Schema dei modelli di dominio, più le costanti condivise.

Primo passo della catena dei contratti:

    domain/models.py  ->  packages/contracts/schema/*.json  ->  src/generated/*.ts

Esce un file solo, `contratti.json`, con tutti i modelli sotto `$defs`: se ogni
modello avesse il suo file, `Colore` finirebbe duplicato in dieci schemi e da
lì in dieci interfacce TypeScript con lo stesso nome.

Le costanti sono il pezzo che si dimentica sempre. La soglia di incertezza vive
nel dominio, ma serve anche all'app per sapere quali attributi dipingere in
corallo: riscriverla a mano in TypeScript significa che un giorno le due
divergeranno in silenzio, e nessuno se ne accorgerà.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RADICE / "services/api/src"))

from pydantic.json_schema import models_json_schema  # noqa: E402

from domain import models  # noqa: E402

DESTINAZIONE = RADICE / "packages/contracts/schema"

# I modelli che attraversano il confine fra backend e app. Quello che è solo
# interno — le porte, le richieste ai provider — resta fuori: un contratto
# generoso è un contratto che nessuno rispetta.
#
# La distinzione fra i due gruppi non è cosmetica. Una risposta la serializziamo
# sempre per intero, quindi ogni campo c'è: in TypeScript deve essere
# obbligatorio. Una richiesta la costruisce l'app, e i campi con un default sono
# omissibili: generarli obbligatori costringerebbe a scrivere sette `null` per
# correggere un attributo.
RISPOSTE = (
    models.Capo,
    models.CapoSintetico,
    models.Colore,
    models.FotoCapo,
    models.AnalisiVisione,
    models.LetturaCapo,
    models.VestizioneColori,
    models.Outfit,
    models.Suggerimento,
    models.ContestoSuggerimento,
    models.Profilo,
    models.ElencoCapi,
    models.RiepilogoArmadio,
    models.UploadFirmato,
    models.AnalisiAvviata,
    models.EsitoAnalisi,
    models.TokenAccesso,
    models.RispostaSuggerimenti,
    models.ModelloDisponibile,
    models.UsoToken,
    models.MessaggioChat,
    models.RispostaChat,
    models.ElencoMessaggiChat,
    models.ElencoConversazioniChat,
    models.Segnalazione,
    models.ElencoSegnalazioni,
)

RICHIESTE = (
    models.Credenziali,
    models.Registrazione,
    models.Vestizione,
    models.NuovoOutfit,
    models.Meteo,
    models.ImpegnoAgenda,
    models.PreferenzeStile,
    models.FiltroArmadio,
    models.RichiestaUpload,
    models.RichiestaAnalisi,
    models.CorrezioniCapo,
    models.AggiornamentoCapo,
    models.RichiestaSuggerimenti,
    models.RichiestaMessaggioChat,
    models.NuovaSegnalazione,
    models.AggiornamentoSegnalazione,
)

ENUM = (
    ("TipoCapo", models.TipoCapo),
    ("SlotAvatar", models.SlotAvatar),
    ("Stagione", models.Stagione),
    ("StatoCapo", models.StatoCapo),
    ("AttributoCapo", models.AttributoCapo),
    ("OrigineOutfit", models.OrigineOutfit),
    ("StatoAnalisi", models.StatoAnalisi),
    ("RuoloChat", models.RuoloChat),
    ("StatoSegnalazione", models.StatoSegnalazione),
)

COSTANTI = {
    "SOGLIA_INCERTEZZA": models.SOGLIA_INCERTEZZA,
    "SOGLIA_SCARTO": models.SOGLIA_SCARTO,
    "MESI_PER_DORMIENTE": 6,
}


def _senza_titoli_di_campo(nodo: object) -> None:
    """Toglie il `title` che Pydantic mette su ogni singolo campo.

    Senza questa pulizia il generatore TypeScript trasforma ogni campo titolato
    in un tipo con nome proprio: `export type Nome = string`, `Nome1`, `Nome2`,
    `Id`, `Hex`... Decine di alias inutili esportati dal pacchetto, e nomi
    generici come `Id` che qualcuno prima o poi importa per sbaglio. I titoli
    dei modelli li rimettiamo noi, uno per modello.
    """
    if isinstance(nodo, dict):
        for chiave in ("properties", "$defs"):
            for figlio in nodo.get(chiave, {}).values():
                if isinstance(figlio, dict):
                    figlio.pop("title", None)
                    # Anche il `default` va via: un campo con `$ref` più
                    # `default` non è più un semplice alias, e il generatore
                    # ne fa un tipo nuovo — `StatoCapo1`, `StatoCapo2`. In
                    # TypeScript l'opzionalità la esprime già `required`.
                    figlio.pop("default", None)
                _senza_titoli_di_campo(figlio)
        for chiave in ("items", "additionalProperties", "not"):
            _senza_titoli_di_campo(nodo.get(chiave))
        for chiave in ("anyOf", "allOf", "oneOf", "prefixItems"):
            for figlio in nodo.get(chiave, []) or []:
                if isinstance(figlio, dict):
                    figlio.pop("title", None)
                    figlio.pop("default", None)
                _senza_titoli_di_campo(figlio)


def _scrivi(nome: str, contenuto: object) -> Path:
    percorso = DESTINAZIONE / nome
    percorso.write_text(json.dumps(contenuto, indent=2, ensure_ascii=False) + "\n", "utf-8")
    return percorso


def esporta() -> list[Path]:
    DESTINAZIONE.mkdir(parents=True, exist_ok=True)

    _, combinato = models_json_schema(
        [(modello, "serialization") for modello in RISPOSTE]
        + [(modello, "validation") for modello in RICHIESTE],
        ref_template="#/$defs/{model}",
    )
    definizioni = combinato.get("$defs", {})
    for nome, definizione in definizioni.items():
        _senza_titoli_di_campo(definizione)
        definizione["title"] = nome

    # La radice elenca ogni modello come proprietà: serve solo perché il
    # generatore TypeScript emetta un'interfaccia per ciascuno invece di
    # fermarsi a quelli raggiungibili dalla radice.
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Contratti",
        "description": "Generato da services/api/src/domain/models.py — non modificare a mano.",
        "type": "object",
        "properties": {nome: {"$ref": f"#/$defs/{nome}"} for nome in sorted(definizioni)},
        "$defs": definizioni,
    }

    return [
        _scrivi("contratti.json", schema),
        _scrivi("_enums.json", {nome: [voce.value for voce in enum] for nome, enum in ENUM}),
        _scrivi("_costanti.json", COSTANTI),
    ]


if __name__ == "__main__":
    scritti = esporta()
    print(f"{len(scritti)} file scritti in {DESTINAZIONE.relative_to(RADICE)}")
