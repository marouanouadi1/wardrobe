"""Modelli di dominio — e fonte di verità dei contratti.

`scripts/export_schema.py` esporta da qui il JSON Schema, e da quello nascono i
tipi TypeScript in packages/contracts. Quindi: rinominare un campo in questo
file rompe la build dell'app in CI, che è esattamente quello che vogliamo.

I nomi sono in italiano perché lo sono il prodotto e il suo design. Le uniche
eccezioni sono le chiavi di `Vestizione` (top/bottom/outer/shoes/dress): quelle
le impone `mannequin.setOutfit()` del renderer 3D e non vanno tradotte.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# Sotto questa confidenza l'app dipinge l'attributo in corallo e invita a
# correggerlo: il modello ha risposto, ma preferiamo chiedere all'utente.
SOGLIA_INCERTEZZA = 86

# Sotto questa, il valore non lo salviamo nemmeno: meglio un campo vuoto che un
# tessuto inventato. Vedi `domain.vision.applica_soglie`.
SOGLIA_SCARTO = 60


class ModelloWardrobe(BaseModel):
    """Base comune: nessun campo extra passa, né in ingresso né dai provider."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class TipoCapo(StrEnum):
    TOP = "top"
    PANTALONI = "pantaloni"
    SCARPE = "scarpe"
    CAPOSPALLA = "capospalla"
    ABITO = "abito"
    ACCESSORIO = "accessorio"


class SlotAvatar(StrEnum):
    """Le cinque posizioni che l'avatar sa vestire.

    I valori coincidono con le chiavi di `mannequin.setOutfit()`.
    """

    TOP = "top"
    BOTTOM = "bottom"
    OUTER = "outer"
    SHOES = "shoes"
    DRESS = "dress"


class Stagione(StrEnum):
    PRIMAVERA = "primavera"
    ESTATE = "estate"
    AUTUNNO = "autunno"
    INVERNO = "inverno"
    MEZZA_STAGIONE = "mezza_stagione"
    TUTTO_LANNO = "tutto_lanno"


class StatoCapo(StrEnum):
    PULITO = "pulito"
    DA_LAVARE = "da_lavare"
    IN_LAVAGGIO = "in_lavaggio"


class AttributoCapo(StrEnum):
    """Gli attributi che il modello di visione legge dalla foto.

    Ognuno porta la sua confidenza: è il motivo per cui `Capo` non ha un unico
    punteggio complessivo.
    """

    TIPO = "tipo"
    COLORE = "colore"
    MATERIALE = "materiale"
    FANTASIA = "fantasia"
    STAGIONE = "stagione"
    VESTIBILITA = "vestibilita"
    LAVAGGIO = "lavaggio"


class OrigineOutfit(StrEnum):
    MANUALE = "manuale"
    IA = "ia"
    SUGGERITO_MODIFICATO = "suggerito_modificato"


class RuoloChat(StrEnum):
    UTENTE = "utente"
    WARDROBE = "wardrobe"


class StatoSegnalazione(StrEnum):
    RICEVUTA = "ricevuta"
    IN_LAVORAZIONE = "in_lavorazione"
    RISOLTA = "risolta"


Confidenza = Annotated[int, Field(ge=0, le=100)]
Percentuale = Annotated[int, Field(ge=0, le=100)]
EsaColore = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class Colore(ModelloWardrobe):
    """Nome leggibile più esadecimale.

    L'hex non è un vezzo: è quello che il manichino 3D di oggi usa per tingere le
    mesh, e per ora senza hex l'avatar non sa indossare il capo. È il primo passo:
    l'ADR 0004 porta l'avatar a vestire la foto scontornata del capo come texture,
    e allora il colore diventa il ripiego invece del requisito.
    """

    nome: str
    hex: EsaColore


class FotoCapo(ModelloWardrobe):
    chiave: str = Field(description="Chiave dell'oggetto nell'archivio foto")
    url: str | None = Field(default=None, description="URL firmato, a vita breve")
    larghezza: int | None = None
    altezza: int | None = None
    chiave_scontornata: str | None = Field(
        default=None,
        description=(
            "Chiave della stessa foto dopo lo scontorno: soggetto isolato, sfondo "
            "trasparente. Assente se lo scontorno non è ancora passato o è fallito — "
            "in quel caso l'app mostra l'originale, mai un buco vuoto."
        ),
    )
    url_scontornata: str | None = Field(
        default=None, description="URL firmato della foto scontornata"
    )


class AnalisiVisione(ModelloWardrobe):
    """Traccia di chi ha letto la foto, quando, e con quanta sicurezza."""

    provider: str
    modello: str
    eseguita_il: datetime
    confidenze: dict[AttributoCapo, Confidenza] = Field(default_factory=dict)
    corretti_a_mano: list[AttributoCapo] = Field(default_factory=list)
    note: str | None = None


class Capo(ModelloWardrobe):
    id: str
    nome: str
    tipo: TipoCapo
    slot: SlotAvatar
    colore: Colore
    foto: FotoCapo
    brand: str | None = None
    sottotipo: str | None = None
    materiale: str | None = None
    fantasia: str | None = None
    stagione: Stagione | None = None
    vestibilita: str | None = None
    lavaggio: str | None = None
    stato: StatoCapo = StatoCapo.PULITO
    preferito: bool = False
    ultimo_uso: date | None = None
    volte_indossato: int = 0
    analisi: AnalisiVisione | None = None
    etichette: list[str] = Field(
        default_factory=list,
        description=(
            "Tag liberi dell'utente (es. «lavoro», «da viaggio»): il modello di "
            "visione non li scrive mai, per questo restano fuori da `LetturaCapo`."
        ),
    )
    appunti: str | None = Field(
        default=None,
        description="Nota libera dell'utente sul capo. Mai vista dal modello di visione.",
    )
    creato_il: datetime
    aggiornato_il: datetime


class CapoSintetico(ModelloWardrobe):
    """Il capo come lo vede il modello di suggerimento.

    Volutamente magro: meno token per capo significa più capi nel contesto.
    """

    id: str
    nome: str
    tipo: TipoCapo
    slot: SlotAvatar
    colore: str
    hex: EsaColore
    materiale: str | None = None
    stagione: Stagione | None = None
    stato: StatoCapo = StatoCapo.PULITO
    etichette: list[str] = Field(default_factory=list)


class LetturaCapo(ModelloWardrobe):
    """Quello che il modello di visione dichiara di aver letto dalla foto.

    Tutto opzionale per costruzione: «se un attributo non è leggibile metti
    null, non tirare a indovinare». Non è ancora un `Capo` — diventa tale solo
    passando da `domain.vision.crea_capo`.
    """

    tipo: TipoCapo | None = None
    sottotipo: str | None = None
    nome_proposto: str | None = None
    colore: Colore | None = None
    materiale: str | None = None
    fantasia: str | None = None
    stagione: Stagione | None = None
    vestibilita: str | None = None
    lavaggio: str | None = None
    confidenze: dict[AttributoCapo, Confidenza] = Field(default_factory=dict)


class Vestizione(ModelloWardrobe):
    """Chi occupa quale slot dell'avatar. I valori sono id di capo.

    Le chiavi sono quelle di `mannequin.setOutfit()`: non tradurle.
    """

    top: str | None = None
    bottom: str | None = None
    outer: str | None = None
    shoes: str | None = None
    dress: str | None = None


class VestizioneColori(ModelloWardrobe):
    """La stessa vestizione, risolta in colori: è ciò che il renderer riceve oggi.

    Il manichino non indossa fotografie, tinge primitive: per questo il colore
    dominante estratto dalla foto è, per ora, il ponte fra le due feature di punta.
    Non è il traguardo — vedi ADR 0004: il capo va visto dalla sua foto
    scontornata, applicata come texture. Questo modello resterà per il ripiego.
    """

    top: EsaColore | None = None
    bottom: EsaColore | None = None
    outer: EsaColore | None = None
    shoes: EsaColore | None = None
    dress: EsaColore | None = None


class Outfit(ModelloWardrobe):
    id: str
    nome: str
    vestizione: Vestizione
    occasione: str | None = None
    origine: OrigineOutfit = OrigineOutfit.MANUALE
    volte_indossato: int = 0
    ultimo_uso: date | None = None
    creato_il: datetime


class Suggerimento(ModelloWardrobe):
    """Una proposta dello stilista, già validata contro l'armadio vero."""

    titolo: str
    match: Percentuale
    vestizione: Vestizione
    perche: list[str] = Field(max_length=3)


class RispostaStilista(ModelloWardrobe):
    """La risposta della chat vera: prosa libera, con proposte opzionali.

    A differenza di `RispostaSuggerimenti` (sempre e solo una lista di
    outfit), qui "risposta" c'è sempre — è quello che l'utente legge — e
    "proposte" compare solo quando proporre un outfit è la cosa giusta da
    fare in quel turno.
    """

    risposta: str
    proposte: list[Suggerimento] = Field(default_factory=list)


class Meteo(ModelloWardrobe):
    citta: str
    temp_c: float
    condizione: str
    percepita_c: float | None = None


class ImpegnoAgenda(ModelloWardrobe):
    ora: str
    titolo: str
    dress_code: str | None = None


class PreferenzeStile(ModelloWardrobe):
    stili: list[str] = Field(default_factory=list)
    palette: list[str] = Field(default_factory=list)
    evita: list[str] = Field(default_factory=list)


class ContestoSuggerimento(ModelloWardrobe):
    """Tutto ciò che lo stilista può sapere, e nient'altro.

    Se un suggerimento esce strano, è questo il payload da guardare prima di
    dare la colpa al modello.
    """

    capi_disponibili: list[CapoSintetico]
    meteo: Meteo | None = None
    agenda: list[ImpegnoAgenda] = Field(default_factory=list)
    in_lavaggio: list[str] = Field(default_factory=list)
    indossati_di_recente: list[str] = Field(default_factory=list)
    preferenze: PreferenzeStile = PreferenzeStile()
    richiesta_utente: str | None = None
    numero_proposte: Annotated[int, Field(ge=1, le=5)] = 3


class Profilo(ModelloWardrobe):
    id: str
    nome: str
    citta: str | None = None
    preferenze: PreferenzeStile = PreferenzeStile()
    foto_url: str | None = None
    avatar_foto_chiave: str | None = Field(
        default=None,
        description=(
            "Foto a figura intera della persona. Oggi la usa l'avatar 2D, quando "
            "il manichino 3D non basta; nella direzione dell'ADR 0004 è l'ingresso "
            "del corpo 3D fedele alla persona, non un ripiego"
        ),
    )
    creato_il: datetime


class FiltroArmadio(ModelloWardrobe):
    tipo: TipoCapo | None = None
    stato: StatoCapo | None = None
    solo_preferiti: bool = False
    testo: str | None = None


class ElencoCapi(ModelloWardrobe):
    capi: list[Capo]
    totale: int


class RiepilogoArmadio(ModelloWardrobe):
    totale: int
    da_lavare: int
    dormienti: int
    valore_dormiente_eur: float | None = None


class UploadFirmato(ModelloWardrobe):
    """Risposta all'app prima che carichi la foto: l'upload va diretto
    all'archivio foto, senza passare dal backend."""

    chiave: str
    url: str
    metodo: str = "PUT"
    intestazioni: dict[str, str] = Field(default_factory=dict)
    scade_in_s: int


class RichiestaUpload(ModelloWardrobe):
    content_type: str
    nota: str | None = None


class Credenziali(ModelloWardrobe):
    """Il corpo di POST /auth/accedi. Nessun requisito sulla password: qui
    deve solo passare a `bcrypt.checkpw`, non essere accettabile — quello
    vincolo vive in `Registrazione`, non qui, altrimenti un account creato
    quando il minimo era più basso non potrebbe più accedere."""

    email: str
    password: str


class Registrazione(ModelloWardrobe):
    """Il corpo di POST /auth/registrati. L'allowlist (`EMAIL_AMMESSE`) e il
    hash della password li applica `handlers/auth.py`; qui c'è solo la forma
    del dato, non la sua ammissibilità."""

    email: str
    password: str = Field(min_length=8)


class TokenAccesso(ModelloWardrobe):
    token: str


class RichiestaAnalisi(ModelloWardrobe):
    chiave_foto: str
    provider: str | None = None
    modello: str | None = None


class StatoAnalisi(StrEnum):
    IN_CORSO = "in_corso"
    COMPLETATA = "completata"
    FALLITA = "fallita"


class AnalisiAvviata(ModelloWardrobe):
    """L'app riceve un identificativo e interroga lo stato: l'analisi è lenta.

    Tenerla asincrona è ciò che permette il caricamento in blocco di venti foto
    senza che l'app resti appesa a una richiesta HTTP di quaranta secondi.
    """

    esecuzione_id: str
    stato: StatoAnalisi = StatoAnalisi.IN_CORSO


class EsitoAnalisi(ModelloWardrobe):
    esecuzione_id: str
    stato: StatoAnalisi
    capo: Capo | None = None
    errore: str | None = None


class CorrezioniCapo(ModelloWardrobe):
    """Le correzioni dell'utente, una per attributo, tutte tipizzate.

    Volutamente non è `dict[str, str]`: correggere il colore significa mandare
    nome più hex, e il tipo deve stare nell'enum. Un dizionario di stringhe
    farebbe passare «maglietta» come tipo e lo scopriremmo sull'avatar.
    """

    tipo: TipoCapo | None = None
    colore: Colore | None = None
    materiale: str | None = None
    fantasia: str | None = None
    stagione: Stagione | None = None
    vestibilita: str | None = None
    lavaggio: str | None = None


class AggiornamentoCapo(ModelloWardrobe):
    correzioni: CorrezioniCapo = CorrezioniCapo()
    nome: str | None = None
    preferito: bool | None = None
    stato: StatoCapo | None = None
    # `None` vuol dire «non toccare»: per svuotare le etichette manda una lista
    # vuota esplicita, per svuotare gli appunti manda una stringa vuota.
    etichette: list[str] | None = None
    appunti: str | None = None


class RichiestaSuggerimenti(ModelloWardrobe):
    richiesta_utente: str | None = None
    meteo: Meteo | None = None
    agenda: list[ImpegnoAgenda] = Field(default_factory=list)
    numero_proposte: Annotated[int, Field(ge=1, le=5)] = 3
    provider: str | None = None
    modello: str | None = None


class RispostaSuggerimenti(ModelloWardrobe):
    suggerimenti: list[Suggerimento]
    contesto: ContestoSuggerimento
    provider: str
    modello: str
    latenza_ms: int


class MessaggioChat(ModelloWardrobe):
    """Un turno di una conversazione con lo stilista.

    `testo` sul turno di Wardrobe è la prosa libera della risposta
    (`RispostaStilista.risposta`), quella che si mostra a schermo;
    `suggerimenti`, quando presenti, sono gli outfit proposti nello stesso
    turno. La cronologia rimandata al modello (`domain.chat.cronologia_da_messaggi`)
    riappende gli id di `suggerimenti` al testo, perché il modello non li
    perda al turno successivo.
    """

    id: str
    ruolo: RuoloChat
    testo: str
    suggerimenti: list[Suggerimento] = Field(default_factory=list)
    creato_il: datetime


class ConversazioneChat(ModelloWardrobe):
    """Un contenitore di turni: da quando la chat ha smesso di essere una
    sola sessione continua per utente (vedi docs/adr/0006).

    Rispecchia esattamente le colonne di `conversazioni_chat` — niente qui
    dentro che l'adapter debba inventare per poterla salvare. `turni` e
    `anteprima`, che servono solo all'elenco, vivono in
    `VoceElencoConversazioni`, non qui.
    """

    id: str
    titolo: str
    creata_il: datetime
    ultimo_turno_il: datetime


class VoceElencoConversazioni(ModelloWardrobe):
    """`ConversazioneChat` più ciò che solo l'elenco calcola — un aggregato
    su `messaggi_chat`, non colonne proprie di `conversazioni_chat`."""

    conversazione: ConversazioneChat
    turni: int
    anteprima: str


class ElencoConversazioniChat(ModelloWardrobe):
    conversazioni: list[VoceElencoConversazioni]


class RichiestaMessaggioChat(ModelloWardrobe):
    testo: str
    meteo: Meteo | None = None
    agenda: list[ImpegnoAgenda] = Field(default_factory=list)
    conversazione_id: str | None = Field(
        default=None,
        description="Assente: apre una conversazione nuova, col titolo dedotto dal messaggio.",
    )


class RispostaChat(ModelloWardrobe):
    utente: MessaggioChat
    wardrobe: MessaggioChat
    conversazione: ConversazioneChat
    contesto: ContestoSuggerimento
    provider: str
    modello: str
    latenza_ms: int


class ElencoMessaggiChat(ModelloWardrobe):
    messaggi: list[MessaggioChat]
    conversazione: ConversazioneChat | None = None


class Segnalazione(ModelloWardrobe):
    """La copia che l'app tiene di una segnalazione già inviata a Sentry
    (vedi `apps/mobile/src/dati/segnalazioni.ts`, `apriSegnalazione()`).

    Sentry resta il canale che avvisa chi lavora sull'app; questa riga è
    quello che permette a chi ha segnalato — che a Sentry non ha accesso —
    di vedere che è arrivata e a che punto è.
    """

    id: str
    utente_id: str
    testo: str
    stato: StatoSegnalazione = StatoSegnalazione.RICEVUTA
    creata_il: datetime
    aggiornata_il: datetime


class NuovaSegnalazione(ModelloWardrobe):
    testo: str = Field(min_length=1)


class AggiornamentoSegnalazione(ModelloWardrobe):
    stato: StatoSegnalazione


class ElencoSegnalazioni(ModelloWardrobe):
    segnalazioni: list[Segnalazione]
    # Chi è nell'allowlist EMAIL_AMMINISTRATORI vede le segnalazioni di tutti
    # (non solo le proprie) e può cambiarne lo stato: l'app usa questo flag
    # per decidere se mostrare i controlli di stato, invece di indovinarlo
    # confrontando gli utente_id delle righe.
    amministratore: bool = False


class NuovoOutfit(ModelloWardrobe):
    nome: str
    vestizione: Vestizione
    occasione: str | None = None
    origine: OrigineOutfit = OrigineOutfit.MANUALE


class ModelloDisponibile(ModelloWardrobe):
    """Una riga del catalogo dei modelli di un provider — `ProviderLlm.modelli()`."""

    provider: str
    id: str
    etichetta: str
    visione: bool
    note: str | None = None
    costo_input_eur_mtok: float | None = None
    costo_output_eur_mtok: float | None = None
    configurato: bool = False
    accetta_temperatura: bool = Field(
        default=True,
        description=(
            "Falso sui modelli che hanno rimosso il parametro e rifiutano la "
            "richiesta con 400. In un banco di prova una manopola che non fa "
            "niente è peggio di una manopola assente: da lì si traggono "
            "conclusioni sbagliate."
        ),
    )


class UsoToken(ModelloWardrobe):
    token_input: int = 0
    token_output: int = 0
