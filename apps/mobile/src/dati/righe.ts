/**
 * Le righe del database e i modelli dell'app, tradotti in un posto solo.
 *
 * Dal passaggio a Supabase (ADR 0010) l'app legge e scrive le tabelle da sé.
 * Le tabelle hanno colonne vere (`supabase/migrations/`), i modelli che
 * l'app tiene in memoria sono annidati (`Capo.colore`, `Capo.foto`,
 * `Profilo.misure`…) e arrivano da `@wardrobe/contracts`, come prima. In mezzo
 * ci sono queste funzioni: pure, senza rete, provate in `test/dati/righe.test.ts`.
 *
 * I tipi delle righe vengono da `database.ts`, generato dallo schema: una
 * colonna rinominata diventa rosso qui, in `tsc`, non un campo che sparisce
 * in silenzio. La stessa traduzione, in Python, è in
 * `services/api/src/adapters/supabase.py`: il backend dell'IA legge le stesse
 * tabelle.
 */

import type {
  AttributoCapo,
  Capo,
  ConversazioneChat,
  MessaggioChat,
  Misure,
  OrigineOutfit,
  Outfit,
  Profilo,
  Segnalazione,
  Suggerimento,
  Tables,
  TablesInsert,
  TablesUpdate,
  Vestizione,
} from '@wardrobe/contracts'

/** Il percorso di una foto nello Storage → il suo indirizzo firmato. */
export type Firme = ReadonlyMap<string, string>

export function capoDaRiga(riga: Tables<'capi'>, firme: Firme = new Map()): Capo {
  const analisi =
    riga.analisi_provider && riga.analisi_eseguita_il
      ? {
          provider: riga.analisi_provider,
          modello: riga.analisi_modello ?? '',
          eseguita_il: riga.analisi_eseguita_il,
          confidenze: (riga.confidenze ?? {}) as Record<string, number>,
          corretti_a_mano: riga.corretti_a_mano ?? [],
          note: riga.analisi_note,
        }
      : null
  return {
    id: riga.id,
    nome: riga.nome,
    tipo: riga.tipo,
    slot: riga.slot,
    colore: { nome: riga.colore_nome, hex: riga.colore_hex },
    foto: {
      chiave: riga.foto_percorso,
      url: firme.get(riga.foto_percorso) ?? null,
      larghezza: riga.foto_larghezza,
      altezza: riga.foto_altezza,
      chiave_scontornata: riga.foto_scontornata_percorso,
      url_scontornata: riga.foto_scontornata_percorso
        ? (firme.get(riga.foto_scontornata_percorso) ?? null)
        : null,
    },
    brand: riga.brand,
    sottotipo: riga.sottotipo,
    materiale: riga.materiale,
    fantasia: riga.fantasia,
    stagione: riga.stagione,
    vestibilita: riga.vestibilita,
    lavaggio: riga.lavaggio,
    stato: riga.stato,
    preferito: riga.preferito,
    ultimo_uso: riga.ultimo_uso,
    volte_indossato: riga.volte_indossato,
    analisi,
    etichette: riga.etichette ?? [],
    appunti: riga.appunti,
    creato_il: riga.creato_il,
    aggiornato_il: riga.aggiornato_il,
  }
}

/** I percorsi di un capo da firmare per mostrarlo: l'originale e, se c'è, la scontornata. */
export function percorsiDaFirmare(capo: Pick<Capo, 'foto'>): string[] {
  return [capo.foto.chiave, capo.foto.chiave_scontornata].filter((p): p is string => Boolean(p))
}

/** Un capo con i suoi indirizzi firmati: serve al capo che arriva dall'analisi, che nasce senza. */
export function conFirme(capo: Capo, firme: Firme): Capo {
  return {
    ...capo,
    foto: {
      ...capo.foto,
      url: firme.get(capo.foto.chiave) ?? capo.foto.url ?? null,
      url_scontornata: capo.foto.chiave_scontornata
        ? (firme.get(capo.foto.chiave_scontornata) ?? capo.foto.url_scontornata ?? null)
        : null,
    },
  }
}

/**
 * Cosa l'utente può cambiare di un capo. Le colonne dell'analisi (confidenze,
 * `corretti_a_mano`, chi l'ha letta e quando) non ci sono: le protegge il
 * trigger `capi_prima_di_aggiornare`, e sarebbero ignorate comunque.
 */
export type ModificaCapo = Partial<
  Pick<
    Capo,
    | 'nome'
    | 'brand'
    | 'sottotipo'
    | 'tipo'
    | 'colore'
    | 'materiale'
    | 'fantasia'
    | 'stagione'
    | 'vestibilita'
    | 'lavaggio'
    | 'stato'
    | 'preferito'
    | 'etichette'
    | 'appunti'
  >
>

/** Una modifica del capo come aggiornamento della riga. `slot` no: lo calcola il database dal tipo. */
export function aggiornamentoDiCapo(modifica: ModificaCapo): TablesUpdate<'capi'> {
  const { colore, ...resto } = modifica
  return {
    ...resto,
    ...(colore ? { colore_nome: colore.nome, colore_hex: colore.hex } : {}),
  }
}

/**
 * Correggere un attributo letto dal modello: il valore nuovo, **e** l'attributo
 * in `corretti_a_mano`.
 *
 * La seconda metà serve alla conferma: chi tocca «è giusto» su un valore che
 * resta uguale non cambia nessuna colonna, e senza aggiungerlo lì il trigger
 * non saprebbe che c'è stato un tocco. È il trigger a portare la confidenza a
 * 100 e a tenere l'elenco senza doppioni: qui si dice solo «questo l'ho visto io».
 */
export function correzioneDiCapo(
  capo: Pick<Capo, 'analisi'>,
  attributo: AttributoCapo,
  modifica: ModificaCapo,
): TablesUpdate<'capi'> {
  const gia = capo.analisi?.corretti_a_mano ?? []
  return {
    ...aggiornamentoDiCapo(modifica),
    corretti_a_mano: gia.includes(attributo) ? [...gia] : [...gia, attributo],
  }
}

const CAMPI_MISURE = [
  'sistema_taglie',
  'taglia',
  'altezza_cm',
  'corporatura',
  'spalle_cm',
  'lunghezza_gamba_cm',
] as const satisfies readonly (keyof Misure & keyof Tables<'profili'>)[]

export function profiloDaRiga(riga: Tables<'profili'>): Profilo {
  const misure: Misure = {}
  for (const campo of CAMPI_MISURE) {
    if (riga[campo] !== null) Object.assign(misure, { [campo]: riga[campo] })
  }
  return {
    id: riga.id,
    nome: riga.nome ?? '',
    citta: riga.citta,
    preferenze: {
      stili: riga.stili ?? [],
      palette: riga.palette ?? [],
      evita: riga.evita ?? [],
    },
    misure: Object.keys(misure).length > 0 ? misure : null,
    unita_lunghezza: riga.unita_lunghezza ?? 'cm',
    avatar_foto_chiave: riga.avatar_foto_percorso,
    creato_il: riga.creato_il,
  }
}

/**
 * Il profilo come aggiornamento della riga. `misure: null` azzera le sei
 * colonne: è quello che l'utente chiede togliendole tutte.
 */
export function aggiornamentoDiProfilo(profilo: Profilo): TablesUpdate<'profili'> {
  const misure = profilo.misure ?? {}
  return {
    nome: profilo.nome,
    citta: profilo.citta ?? null,
    stili: profilo.preferenze?.stili ?? [],
    palette: profilo.preferenze?.palette ?? [],
    evita: profilo.preferenze?.evita ?? [],
    unita_lunghezza: profilo.unita_lunghezza ?? 'cm',
    avatar_foto_percorso: profilo.avatar_foto_chiave ?? null,
    ...Object.fromEntries(CAMPI_MISURE.map((campo) => [campo, misure[campo] ?? null])),
  }
}

export function outfitDaRiga(riga: Tables<'outfit'>): Outfit {
  return {
    id: riga.id,
    nome: riga.nome,
    vestizione: {
      top: riga.capo_top,
      bottom: riga.capo_bottom,
      outer: riga.capo_outer,
      shoes: riga.capo_shoes,
      dress: riga.capo_dress,
    },
    occasione: riga.occasione,
    origine: riga.origine,
    volte_indossato: riga.volte_indossato,
    ultimo_uso: riga.ultimo_uso,
    creato_il: riga.creato_il,
  }
}

export function rigaDiNuovoOutfit(nuovo: {
  nome: string
  vestizione: Vestizione
  occasione?: string | null
  origine?: OrigineOutfit
}): TablesInsert<'outfit'> {
  return {
    nome: nuovo.nome,
    capo_top: nuovo.vestizione.top ?? null,
    capo_bottom: nuovo.vestizione.bottom ?? null,
    capo_outer: nuovo.vestizione.outer ?? null,
    capo_shoes: nuovo.vestizione.shoes ?? null,
    capo_dress: nuovo.vestizione.dress ?? null,
    occasione: nuovo.occasione ?? null,
    origine: nuovo.origine ?? 'manuale',
  }
}

export function conversazioneDaRiga(
  riga: Pick<Tables<'conversazioni_chat'>, 'id' | 'titolo' | 'creata_il' | 'ultimo_turno_il'>,
): ConversazioneChat {
  return {
    id: riga.id,
    titolo: riga.titolo,
    creata_il: riga.creata_il,
    ultimo_turno_il: riga.ultimo_turno_il,
  }
}

export function messaggioDaRiga(riga: Tables<'messaggi_chat'>): MessaggioChat {
  return {
    id: riga.id,
    ruolo: riga.ruolo,
    testo: riga.testo,
    // Le proposte le ha già validate il backend quando le ha scritte
    // (`domain/stylist.py`): il database le tiene come `jsonb`, qui tornano
    // del loro tipo.
    suggerimenti: (Array.isArray(riga.suggerimenti) ? riga.suggerimenti : []) as unknown as Suggerimento[],
    creato_il: riga.creato_il,
  }
}

export function segnalazioneDaRiga(riga: Tables<'segnalazioni'>): Segnalazione {
  return {
    id: riga.id,
    utente_id: riga.utente_id,
    testo: riga.testo,
    stato: riga.stato,
    creata_il: riga.creata_il,
    aggiornata_il: riga.aggiornata_il,
  }
}

/**
 * Il giorno **di chi usa l'app**, non quello di Greenwich. `toISOString()`
 * darebbe la data UTC: in Italia, fra mezzanotte e le due, «l'ho messo oggi»
 * finirebbe su ieri.
 */
export function giornoLocale(quando: Date = new Date()): string {
  const due = (n: number) => String(n).padStart(2, '0')
  return `${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())}`
}

/**
 * Dove va una foto nuova: la cartella dell'utente, poi il tipo e il giorno. Il
 * primo segmento è l'utente perché è quello che le policy dello Storage e il
 * backend controllano (`privato.percorso_di`, `domain/accesso.percorso_dell_utente`).
 */
export function percorsoNuovaFoto(
  utenteId: string,
  cosa: 'capi' | 'avatar',
  nome: string,
  quando: Date = new Date(),
): string {
  return cosa === 'capi'
    ? `${utenteId}/capi/${giornoLocale(quando)}/${nome}.jpg`
    : `${utenteId}/avatar/${nome}.jpg`
}
