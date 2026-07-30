/**
 * L'armadio di esempio: dodici capi, per far girare l'app senza backend.
 *
 * Rispecchia `services/api/src/adapters/memory.py`. La duplicazione è voluta e
 * limitata a questo file: serve perché `npm run mobile` funzioni appena clonato
 * il repository, senza Docker, senza AWS, senza nemmeno Python. Quando
 * `EXPO_PUBLIC_API_URL` è impostata questi dati non vengono nemmeno letti.
 *
 * Le foto sono di Pexels (uso libero), le stesse del design.
 */

import type { Capo, ModelloDisponibile, Outfit, Profilo, Suggerimento, TipoCapo } from '@wardrobe/contracts'
import { slotDiTipo } from './dominio'

const oggi = new Date()

function giorniFa(giorni: number | null): string | null {
  if (giorni === null) return null
  const data = new Date(oggi)
  data.setDate(data.getDate() - giorni)
  return data.toISOString().slice(0, 10)
}

function foto(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800&h=1000&fit=crop`
}

interface Seme {
  id: string
  nome: string
  brand: string
  tipo: TipoCapo
  pexels: number
  colore: string
  hex: string
  materiale: string
  stagione: Capo['stagione']
  vestibilita: string
  lavaggio: string
  confidenza: number
  giorni: number | null
}

const SEMI: Seme[] = [
  { id: 't1', nome: 'T-shirt bianca', brand: 'Uniqlo', tipo: 'top', pexels: 18257675, colore: 'Bianco ottico', hex: '#EFEBE3', materiale: 'Cotone 100%', stagione: 'tutto_lanno', vestibilita: 'Regular', lavaggio: '30°', confidenza: 96, giorni: 3 },
  { id: 't2', nome: 'T-shirt nera', brand: 'COS', tipo: 'top', pexels: 18186105, colore: 'Nero', hex: '#1C1C21', materiale: 'Cotone pesante', stagione: 'tutto_lanno', vestibilita: 'Boxy', lavaggio: '30° rovescio', confidenza: 94, giorni: 6 },
  { id: 't3', nome: 'Camicia in lino', brand: 'Arket', tipo: 'top', pexels: 37704849, colore: 'Panna', hex: '#E7DFD2', materiale: 'Lino 100%', stagione: 'estate', vestibilita: 'Oversize', lavaggio: '40° stira umida', confidenza: 88, giorni: 11 },
  { id: 't4', nome: 'Maglione di lana', brand: 'Arket', tipo: 'top', pexels: 14553511, colore: 'Bianco caldo', hex: '#E4DED2', materiale: 'Lana merino 80%', stagione: 'inverno', vestibilita: 'Regular', lavaggio: 'A mano', confidenza: 81, giorni: 120 },
  { id: 'b1', nome: 'Jeans dritti', brand: "Levi's 501", tipo: 'pantaloni', pexels: 17630811, colore: 'Indaco medio', hex: '#46536B', materiale: 'Denim cotone 100%', stagione: 'tutto_lanno', vestibilita: 'Dritta', lavaggio: '30° rovescio', confidenza: 95, giorni: 1 },
  { id: 'b2', nome: 'Jeans chiari', brand: 'Weekday', tipo: 'pantaloni', pexels: 8217466, colore: 'Indaco chiaro', hex: '#8496AE', materiale: 'Denim leggero', stagione: 'primavera', vestibilita: 'Loose', lavaggio: '30°', confidenza: 90, giorni: 9 },
  { id: 'b3', nome: 'Pantalone cammello', brand: 'Massimo Dutti', tipo: 'pantaloni', pexels: 9558716, colore: 'Cammello', hex: '#A9805A', materiale: 'Cotone 98%, elastan 2%', stagione: 'mezza_stagione', vestibilita: 'Slim', lavaggio: '30°', confidenza: 86, giorni: 30 },
  { id: 'b4', nome: 'Gonna nera', brand: 'Zara', tipo: 'pantaloni', pexels: 19215446, colore: 'Nero', hex: '#232328', materiale: 'Misto lana', stagione: 'inverno', vestibilita: 'Midi', lavaggio: 'Lavasecco', confidenza: 79, giorni: 190 },
  { id: 's1', nome: 'Sneaker bianche', brand: 'Veja', tipo: 'scarpe', pexels: 2529148, colore: 'Bianco crema', hex: '#EDE7DB', materiale: 'Pelle riciclata', stagione: 'tutto_lanno', vestibilita: '43', lavaggio: 'Panno umido', confidenza: 97, giorni: 1 },
  { id: 's2', nome: 'Stivaletti neri', brand: 'Dr. Martens', tipo: 'scarpe', pexels: 1321875, colore: 'Nero', hex: '#1D1D20', materiale: 'Pelle', stagione: 'tutto_lanno', vestibilita: '43', lavaggio: 'Spazzola a secco', confidenza: 93, giorni: 8 },
  { id: 'o1', nome: 'Giacca di jeans', brand: "Levi's Trucker", tipo: 'capospalla', pexels: 7514171, colore: 'Indaco chiaro', hex: '#6B85A6', materiale: 'Denim rigido', stagione: 'primavera', vestibilita: 'Regular', lavaggio: 'Raramente', confidenza: 92, giorni: 12 },
  { id: 'o2', nome: 'Cardigan panna', brand: 'Mango', tipo: 'capospalla', pexels: 19136784, colore: 'Panna', hex: '#DED7C9', materiale: 'Lana e cotone', stagione: 'autunno', vestibilita: 'Oversize', lavaggio: 'A mano', confidenza: 84, giorni: 210 },
]

const DA_LAVARE = new Set(['t2', 'b2', 's2'])
const PREFERITI = new Set(['t1', 'b1'])

function capoDaSeme(seme: Seme): Capo {
  const adesso = oggi.toISOString()
  return {
    id: seme.id,
    nome: seme.nome,
    brand: seme.brand,
    tipo: seme.tipo,
    slot: slotDiTipo(seme.tipo),
    colore: { nome: seme.colore, hex: seme.hex },
    foto: { chiave: `semi/${seme.id}.jpg`, url: foto(seme.pexels) },
    materiale: seme.materiale,
    fantasia: 'Tinta unita',
    stagione: seme.stagione,
    vestibilita: seme.vestibilita,
    lavaggio: seme.lavaggio,
    stato: DA_LAVARE.has(seme.id) ? 'da_lavare' : 'pulito',
    preferito: PREFERITI.has(seme.id),
    ultimo_uso: giorniFa(seme.giorni),
    volte_indossato: Math.max(1, Math.floor(40 / Math.max(seme.giorni ?? 40, 1))),
    // Le confidenze del design: alcune volutamente basse, così si vede subito
    // com'è fatto un attributo incerto senza dover caricare una foto.
    analisi: {
      provider: 'anthropic',
      modello: 'claude-opus-5',
      eseguita_il: adesso,
      confidenze: {
        tipo: seme.confidenza,
        colore: Math.min(99, seme.confidenza + 3),
        materiale: seme.confidenza - 8,
        fantasia: seme.confidenza - 2,
        stagione: seme.confidenza - 11,
        vestibilita: seme.confidenza - 14,
        lavaggio: seme.confidenza - 5,
      },
      corretti_a_mano: [],
    },
    creato_il: adesso,
    aggiornato_il: adesso,
  }
}

export const CAPI_DEMO: Capo[] = SEMI.map(capoDaSeme)

export const PROFILO_DEMO: Profilo = {
  id: 'demo',
  nome: 'Youssef B.',
  citta: 'Milano',
  preferenze: {
    stili: ['comodo', 'classico'],
    palette: ['neutri', 'terra'],
    evita: ['fantasie vistose'],
  },
  foto_url: foto(9558587),
  creato_il: oggi.toISOString(),
}

export const OUTFIT_DEMO: Outfit[] = [
  {
    id: 'of1',
    nome: 'Riunione di lunedì',
    occasione: 'Ufficio',
    vestizione: { top: 't1', bottom: 'b1', shoes: 's1', outer: 'o1' },
    origine: 'manuale',
    volte_indossato: 4,
    ultimo_uso: giorniFa(12),
    creato_il: oggi.toISOString(),
  },
  {
    id: 'of2',
    nome: 'Aperitivo con Sara',
    occasione: 'Sera',
    vestizione: { top: 't4', bottom: 'b4', shoes: 's2', outer: 'o2' },
    origine: 'ia',
    volte_indossato: 2,
    ultimo_uso: giorniFa(21),
    creato_il: oggi.toISOString(),
  },
  {
    id: 'of3',
    nome: 'Sabato lento',
    occasione: 'Casa',
    vestizione: { top: 't2', bottom: 'b2', shoes: 's1' },
    origine: 'manuale',
    volte_indossato: 9,
    ultimo_uso: giorniFa(4),
    creato_il: oggi.toISOString(),
  },
]

/**
 * Le proposte che l'app mostra in modalità demo.
 *
 * Sono scritte, non generate: in demo non c'è nessun modello dietro, e fingere
 * che ci sia sarebbe disonesto verso chi prova l'app. Con l'API collegata
 * queste non vengono usate.
 */
export const SUGGERIMENTI_DEMO: Suggerimento[] = [
  {
    titolo: 'Comodo, ma tenuto',
    match: 94,
    vestizione: { top: 't1', bottom: 'b1', shoes: 's1', outer: 'o1' },
    perche: [
      'Alle 10 hai la riunione: la giacca di jeans tiene la stanza senza irrigidire.',
      '12° e pioggia leggera: cotone e denim, il lino lo lascio lì.',
      'Le sneaker bianche le hai messe ieri, ma con questi jeans restano la scelta giusta.',
    ],
  },
  {
    titolo: 'Chiaro e leggero',
    match: 88,
    vestizione: { top: 't3', bottom: 'b3', shoes: 's1' },
    perche: [
      'Se il pomeriggio si apre, il lino respira.',
      'Panna su cammello: uno dei tuoi accordi preferiti.',
      'Zero capi in lavatrice.',
    ],
  },
  {
    titolo: 'Fuori dai soliti',
    match: 79,
    vestizione: { top: 't4', bottom: 'b4', shoes: 's2', outer: 'o2' },
    perche: [
      'La gonna nera è ferma da sei mesi: recuperiamola.',
      'Contrasto più alto del solito, ma resta nella tua palette.',
      'Se esci dopo cena, il cardigan basta.',
    ],
  },
]

/**
 * Il catalogo mostrato in demo e come primo valore prima che il backend
 * risponda: gli stessi quattro provider registrati in `adapters/llm/`, senza
 * chiamare l'API. Condiviso fra il playground e «Modelli in uso» perché è lo
 * stesso catalogo, non due elenchi che possono disallinearsi.
 */
export const MODELLI_DEMO: ModelloDisponibile[] = [
  { provider: 'anthropic', id: 'claude-opus-5', accetta_temperatura: false, etichetta: 'Claude Opus 5', visione: true, note: 'il più accurato sui tessuti', costo_input_eur_mtok: 4.6, costo_output_eur_mtok: 23, configurato: false },
  { provider: 'anthropic', id: 'claude-sonnet-5', accetta_temperatura: false, etichetta: 'Claude Sonnet 5', visione: true, note: 'quasi come Opus, a un terzo del prezzo', costo_input_eur_mtok: 2.76, costo_output_eur_mtok: 13.8, configurato: false },
  { provider: 'anthropic', id: 'claude-haiku-4-5', etichetta: 'Claude Haiku 4.5', visione: true, note: 'per l\'analisi in blocco', costo_input_eur_mtok: 0.92, costo_output_eur_mtok: 4.6, configurato: false },
  { provider: 'openai', id: 'gpt-5.1', etichetta: 'gpt-5.1', visione: true, note: 'prezzi da verificare', configurato: false },
  { provider: 'google', id: 'gemini-2.5-pro', etichetta: 'gemini-2.5-pro', visione: true, note: 'contesto lungo', configurato: false },
  { provider: 'ollama', id: 'llava', etichetta: 'llava (locale)', visione: true, note: 'gratis, gira sulla tua macchina', costo_input_eur_mtok: 0, costo_output_eur_mtok: 0, configurato: true },
]
