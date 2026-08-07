/**
 * GENERATO — non modificare a mano.
 *
 * Fonte di verità: services/api/src/domain/models.py
 * Rigenera con: npm run contracts:generate
 */

// Le soglie vivono nel dominio, in Python. Arrivano qui generate perché
// l'app deve sapere sotto quale confidenza un attributo va mostrato come
// incerto, e due numeri scritti a mano in due linguaggi divergono sempre.
export const SOGLIA_INCERTEZZA = 86 as const
export const SOGLIA_SCARTO = 60 as const
export const MESI_PER_DORMIENTE = 6 as const

// I valori delle enum, in ordine, per costruire filtri e selettori.
export const VALORI_TIPO_CAPO = ['top', 'pantaloni', 'scarpe', 'capospalla', 'abito', 'accessorio'] as const
export const VALORI_SLOT_AVATAR = ['top', 'bottom', 'outer', 'shoes', 'dress'] as const
export const VALORI_STAGIONE = ['primavera', 'estate', 'autunno', 'inverno', 'mezza_stagione', 'tutto_lanno'] as const
export const VALORI_STATO_CAPO = ['pulito', 'da_lavare', 'in_lavaggio'] as const
export const VALORI_ATTRIBUTO_CAPO = ['tipo', 'colore', 'materiale', 'fantasia', 'stagione', 'vestibilita', 'lavaggio'] as const
export const VALORI_ORIGINE_OUTFIT = ['manuale', 'ia', 'suggerito_modificato'] as const
export const VALORI_JOB_IA = ['analisi_capo', 'suggerimento'] as const
export const VALORI_ESITO_ESECUZIONE = ['ok', 'vago', 'errore'] as const
export const VALORI_STATO_ANALISI = ['in_corso', 'completata', 'fallita'] as const
export const VALORI_RUOLO_CHAT = ['utente', 'wardrobe'] as const
export const VALORI_ESITO_ATTRIBUTO = ['esatto', 'vicino', 'sbagliato', 'mancante', 'inventato', 'non_valutato'] as const
