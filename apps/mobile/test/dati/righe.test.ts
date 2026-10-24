/**
 * Le traduzioni fra righe del database e modelli dell'app (`src/dati/righe.ts`).
 *
 * Niente rete: le righe sono scritte qui, con la forma che `database.ts` dà
 * loro. Si guarda che niente si perda andando e tornando, e che un
 * aggiornamento non mandi colonne che il database calcola da sé (`slot`) o
 * protegge (le colonne dell'analisi).
 */

import type { Tables } from '@wardrobe/contracts'
import {
  aggiornamentoDiCapo,
  aggiornamentoDiProfilo,
  capoDaRiga,
  conFirme,
  correzioneDiCapo,
  giornoLocale,
  messaggioDaRiga,
  outfitDaRiga,
  percorsiDaFirmare,
  percorsoNuovaFoto,
  profiloDaRiga,
  rigaDiNuovoOutfit,
} from '../../src/dati/righe'

const UTENTE = '00000000-0000-4000-8000-00000000000a'

function rigaCapo(altro: Partial<Tables<'capi'>> = {}): Tables<'capi'> {
  return {
    id: 'c1',
    utente_id: UTENTE,
    nome: 'Camicia in lino',
    tipo: 'top',
    slot: 'top',
    colore_nome: 'Panna',
    colore_hex: '#E7DFD2',
    foto_percorso: `${UTENTE}/capi/2026-09-27/c1.jpg`,
    foto_larghezza: null,
    foto_altezza: null,
    foto_scontornata_percorso: null,
    brand: null,
    sottotipo: 'camicia',
    materiale: 'Lino',
    fantasia: null,
    stagione: 'estate',
    vestibilita: null,
    lavaggio: null,
    stato: 'pulito',
    preferito: false,
    ultimo_uso: null,
    volte_indossato: 0,
    analisi_provider: 'anthropic',
    analisi_modello: 'claude',
    analisi_eseguita_il: '2026-09-27T10:00:00+00:00',
    analisi_note: null,
    confidenze: { tipo: 96, materiale: 70 },
    corretti_a_mano: [],
    etichette: ['lavoro'],
    appunti: null,
    creato_il: '2026-09-27T10:00:00+00:00',
    aggiornato_il: '2026-09-27T10:00:00+00:00',
    ...altro,
  }
}

describe('capi', () => {
  test('una riga diventa un capo con colore, foto e analisi annidati', () => {
    const capo = capoDaRiga(rigaCapo())

    expect(capo.colore).toEqual({ nome: 'Panna', hex: '#E7DFD2' })
    expect(capo.foto.chiave).toBe(`${UTENTE}/capi/2026-09-27/c1.jpg`)
    expect(capo.analisi?.confidenze).toEqual({ tipo: 96, materiale: 70 })
    expect(capo.etichette).toEqual(['lavoro'])
  })

  test('senza analisi non se ne inventa una', () => {
    expect(capoDaRiga(rigaCapo({ analisi_provider: null, analisi_eseguita_il: null })).analisi).toBeNull()
  })

  test('le foto prendono l’indirizzo firmato del loro percorso, e la scontornata il suo', () => {
    const riga = rigaCapo({ foto_scontornata_percorso: `${UTENTE}/capi/2026-09-27/c1.jpg-scontornata` })
    const firme = new Map([
      [riga.foto_percorso, 'https://firmato/originale'],
      [`${UTENTE}/capi/2026-09-27/c1.jpg-scontornata`, 'https://firmato/scontornata'],
    ])

    const capo = capoDaRiga(riga, firme)

    expect(capo.foto.url).toBe('https://firmato/originale')
    expect(capo.foto.url_scontornata).toBe('https://firmato/scontornata')
    expect(percorsiDaFirmare(capo)).toEqual([riga.foto_percorso, riga.foto_scontornata_percorso])
  })

  test('un capo arrivato dall’analisi, senza indirizzi, li riceve dopo', () => {
    const senza = capoDaRiga(rigaCapo())
    const con = conFirme(senza, new Map([[senza.foto.chiave, 'https://firmato/originale']]))

    expect(senza.foto.url).toBeNull()
    expect(con.foto.url).toBe('https://firmato/originale')
  })

  test('una modifica non manda lo slot, e il colore diventa due colonne', () => {
    const aggiornamento = aggiornamentoDiCapo({ tipo: 'pantaloni', colore: { nome: 'Blu', hex: '#1F2A44' } })

    expect(aggiornamento).toEqual({ tipo: 'pantaloni', colore_nome: 'Blu', colore_hex: '#1F2A44' })
    expect('slot' in aggiornamento).toBe(false)
  })

  test('una correzione aggiunge l’attributo a quelli visti a mano, senza doppioni', () => {
    const capo = capoDaRiga(rigaCapo({ corretti_a_mano: ['tipo'] }))

    expect(correzioneDiCapo(capo, 'materiale', { materiale: 'Cotone' })).toEqual({
      materiale: 'Cotone',
      corretti_a_mano: ['tipo', 'materiale'],
    })
    // Confermare un valore già corretto non lo ripete.
    expect(correzioneDiCapo(capo, 'tipo', { tipo: 'top' }).corretti_a_mano).toEqual(['tipo'])
  })
})

describe('profilo', () => {
  const riga: Tables<'profili'> = {
    id: UTENTE,
    nome: 'Anna',
    citta: 'Milano',
    stili: ['minimal'],
    palette: [],
    evita: ['giallo'],
    sistema_taglie: 'donna',
    taglia: 'm',
    altezza_cm: 170,
    corporatura: null,
    spalle_cm: null,
    lunghezza_gamba_cm: null,
    unita_lunghezza: 'cm',
    avatar_foto_percorso: null,
    avatar_corpo_base: null,
    avatar_cursori: {},
    avatar_pelle: null,
    avatar_capelli: null,
    creato_il: '2026-09-01T10:00:00+00:00',
  }

  test('le sei colonne delle misure tornano un oggetto solo, e solo quelle che ci sono', () => {
    const profilo = profiloDaRiga(riga)

    expect(profilo.misure).toEqual({ sistema_taglie: 'donna', taglia: 'm', altezza_cm: 170 })
    expect(profilo.preferenze).toEqual({ stili: ['minimal'], palette: [], evita: ['giallo'] })
  })

  test('senza nessuna misura il profilo non ne ha', () => {
    expect(profiloDaRiga({ ...riga, sistema_taglie: null, taglia: null, altezza_cm: null }).misure).toBeNull()
  })

  test('andata e ritorno non perdono niente, e togliere le misure le azzera tutte', () => {
    const profilo = profiloDaRiga(riga)

    expect(aggiornamentoDiProfilo(profilo)).toMatchObject({
      nome: 'Anna',
      stili: ['minimal'],
      evita: ['giallo'],
      taglia: 'm',
      altezza_cm: 170,
      corporatura: null,
    })
    expect(aggiornamentoDiProfilo({ ...profilo, misure: null })).toMatchObject({
      sistema_taglie: null,
      taglia: null,
      altezza_cm: null,
      spalle_cm: null,
      lunghezza_gamba_cm: null,
    })
  })

  test('un profilo senza avatar non manda le colonne dell’avatar', () => {
    // Così misure, unità e onboarding si salvano anche su un database dove la
    // migrazione dell'avatar non è ancora arrivata.
    const senza = aggiornamentoDiProfilo(profiloDaRiga(riga))
    expect(Object.keys(senza).filter((k) => k.startsWith('avatar_') && k !== 'avatar_foto_percorso')).toEqual([])
  })

  test('senza un corpo di partenza non c’è avatar, anche se i cursori ci sono', () => {
    // I cursori da soli non dicono da quale corpo partono: leggerli come un
    // avatar vorrebbe dire inventarne il corpo.
    expect(profiloDaRiga({ ...riga, avatar_cursori: { weight: 0.75 } }).avatar).toBeNull()
  })

  test('l’avatar va e torna dalle quattro colonne', () => {
    const conAvatar = profiloDaRiga({
      ...riga,
      avatar_corpo_base: 'uomo',
      avatar_cursori: { weight: 0.75, 'measure-shoulder-dist-decr-incr': -0.5 },
      avatar_pelle: 'olivastra',
      avatar_capelli: null,
    })

    expect(conAvatar.avatar).toEqual({
      corpo_base: 'uomo',
      cursori: { weight: 0.75, 'measure-shoulder-dist-decr-incr': -0.5 },
      pelle: 'olivastra',
      capelli: null,
    })
    expect(aggiornamentoDiProfilo(conAvatar)).toMatchObject({
      avatar_corpo_base: 'uomo',
      avatar_cursori: { weight: 0.75, 'measure-shoulder-dist-decr-incr': -0.5 },
      avatar_pelle: 'olivastra',
      avatar_capelli: null,
    })
    // L'altezza dell'avatar non ha una colonna sua: è quella delle misure.
    expect(aggiornamentoDiProfilo(conAvatar).altezza_cm).toBe(170)
  })

  test('di un jsonb dei cursori si tiene solo ciò che è un numero', () => {
    const strano = profiloDaRiga({ ...riga, avatar_corpo_base: 'donna', avatar_cursori: { weight: '0.5', muscle: 0.25 } })
    expect(strano.avatar?.cursori).toEqual({ muscle: 0.25 })
    expect(profiloDaRiga({ ...riga, avatar_corpo_base: 'donna', avatar_cursori: [0.5] }).avatar?.cursori).toEqual({})
  })
})

describe('outfit e chat', () => {
  test('la vestizione va e torna dalle cinque colonne', () => {
    const nuovo = rigaDiNuovoOutfit({ nome: 'Ufficio', vestizione: { top: 't1', bottom: 'b1' } })

    expect(nuovo).toMatchObject({ capo_top: 't1', capo_bottom: 'b1', capo_outer: null, origine: 'manuale' })

    const outfit = outfitDaRiga({
      ...nuovo,
      id: 'o1',
      utente_id: UTENTE,
      nome: 'Ufficio',
      capo_top: 't1',
      capo_bottom: 'b1',
      capo_outer: null,
      capo_shoes: null,
      capo_dress: null,
      occasione: null,
      origine: 'manuale',
      volte_indossato: 0,
      ultimo_uso: null,
      creato_il: '2026-09-27T10:00:00+00:00',
    })
    expect(outfit.vestizione).toEqual({ top: 't1', bottom: 'b1', outer: null, shoes: null, dress: null })
  })

  test('un messaggio senza proposte ha un elenco vuoto, non un buco', () => {
    const messaggio = messaggioDaRiga({
      id: 'm1',
      utente_id: UTENTE,
      conversazione_id: 'k1',
      ruolo: 'wardrobe',
      testo: 'Ciao',
      suggerimenti: null,
      creato_il: '2026-09-27T10:00:00+00:00',
    })

    expect(messaggio.suggerimenti).toEqual([])
  })
})

describe('giorni e percorsi', () => {
  test('il giorno è quello locale, non quello di Greenwich', () => {
    // Le 00:30 del 28 settembre, ora locale: in UTC, a est di Greenwich,
    // sarebbe ancora il 27.
    expect(giornoLocale(new Date(2026, 8, 28, 0, 30))).toBe('2026-09-28')
  })

  test('una foto nuova sta nella cartella dell’utente', () => {
    const quando = new Date(2026, 8, 27, 12, 0)

    expect(percorsoNuovaFoto(UTENTE, 'capi', 'abc', quando)).toBe(`${UTENTE}/capi/2026-09-27/abc.jpg`)
    expect(percorsoNuovaFoto(UTENTE, 'avatar', 'abc', quando)).toBe(`${UTENTE}/avatar/abc.jpg`)
  })
})
