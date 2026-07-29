"""Dal pixel al capo: prompt, interpretazione, politica sull'incertezza.

Funzioni pure. La chiamata al modello la fa un adapter, il salvataggio un altro:
qui c'è solo il ragionamento, ed è per questo che è tutto testabile con pytest.
"""

from __future__ import annotations

import json
from datetime import datetime

from domain.errors import LetturaNonValida
from domain.models import (
    SOGLIA_SCARTO,
    AnalisiVisione,
    AttributoCapo,
    Capo,
    FotoCapo,
    LetturaCapo,
    Stagione,
    TipoCapo,
)
from domain.ports import ImmagineLlm, RichiestaLlm
from domain.wardrobe import slot_da_tipo

SYSTEM_PROMPT_ANALISI = """\
Sei il modulo di visione di Tela, un armadio digitale.

Ricevi la foto di UN SOLO capo di abbigliamento, scattata in casa da una persona
qualunque: luce imperfetta, capo steso sul letto o appeso a una porta.

Restituisci SOLO un oggetto JSON, senza testo intorno e senza blocchi di codice,
con questa forma:

{
  "tipo": "top|pantaloni|scarpe|capospalla|abito|accessorio",
  "sottotipo": "camicia, felpa, chino, ... (parola singola o due)",
  "nome_proposto": "come lo chiamerebbe il proprietario, max 4 parole",
  "colore": { "nome": "nome del colore in italiano", "hex": "#RRGGBB" },
  "materiale": "composizione leggibile, es. 'Lino 100%'",
  "fantasia": "tinta unita, righe, quadri, floreale, ...",
  "stagione": "primavera|estate|autunno|inverno|mezza_stagione|tutto_lanno",
  "vestibilita": "regular, oversize, slim, boxy, ... oppure la taglia se visibile",
  "lavaggio": "quello che dice l'etichetta, es. '30° rovescio'",
  "confidenze": {
    "tipo": 0-100, "colore": 0-100, "materiale": 0-100, "fantasia": 0-100,
    "stagione": 0-100, "vestibilita": 0-100, "lavaggio": 0-100
  }
}

Regole:
- Se un attributo non è leggibile dalla foto, mettilo a null. Non tirare a
  indovinare: un campo vuoto costa all'utente un tocco, un campo sbagliato gli
  costa la fiducia.
- "hex" è obbligatorio quando riconosci il colore: è il valore con cui l'avatar
  tinge il capo. Prendi il colore dominante del tessuto, non dello sfondo né
  dell'ombra.
- Le confidenze sono la tua vera stima, non un numero di cortesia. Sotto 60
  l'attributo viene scartato a valle.
- Il campo "tipo" usa esattamente uno dei valori elencati, in minuscolo.
"""

PROMPT_ANALISI = (
    "Analizza questo capo e restituisci il JSON richiesto. "
    "Se nella foto ci sono più capi, descrivi quello in primo piano."
)

# Un capo senza tipo non si può appendere all'avatar; senza colore, il manichino
# di oggi non ha niente da tingere. Tutto il resto è correggibile dopo, con calma,
# dall'utente.
#
# Il colore è qui perché l'avatar tinge primitive, e l'ADR 0004 dice che smetterà
# di farlo: con la foto del capo scontornata e applicata come texture, un capo dal
# colore illeggibile resta indossabile. Quando la texture arriverà, questa tupla è
# il primo posto da toccare — il colore scende da requisito a ripiego.
ATTRIBUTI_INDISPENSABILI = (AttributoCapo.TIPO, AttributoCapo.COLORE)


def schema_lettura() -> dict[str, object]:
    """JSON Schema per gli structured output, scritto a mano e non derivato.

    Non usiamo `LetturaCapo.model_json_schema()`: quello porta con sé i vincoli
    di Pydantic (il `pattern` dell'hex, i limiti 0-100) che gli structured
    output dei provider non accettano. Qui teniamo la forma, e la validazione
    stretta resta a valle in `interpreta_lettura`, dove sappiamo spiegare
    l'errore invece di farci rifiutare la richiesta.
    """
    testo_o_null = {"type": ["string", "null"]}
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "tipo",
            "sottotipo",
            "nome_proposto",
            "colore",
            "materiale",
            "fantasia",
            "stagione",
            "vestibilita",
            "lavaggio",
            "confidenze",
        ],
        "properties": {
            "tipo": {"type": ["string", "null"], "enum": [*[t.value for t in TipoCapo], None]},
            "sottotipo": testo_o_null,
            "nome_proposto": testo_o_null,
            "colore": {
                "type": ["object", "null"],
                "additionalProperties": False,
                "required": ["nome", "hex"],
                "properties": {"nome": {"type": "string"}, "hex": {"type": "string"}},
            },
            "materiale": testo_o_null,
            "fantasia": testo_o_null,
            "stagione": {
                "type": ["string", "null"],
                "enum": [*[s.value for s in Stagione], None],
            },
            "vestibilita": testo_o_null,
            "lavaggio": testo_o_null,
            "confidenze": {
                "type": "object",
                "additionalProperties": False,
                "required": [a.value for a in AttributoCapo],
                "properties": {a.value: {"type": "integer"} for a in AttributoCapo},
            },
        },
    }


def richiesta_analisi(
    immagine: ImmagineLlm,
    modello: str,
    *,
    system_prompt: str | None = None,
    temperatura: float = 0.2,
    max_token: int = 900,
) -> RichiestaLlm:
    """Compone la chiamata. Temperatura bassa: qui non serve fantasia."""
    return RichiestaLlm(
        modello=modello,
        system=system_prompt or SYSTEM_PROMPT_ANALISI,
        prompt=PROMPT_ANALISI,
        immagini=[immagine],
        temperatura=temperatura,
        max_token=max_token,
        forza_json=True,
        schema_atteso=schema_lettura(),
    )


def estrai_json(testo: str) -> dict[str, object]:
    """Tira fuori l'oggetto JSON da una risposta che potrebbe non essere pulita.

    I modelli aggiungono blocchi ```json, preamboli gentili, virgolette
    tipografiche. Tolleriamo la cornice, non il contenuto.
    """
    grezzo = testo.strip()
    if grezzo.startswith("```"):
        righe = [r for r in grezzo.splitlines() if not r.strip().startswith("```")]
        grezzo = "\n".join(righe).strip()

    inizio, fine = grezzo.find("{"), grezzo.rfind("}")
    if inizio == -1 or fine <= inizio:
        raise LetturaNonValida("nessun oggetto JSON nella risposta", testo)

    try:
        caricato = json.loads(grezzo[inizio : fine + 1])
    except json.JSONDecodeError as exc:
        raise LetturaNonValida(f"JSON non valido: {exc.msg}", testo) from exc

    if not isinstance(caricato, dict):
        raise LetturaNonValida("il JSON non è un oggetto", testo)
    return caricato


def interpreta_lettura(testo: str) -> LetturaCapo:
    """Valida la risposta del modello contro `LetturaCapo`.

    Un modello che risponde `"tipo": "maglietta"` (fuori enum) o che inventa un
    campo viene fermato qui, non a tre schermate di distanza.
    """
    dati = estrai_json(testo)
    try:
        return LetturaCapo.model_validate(dati)
    except Exception as exc:  # pydantic.ValidationError e affini
        raise LetturaNonValida(f"lettura fuori formato: {exc}", testo) from exc


def applica_soglie(lettura: LetturaCapo, soglia: int = SOGLIA_SCARTO) -> LetturaCapo:
    """Svuota gli attributi in cui il modello non crede abbastanza.

    Preferiamo un campo vuoto a un tessuto inventato: il vuoto l'utente lo
    riempie in un tocco, lo sbagliato non lo nota e se lo porta dietro.
    """
    da_svuotare = {
        attributo.value
        for attributo, confidenza in lettura.confidenze.items()
        if confidenza < soglia
    }
    if not da_svuotare:
        return lettura

    aggiornamento: dict[str, None] = {
        campo: None for campo in da_svuotare if campo in LetturaCapo.model_fields
    }
    confidenze = {
        attributo: confidenza
        for attributo, confidenza in lettura.confidenze.items()
        if attributo.value not in da_svuotare
    }
    return lettura.model_copy(update={**aggiornamento, "confidenze": confidenze})


def nome_capo(lettura: LetturaCapo) -> str:
    """Un nome sensato anche quando il modello non lo propone."""
    if lettura.nome_proposto:
        return lettura.nome_proposto.strip()

    pezzi = [lettura.sottotipo or (lettura.tipo.value if lettura.tipo else "capo")]
    if lettura.colore:
        pezzi.append(lettura.colore.nome.lower())
    return " ".join(pezzi).capitalize()


def crea_capo(
    lettura: LetturaCapo,
    *,
    capo_id: str,
    chiave_foto: str,
    provider: str,
    modello: str,
    adesso: datetime,
    soglia_scarto: int = SOGLIA_SCARTO,
) -> Capo:
    """Trasforma una lettura in un capo salvabile.

    Fallisce se manca tipo o colore: sono le due cose senza cui il capo non
    esiste per l'avatar, e chiedere una foto nuova è più onesto che salvare un
    capo che non si può indossare.
    """
    pulita = applica_soglie(lettura, soglia_scarto)

    if pulita.tipo is None:
        raise LetturaNonValida("il modello non ha riconosciuto il tipo di capo")
    if pulita.colore is None:
        raise LetturaNonValida("il modello non ha riconosciuto il colore dominante")

    return Capo(
        id=capo_id,
        nome=nome_capo(pulita),
        tipo=pulita.tipo,
        slot=slot_da_tipo(pulita.tipo),
        colore=pulita.colore,
        foto=FotoCapo(chiave=chiave_foto),
        sottotipo=pulita.sottotipo,
        materiale=pulita.materiale,
        fantasia=pulita.fantasia,
        stagione=pulita.stagione,
        vestibilita=pulita.vestibilita,
        lavaggio=pulita.lavaggio,
        analisi=AnalisiVisione(
            provider=provider,
            modello=modello,
            eseguita_il=adesso,
            confidenze=pulita.confidenze,
        ),
        creato_il=adesso,
        aggiornato_il=adesso,
    )
