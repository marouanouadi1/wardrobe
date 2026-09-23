"""«Svuota l'armadio»: l'unica operazione del backend che distrugge davvero.

Sta in un file suo e non dentro `capi.py` di proposito: un'operazione
irreversibile deve essere **trovabile**, non annidata accanto a una `GET`.

**Cosa porta via**, e la lista è la stessa che la schermata mostra prima di
chiedere conferma — se le due divergono, la schermata sta mentendo: i capi con
le loro foto, gli outfit, le conversazioni con tutti i turni, e il registro di
cosa è stato messo e quando.

**Cosa non tocca**, e ognuna per una ragione diversa:

- il **profilo** — misure, preferenze di stile, foto dell'avatar. Scelta
  dell'utente del 2026-09-23: chi svuota per ricominciare da capo non deve
  reinserire la propria altezza. Il deck le elencava fra le cose che
  spariscono, ma lì era **un'operazione sola** che portava via anche l'account;
- l'**account** — email e modo di entrare. È «Elimina l'account», un'altra cosa,
  ancora da decidere «anche in base a policy e privacy»;
- le **segnalazioni** — hanno un lato amministratore e non sono contenuto
  dell'armadio. Il deck non le elenca.
"""

from __future__ import annotations

from domain.errors import SvuotamentoParziale
from domain.models import RichiestaSvuotamento
from handlers._container import archivio_foto, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, utente_id


def prefisso_foto(utente: str) -> str:
    """Dove vivono i file di una persona: `capi/{utente}/`.

    Tutte e tre le specie ci stanno sotto — la foto caricata
    (`handlers/foto.py`: `capi/{utente}/{giorno}/{id}`), la sua versione
    scontornata (`{chiave}-scontornata`) e la foto dell'avatar, che passa dallo
    stesso upload. Lo slash finale non è cosmetico: senza, il prefisso
    `capi/ab` prenderebbe anche `capi/abc`.
    """
    return f"capi/{utente}/"


@endpoint
def svuota(evento: Evento) -> Risposta:
    """Righe prima, file dopo — e se i file non vanno, si dice.

    **L'ordine è l'unico difendibile.** Cancellando prima i file, un errore
    sulle righe lascerebbe un armadio pieno di capi le cui foto non esistono
    più: rotto e visibile. Così invece resta al massimo qualche file orfano,
    che nessuno vede — ma proprio perché nessuno lo vede **non si può
    ingoiare**. Nell'esportazione una foto illeggibile si saltava, e lì era
    giusto: un archivio in meno di una foto è ancora un archivio. Qui è il
    contrario — una foto sopravvissuta a uno svuotamento completato vuol dire
    che la cancellazione ha mentito.
    """
    utente = utente_id(evento)
    corpo(evento, RichiestaSvuotamento)

    profilo = repository().leggi_profilo(utente)
    # La foto dell'avatar sta sotto lo stesso prefisso ma **resta**: si esclude
    # per chiave. Escludere non può distruggere niente — se mai quella chiave
    # puntasse al file di un altro (`T-47`), lo proteggerebbe soltanto.
    avatar = profilo.avatar_foto_chiave if profilo else None
    tranne = frozenset({avatar} if avatar else ())

    conto = repository().svuota_armadio(utente)
    try:
        foto = archivio_foto().elimina_sotto(prefisso_foto(utente), tranne=tranne)
    except Exception as errore:
        raise SvuotamentoParziale(
            "L'armadio è stato svuotato, ma alcune foto non sono state cancellate."
        ) from errore
    return ok(conto.model_copy(update={"foto": foto}))
