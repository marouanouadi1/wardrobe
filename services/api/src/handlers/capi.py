"""I capi dell'armadio. Un entrypoint Lambda per verbo."""

from __future__ import annotations

from domain.errors import CapoNonTrovato
from domain.models import (
    AggiornamentoCapo,
    AttributoCapo,
    Capo,
    ElencoCapi,
    FiltroArmadio,
    NuovoCapoManuale,
    StatoCapo,
    TipoCapo,
)
from domain.wardrobe import (
    correggi_attributo,
    crea_capo_manuale,
    filtra,
    riepilogo,
    segna_indossato,
)
from handlers._container import archivio_foto, generatore_id, orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, query, utente_id


def _filtro_da_query(evento: Evento) -> FiltroArmadio:
    parametri = query(evento)
    return FiltroArmadio(
        tipo=TipoCapo(parametri["tipo"]) if parametri.get("tipo") else None,
        stato=StatoCapo(parametri["stato"]) if parametri.get("stato") else None,
        solo_preferiti=parametri.get("preferiti") == "1",
        testo=parametri.get("testo"),
    )


def _con_url(capo: Capo) -> Capo:
    """La foto viaggia come URL firmato a vita breve, mai come bucket pubblico."""
    chiave_scontornata = capo.foto.chiave_scontornata
    return capo.model_copy(
        update={
            "foto": capo.foto.model_copy(
                update={
                    "url": archivio_foto().url_lettura(capo.foto.chiave),
                    "url_scontornata": (
                        archivio_foto().url_lettura(chiave_scontornata)
                        if chiave_scontornata
                        else None
                    ),
                }
            )
        }
    )


@endpoint
def elenca(evento: Evento) -> Risposta:
    capi = filtra(repository().elenca_capi(utente_id(evento)), _filtro_da_query(evento))
    return ok(ElencoCapi(capi=[_con_url(capo) for capo in capi], totale=len(capi)))


@endpoint
def leggi(evento: Evento) -> Risposta:
    capo_id = parametro(evento, "capoId")
    capo = repository().leggi_capo(utente_id(evento), capo_id)
    if capo is None:
        raise CapoNonTrovato(capo_id)
    return ok(_con_url(capo))


@endpoint
def crea(evento: Evento) -> Risposta:
    """POST /capi — un capo inserito a mano, senza passare dal modello di visione."""
    utente = utente_id(evento)
    nuovo = corpo(evento, NuovoCapoManuale)
    capo = crea_capo_manuale(nuovo, capo_id=generatore_id().nuovo(), adesso=orologio().adesso())
    return ok(_con_url(repository().salva_capo(utente, capo)), 201)


@endpoint
def aggiorna(evento: Evento) -> Risposta:
    """PATCH /capi/{capoId} — correzioni dell'utente, preferito, stato lavaggio."""
    utente, capo_id = utente_id(evento), parametro(evento, "capoId")
    modifica = corpo(evento, AggiornamentoCapo)

    capo = repository().leggi_capo(utente, capo_id)
    if capo is None:
        raise CapoNonTrovato(capo_id)

    adesso = orologio().adesso()
    for attributo in AttributoCapo:
        valore = getattr(modifica.correzioni, attributo.value, None)
        if valore is not None:
            capo = correggi_attributo(capo, attributo, valore, adesso)
    if modifica.preferito is not None:
        capo = capo.model_copy(update={"preferito": modifica.preferito, "aggiornato_il": adesso})
    if modifica.stato is not None:
        capo = capo.model_copy(update={"stato": modifica.stato, "aggiornato_il": adesso})
    if modifica.nome is not None:
        capo = capo.model_copy(update={"nome": modifica.nome, "aggiornato_il": adesso})
    if modifica.etichette is not None:
        capo = capo.model_copy(update={"etichette": modifica.etichette, "aggiornato_il": adesso})
    if modifica.appunti is not None:
        capo = capo.model_copy(update={"appunti": modifica.appunti, "aggiornato_il": adesso})

    return ok(_con_url(repository().salva_capo(utente, capo)))


@endpoint
def indossa(evento: Evento) -> Risposta:
    """POST /capi/{capoId}/indossato — «l'ho messo oggi»."""
    utente, capo_id = utente_id(evento), parametro(evento, "capoId")
    capo = repository().leggi_capo(utente, capo_id)
    if capo is None:
        raise CapoNonTrovato(capo_id)

    giorno = orologio().oggi()
    salvato = repository().salva_capo(utente, segna_indossato(capo, giorno, orologio().adesso()))
    repository().registra_uso(utente, [capo_id], giorno)
    return ok(_con_url(salvato))


@endpoint
def sommario(evento: Evento) -> Risposta:
    """GET /armadio/riepilogo — i numeri che l'app mostra su Profilo e Calendario."""
    capi = repository().elenca_capi(utente_id(evento))
    return ok(riepilogo(capi, orologio().oggi()))
