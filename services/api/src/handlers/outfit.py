"""Gli outfit salvati e l'avatar."""

from __future__ import annotations

from domain.errors import RichiestaNonValida
from domain.models import NuovoOutfit, Outfit, VestizioneColori
from domain.wardrobe import colori_vestizione, per_id, vestizione_indossabile
from handlers._container import generatore_id, orologio, repository
from handlers._http import Evento, Risposta, corpo, endpoint, ok, parametro, utente_id


@endpoint
def elenca(evento: Evento) -> Risposta:
    return ok(
        {
            "outfit": [
                o.model_dump(mode="json") for o in repository().elenca_outfit(utente_id(evento))
            ]
        }
    )


@endpoint
def salva(evento: Evento) -> Risposta:
    nuovo = corpo(evento, NuovoOutfit)
    if not vestizione_indossabile(nuovo.vestizione):
        raise RichiestaNonValida("un outfit ha bisogno di un abito, o di sopra e sotto")

    outfit = Outfit(
        id=generatore_id().nuovo(),
        nome=nuovo.nome,
        vestizione=nuovo.vestizione,
        occasione=nuovo.occasione,
        origine=nuovo.origine,
        creato_il=orologio().adesso(),
    )
    return ok(repository().salva_outfit(utente_id(evento), outfit), 201)


@endpoint
def colori(evento: Evento) -> Risposta:
    """GET /outfit/{outfitId}/colori — quello che serve al manichino 3D.

    L'avatar non riceve capi né foto: riceve cinque colori. Questo endpoint fa
    la traduzione lato server così che l'app non debba conoscere la regola.
    """
    utente, outfit_id = utente_id(evento), parametro(evento, "outfitId")
    outfit = next((o for o in repository().elenca_outfit(utente) if o.id == outfit_id), None)
    if outfit is None:
        from domain.errors import OutfitNonTrovato

        raise OutfitNonTrovato(outfit_id)

    indice = per_id(repository().elenca_capi(utente))
    risultato: VestizioneColori = colori_vestizione(outfit.vestizione, indice)
    return ok(risultato)
