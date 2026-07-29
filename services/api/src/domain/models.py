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


class ModelloTela(BaseModel):
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


class JobIa(StrEnum):
    """I due lavori veri che l'IA fa nel prodotto.

    Il playground esercita questi, non una chat generica: così provare un
    provider nuovo significa aggiungere un adapter, mai toccare una schermata.
    """

    ANALISI_CAPO = "analisi_capo"
    SUGGERIMENTO = "suggerimento"


class EsitoEsecuzione(StrEnum):
    OK = "ok"
    VAGO = "vago"
    ERRORE = "errore"


Confidenza = Annotated[int, Field(ge=0, le=100)]
Percentuale = Annotated[int, Field(ge=0, le=100)]
EsaColore = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class Colore(ModelloTela):
    """Nome leggibile più esadecimale.

    L'hex non è un vezzo: è quello che il manichino 3D di oggi usa per tingere le
    mesh, e per ora senza hex l'avatar non sa indossare il capo. È il primo passo:
    l'ADR 0004 porta l'avatar a vestire la foto scontornata del capo come texture,
    e allora il colore diventa il ripiego invece del requisito.
    """

    nome: str
    hex: EsaColore


class FotoCapo(ModelloTela):
    chiave: str = Field(description="Chiave dell'oggetto su S3")
    url: str | None = Field(default=None, description="URL firmato, a vita breve")
    larghezza: int | None = None
    altezza: int | None = None


class AnalisiVisione(ModelloTela):
    """Traccia di chi ha letto la foto, quando, e con quanta sicurezza."""

    provider: str
    modello: str
    eseguita_il: datetime
    confidenze: dict[AttributoCapo, Confidenza] = Field(default_factory=dict)
    corretti_a_mano: list[AttributoCapo] = Field(default_factory=list)
    note: str | None = None


class Capo(ModelloTela):
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
    creato_il: datetime
    aggiornato_il: datetime


class CapoSintetico(ModelloTela):
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


class LetturaCapo(ModelloTela):
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


class Vestizione(ModelloTela):
    """Chi occupa quale slot dell'avatar. I valori sono id di capo.

    Le chiavi sono quelle di `mannequin.setOutfit()`: non tradurle.
    """

    top: str | None = None
    bottom: str | None = None
    outer: str | None = None
    shoes: str | None = None
    dress: str | None = None


class VestizioneColori(ModelloTela):
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


class Outfit(ModelloTela):
    id: str
    nome: str
    vestizione: Vestizione
    occasione: str | None = None
    origine: OrigineOutfit = OrigineOutfit.MANUALE
    volte_indossato: int = 0
    ultimo_uso: date | None = None
    creato_il: datetime


class Suggerimento(ModelloTela):
    """Una proposta dello stilista, già validata contro l'armadio vero."""

    titolo: str
    match: Percentuale
    vestizione: Vestizione
    perche: list[str] = Field(max_length=3)


class Meteo(ModelloTela):
    citta: str
    temp_c: float
    condizione: str
    percepita_c: float | None = None


class ImpegnoAgenda(ModelloTela):
    ora: str
    titolo: str
    dress_code: str | None = None


class PreferenzeStile(ModelloTela):
    stili: list[str] = Field(default_factory=list)
    palette: list[str] = Field(default_factory=list)
    evita: list[str] = Field(default_factory=list)


class ContestoSuggerimento(ModelloTela):
    """Tutto ciò che lo stilista può sapere, e nient'altro.

    È anche il payload che il playground mostra in chiaro: se un suggerimento
    esce strano, si guarda qui prima di dare la colpa al modello.
    """

    capi_disponibili: list[CapoSintetico]
    meteo: Meteo | None = None
    agenda: list[ImpegnoAgenda] = Field(default_factory=list)
    in_lavaggio: list[str] = Field(default_factory=list)
    indossati_di_recente: list[str] = Field(default_factory=list)
    preferenze: PreferenzeStile = PreferenzeStile()
    richiesta_utente: str | None = None
    numero_proposte: Annotated[int, Field(ge=1, le=5)] = 3


class Profilo(ModelloTela):
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


class FiltroArmadio(ModelloTela):
    tipo: TipoCapo | None = None
    stato: StatoCapo | None = None
    solo_preferiti: bool = False
    testo: str | None = None


class ElencoCapi(ModelloTela):
    capi: list[Capo]
    totale: int


class RiepilogoArmadio(ModelloTela):
    totale: int
    da_lavare: int
    dormienti: int
    valore_dormiente_eur: float | None = None


class UploadFirmato(ModelloTela):
    """Risposta all'app prima che carichi la foto: l'upload va diretto a S3."""

    chiave: str
    url: str
    metodo: str = "PUT"
    intestazioni: dict[str, str] = Field(default_factory=dict)
    scade_in_s: int


class RichiestaUpload(ModelloTela):
    content_type: str
    nota: str | None = None


class RichiestaAnalisi(ModelloTela):
    chiave_foto: str
    provider: str | None = None
    modello: str | None = None


class StatoAnalisi(StrEnum):
    IN_CORSO = "in_corso"
    COMPLETATA = "completata"
    FALLITA = "fallita"


class AnalisiAvviata(ModelloTela):
    """L'app riceve un identificativo e interroga lo stato: l'analisi è lenta.

    Tenerla asincrona è ciò che permette il caricamento in blocco di venti foto
    senza che l'app resti appesa a una richiesta HTTP di quaranta secondi.
    """

    esecuzione_id: str
    stato: StatoAnalisi = StatoAnalisi.IN_CORSO


class EsitoAnalisi(ModelloTela):
    esecuzione_id: str
    stato: StatoAnalisi
    capo: Capo | None = None
    errore: str | None = None


class CorrezioniCapo(ModelloTela):
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


class AggiornamentoCapo(ModelloTela):
    correzioni: CorrezioniCapo = CorrezioniCapo()
    nome: str | None = None
    preferito: bool | None = None
    stato: StatoCapo | None = None


class RichiestaSuggerimenti(ModelloTela):
    richiesta_utente: str | None = None
    meteo: Meteo | None = None
    agenda: list[ImpegnoAgenda] = Field(default_factory=list)
    numero_proposte: Annotated[int, Field(ge=1, le=5)] = 3
    provider: str | None = None
    modello: str | None = None


class RispostaSuggerimenti(ModelloTela):
    suggerimenti: list[Suggerimento]
    contesto: ContestoSuggerimento
    provider: str
    modello: str
    latenza_ms: int


class NuovoOutfit(ModelloTela):
    nome: str
    vestizione: Vestizione
    occasione: str | None = None
    origine: OrigineOutfit = OrigineOutfit.MANUALE


class ModelloDisponibile(ModelloTela):
    """Una riga della lista modelli del playground."""

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


class PresetPrompt(ModelloTela):
    id: str
    etichetta: str
    job: JobIa
    system_prompt: str
    temperatura: Annotated[float, Field(ge=0, le=2)] = 0.4
    max_token: Annotated[int, Field(ge=1, le=32_000)] = 1200


class RichiestaPlayground(ModelloTela):
    job: JobIa
    provider: str
    modello: str
    system_prompt: str | None = None
    temperatura: Annotated[float, Field(ge=0, le=2)] = 0.4
    max_token: Annotated[int, Field(ge=1, le=32_000)] = 1200
    chiave_foto: str | None = Field(
        default=None, description="Obbligatoria per il job analisi_capo"
    )
    contesto: ContestoSuggerimento | None = Field(
        default=None, description="Obbligatorio per il job suggerimento"
    )


class UsoToken(ModelloTela):
    token_input: int = 0
    token_output: int = 0


class EsitoPlayground(ModelloTela):
    ok: bool
    esito: EsitoEsecuzione
    provider: str
    modello: str
    latenza_ms: int
    uso: UsoToken | None = None
    costo_eur: float | None = None
    testo: str | None = None
    lettura: LetturaCapo | None = None
    suggerimenti: list[Suggerimento] = Field(default_factory=list)
    errore: str | None = None


class EsecuzionePlayground(ModelloTela):
    """Riga dello storico: serve a confrontare provider a distanza di giorni."""

    id: str
    eseguita_il: datetime
    job: JobIa
    provider: str
    modello: str
    temperatura: float
    latenza_ms: int
    costo_eur: float | None = None
    esito: EsitoEsecuzione
    preset: str | None = None
