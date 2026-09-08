"""Claude, tramite l'SDK ufficiale.

È il provider di riferimento del progetto e l'unico con un SDK vero come
dipendenza: retry, errori tipizzati e structured output li fa lui. Gli altri
provider sono adapter HTTP sottili — aggiungerne uno costa un file in questa
cartella più una riga nel registro, non una schermata (vedi `registry.py`).
"""

from __future__ import annotations

from typing import Any, cast

import anthropic
from anthropic import omit
from anthropic.types import MessageParam, TextBlock

from adapters.llm.base import chiave, cronometra
from domain.errors import ErroreProvider
from domain.models import ModelloDisponibile, UsoToken
from domain.ports import RichiestaLlm, RispostaLlm

NOME = "anthropic"
VARIABILE_CHIAVE = "ANTHROPIC_API_KEY"

# Prezzi di listino in dollari per milione di token (input, output).
# Anthropic fattura in dollari; nessun punto del prodotto li converte in euro
# oggi (lo faceva il playground, rimosso).
PREZZI_USD: dict[str, tuple[float, float]] = {
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}

# Su questi modelli `temperature` è stato rimosso e la richiesta viene
# rifiutata con 400: la temperatura passata in `RichiestaLlm` non li
# raggiunge mai (vedi `completa()` sotto). L'equivalente è
# `output_config.effort`, che regola la profondità del ragionamento — non la
# casualità. Non facciamo finta che siano la stessa cosa.
SENZA_TEMPERATURA = frozenset({"claude-opus-5", "claude-sonnet-5", "claude-opus-4-8"})


def catalogo(configurato: bool) -> list[ModelloDisponibile]:
    return [
        ModelloDisponibile(
            provider=NOME,
            id="claude-opus-5",
            accetta_temperatura="claude-opus-5" not in SENZA_TEMPERATURA,
            etichetta="Claude Opus 5",
            visione=True,
            note="il più accurato sui tessuti e sulle etichette",
            configurato=configurato,
        ),
        ModelloDisponibile(
            provider=NOME,
            id="claude-sonnet-5",
            accetta_temperatura="claude-sonnet-5" not in SENZA_TEMPERATURA,
            etichetta="Claude Sonnet 5",
            visione=True,
            note="quasi come Opus, a un terzo del prezzo",
            configurato=configurato,
        ),
        ModelloDisponibile(
            provider=NOME,
            id="claude-haiku-4-5",
            accetta_temperatura="claude-haiku-4-5" not in SENZA_TEMPERATURA,
            etichetta="Claude Haiku 4.5",
            visione=True,
            note="il più economico: buono per l'analisi in blocco",
            configurato=configurato,
        ),
    ]


class ProviderAnthropic:
    nome = NOME

    def __init__(self, chiave_override: str | None = None) -> None:
        self._chiave = chiave(NOME, VARIABILE_CHIAVE, chiave_override)

    def modelli(self) -> list[ModelloDisponibile]:
        return catalogo(configurato=True)

    def completa(self, richiesta: RichiestaLlm) -> RispostaLlm:
        client = anthropic.Anthropic(api_key=self._chiave)

        contenuto: list[Any] = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": immagine.media_type,
                    "data": immagine.base64,
                },
            }
            for immagine in richiesta.immagini
        ]
        contenuto.append({"type": "text", "text": richiesta.prompt})

        messaggi: list[dict[str, Any]] = [
            {"role": "user" if turno.ruolo == "utente" else "assistant", "content": turno.testo}
            for turno in richiesta.cronologia
        ]
        messaggi.append({"role": "user", "content": contenuto})

        # `omit` è il sentinella dell'SDK per «non mandare affatto questo
        # parametro». Serve perché mandare `temperature=None` non è la stessa
        # cosa che ometterlo, e sui modelli che l'hanno rimosso la differenza
        # è fra una risposta e un 400.
        output_config: Any = (
            {"format": {"type": "json_schema", "schema": richiesta.schema_atteso}}
            if richiesta.forza_json and richiesta.schema_atteso is not None
            else omit
        )

        try:
            messaggio, latenza_ms = cronometra(
                lambda: client.messages.create(
                    model=richiesta.modello,
                    max_tokens=richiesta.max_token,
                    messages=cast(list[MessageParam], messaggi),
                    system=richiesta.system or omit,
                    temperature=(
                        omit if richiesta.modello in SENZA_TEMPERATURA else richiesta.temperatura
                    ),
                    # I due lavori di Wardrobe sono letture strutturate one-shot:
                    # non serve un ragionamento esteso, e su Claude Opus 5 il
                    # pensiero è acceso di default anche omettendo il
                    # parametro. Disabilitarlo qui evita di spendere token (e
                    # margine di `max_tokens`) in un pensiero che il compito
                    # non richiede — accettato fino a effort «high», che è il
                    # default quando non lo specifichiamo.
                    thinking={"type": "disabled"},
                    output_config=output_config,
                )
            )
        except anthropic.APIStatusError as exc:
            raise ErroreProvider(f"{NOME} ha risposto {exc.status_code}: {exc.message}") from exc
        except anthropic.APIConnectionError as exc:
            raise ErroreProvider(f"{NOME} non raggiungibile: {exc}") from exc

        # Un rifiuto delle classificazioni di sicurezza arriva come 200 con
        # stop_reason «refusal» e contenuto vuoto: leggere content[0] senza
        # controllare qui esploderebbe con un IndexError inspiegabile.
        if messaggio.stop_reason == "refusal":
            raise ErroreProvider(f"{NOME} ha rifiutato la richiesta")

        # Con lo schema attivo il JSON troncato non è più «il modello ha
        # sbagliato formato»: è `max_tokens` esaurito a metà oggetto. Dirlo qui
        # evita che arrivi a valle come un generico «JSON non valido», che
        # nasconde la causa vera (alzare `max_token`, non riparare il prompt).
        if messaggio.stop_reason == "max_tokens":
            raise ErroreProvider(f"{NOME} ha troncato la risposta: max_tokens esaurito")

        # La risposta è una lista di blocchi di tipi diversi (testo, pensiero,
        # uso di strumenti): prendiamo solo il testo, restringendo per tipo e
        # non per attributo — così se l'SDK aggiunge un blocco nuovo, il
        # controllo dei tipi ce lo dice invece di farci leggere un campo che
        # non esiste.
        testo = "".join(
            blocco.text for blocco in messaggio.content if isinstance(blocco, TextBlock)
        )
        return RispostaLlm(
            testo=testo,
            modello=messaggio.model,
            uso=UsoToken(
                token_input=messaggio.usage.input_tokens,
                token_output=messaggio.usage.output_tokens,
            ),
            latenza_ms=latenza_ms,
        )
