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
from typing import Annotated, Final, Literal

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


#: Gli estremi accettati per le misure del corpo, in centimetri.
#:
#: Stanno qui e non nei `Field` perché **attraversano il confine**: l'app deve
#: poter fermare un dito che scivola sulla tastiera, non scoprirlo da un 422 —
#: e un 422 di Pydantic non ha un codice su cui discriminare, solo un testo.
#: I `Field` qui sotto li leggono da questo dizionario, quindi la soglia è
#: scritta **una volta sola** e non può divergere dalla sua stessa validazione.
LIMITI_MISURE_CM: Final[dict[str, dict[str, int]]] = {
    "altezza": {"min": 120, "max": 230},
    "spalle": {"min": 30, "max": 70},
    "lunghezza_gamba": {"min": 50, "max": 120},
}


class SistemaTaglie(StrEnum):
    """Su che taglie ragioniamo — **lo dice la persona, non lo deduciamo.**

    Il deck lo scrive nell'occhiello della schermata: «Scegli tu il sistema di
    taglie: non lo deduco da nome o foto». Non è una preferenza di comodo: è il
    punto in cui l'app promette di non indovinare il genere di qualcuno.
    """

    DONNA = "donna"
    UOMO = "uomo"
    UNISEX = "unisex"


class Taglia(StrEnum):
    """La taglia abituale, nel sistema a lettere.

    **Non copre i sistemi numerici** (38/40/42 italiani, 6/8/10 inglesi), e la
    scelta è consapevole: le lettere sono le sole cinque che valgono per tutti e
    tre i `SistemaTaglie`, e sono le sole che l'app oggi sappia offrire. Una
    enum accetta esattamente ciò che l'interfaccia può produrre; un `str` libero
    lascerebbe entrare «medium», «42» e «M» — tre modi di dire la stessa cosa
    che nessuno normalizzerebbe mai più.

    Allargarla ai numeri è `T-44`: costa un cambio di contratto, **non** una
    migrazione dei dati — una enum che diventa `str` lascia valide le righe già
    scritte, ed è il verso buono in cui sbagliare.
    """

    XS = "xs"
    S = "s"
    M = "m"
    L = "l"
    XL = "xl"


class Corporatura(StrEnum):
    """Tre corporature.

    **Il deck non dice quali sono**: mostra solo «Media» come valore corrente di
    un selettore di cui non elenca le voci. Queste tre le abbiamo scelte noi, ed
    è registrato in `docs/DOMANDE_APERTE.md` (`D-09`) perché è una lacuna di
    specifica, non una decisione presa.
    """

    MINUTA = "minuta"
    MEDIA = "media"
    ROBUSTA = "robusta"


class UnitaLunghezza(StrEnum):
    """In che unità si **mostrano** le lunghezze. Non in che unità si salvano.

    `Misure` le tiene in centimetri e basta — il nome dei campi lo dice
    (`altezza_cm`). Questa è una preferenza di lettura: cambiarla non riscrive
    nessun dato, e due dispositivi dello stesso utente vedono lo stesso numero
    perché la conversione avviene all'ultimo momento, non al salvataggio.

    Il deck ne governa tre — lunghezze, peso, temperatura. Le altre due non
    esistono qui: **non c'è nessun campo peso** in tutto il dominio (e il deck
    stesso scrive «non te lo chiedo»), e la temperatura richiede il meteo, che
    il backend riceve ma non è mai andato a prendere. Offrirle vorrebbe dire
    due selettori che non comandano niente.
    """

    CM = "cm"
    POLLICI = "pollici"


class Misure(ModelloWardrobe):
    """Come si veste un corpo, non com'è fatto.

    **Ogni campo è opzionale, e il modello intero può non esserci.** Non è
    lassismo: la schermata del deck offre «Le inserisco dopo» accanto a
    «Continua», e promette «puoi cancellarle quando vuoi». Un `Misure` assente
    è quella promessa mantenuta — non un profilo a metà da riempire.

    Gli estremi non sono decorativi. Servono a rifiutare un dito che scivola
    (`1680` invece di `168`) prima che finisca in un `jsonb` e da lì
    nell'avatar, dove diventerebbe una persona alta sedici metri.
    """

    sistema_taglie: SistemaTaglie | None = None
    taglia: Taglia | None = None
    altezza_cm: (
        Annotated[
            int,
            Field(ge=LIMITI_MISURE_CM["altezza"]["min"], le=LIMITI_MISURE_CM["altezza"]["max"]),
        ]
        | None
    ) = None
    corporatura: Corporatura | None = None
    spalle_cm: (
        Annotated[
            int, Field(ge=LIMITI_MISURE_CM["spalle"]["min"], le=LIMITI_MISURE_CM["spalle"]["max"])
        ]
        | None
    ) = None
    lunghezza_gamba_cm: (
        Annotated[
            int,
            Field(
                ge=LIMITI_MISURE_CM["lunghezza_gamba"]["min"],
                le=LIMITI_MISURE_CM["lunghezza_gamba"]["max"],
            ),
        ]
        | None
    ) = None


class Profilo(ModelloWardrobe):
    id: str
    nome: str
    citta: str | None = None
    preferenze: PreferenzeStile = PreferenzeStile()
    misure: Misure | None = None
    #: Default `cm` e non `None`: un profilo salvato prima che questo campo
    #: esistesse lo riceve leggendolo, senza migrazione e senza un ramo
    #: «non scelto» da gestire in ogni punto che mostra una lunghezza.
    unita_lunghezza: UnitaLunghezza = UnitaLunghezza.CM
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


class ConversazioneEsportata(ModelloWardrobe):
    """Una conversazione **con dentro i suoi turni**.

    `ConversazioneChat` non li porta — li tiene `messaggi_chat`, e l'elenco ne
    mostra solo un'anteprima. In un archivio che deve bastare da solo, una
    conversazione senza i messaggi sarebbe un titolo e una data.
    """

    conversazione: ConversazioneChat
    messaggi: list[MessaggioChat]


class ContenutoEsportazione(ModelloWardrobe):
    """Tutto ciò che è di una persona, in un oggetto solo.

    **Modello interno: non attraversa il confine** e non sta in
    `export_schema.py`. L'app non lo legge mai — lo legge la persona, dentro
    uno zip, con un editor di testo. Generarne il tipo TypeScript darebbe un
    contratto che nessuno rispetta, che è esattamente ciò che
    `.claude/rules/contratti.md` dice di non fare.

    Se un giorno qui manca qualcosa che il prodotto ha imparato a salvare,
    l'esportazione **mente**: è il solo modello del dominio che vada riguardato
    ogni volta che una tabella nuova comincia a contenere dati di qualcuno.
    """

    esportato_il: datetime
    profilo: Profilo | None = None
    capi: list[Capo] = Field(default_factory=list)
    outfit: list[Outfit] = Field(default_factory=list)
    conversazioni: list[ConversazioneEsportata] = Field(default_factory=list)
    segnalazioni: list[Segnalazione] = Field(default_factory=list)


class RichiestaSvuotamento(ModelloWardrobe):
    """Il corpo di `POST /armadio/svuota`.

    **La parola esiste per rendere impossibile l'incidente.** Il tocco sullo
    schermo è già dietro un campo in cui scrivere «SVUOTA», ma quella è una
    difesa dell'interfaccia: sparisce con un refresh, un deep-link, un `curl`
    ricopiato, o una richiesta rimandata due volte dalla libreria di rete. Un
    `Literal` la porta nel contratto, quindi un `POST` senza intenzione
    esplicita prende un 422 e non cancella niente — e il tipo TypeScript
    generato contiene la parola, così non la si ridigita di là.
    """

    conferma: Literal["SVUOTA"]


class ContoSvuotamento(ModelloWardrobe):
    """Quanto è stato cancellato davvero.

    Non è telemetria: è l'unico modo che ha la persona di sapere che
    l'operazione ha fatto ciò che prometteva. Un `204 No Content` dopo
    un'azione irreversibile lascia solo da fidarsi.
    """

    capi: int
    outfit: int
    conversazioni: int
    #: Righe della tabella `usi`, cioè coppie **capo × giorno** — non giorni.
    #: Si chiamava `giorni_di_uso` finché una prova su un Postgres vero non ha
    #: mostrato sei righe dove i giorni erano uno: un nome che conta una cosa
    #: per un'altra è una bugia che nessun test prende, perché il numero è
    #: giusto — è l'etichetta a essere sbagliata.
    usi_registrati: int
    foto: int


class EsportazionePronta(ModelloWardrobe):
    """L'indirizzo da cui l'archivio si scarica, e per quanto ancora vale.

    **È l'unica parte che attraversa il confine.** L'app non riceve i dati: ne
    riceve un URL firmato, che apre nel browser di sistema — un'app React
    Native non ha un «scarica», e il browser ce l'ha.

    `scade_il` non è decorativo: l'URL è di fatto una credenziale al portatore
    su tutto l'armadio, quindi l'interfaccia deve poter dire che è a tempo
    invece di lasciar credere che sia un link da conservare.
    """

    url: str
    scade_il: datetime
