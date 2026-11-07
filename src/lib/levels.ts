import type { Level } from './types'

/**
 * Škála zvládnutí dovednosti (pokrok_oprava.docx): 1 = nejnižší, 5 = nejvyšší.
 * Nevybraná dovednost = „Nehodnoceno“.
 */
export const LEVELS: { level: Level; name: string; desc: string }[] = [
  { level: 1, name: 'Zatím nezvládá', desc: 'Žák dovednost nezvládá ani s výraznou pomocí.' },
  { level: 2, name: 'Zvládá s výraznou pomocí', desc: 'Potřebuje časté vedení učitele.' },
  { level: 3, name: 'Zvládá s občasnou pomocí', desc: 'Základy zvládá, ale někdy potřebuje pomoc.' },
  { level: 4, name: 'Zvládá samostatně', desc: 'Pracuje správně a bez pomoci.' },
  { level: 5, name: 'Zvládá samostatně a jistě', desc: 'Dokáže učivo využít i v nových situacích.' },
]

export const NOT_RATED = 'Nehodnoceno'

export const levelLabel = (l?: number) => (l ? `${l} – ${LEVELS[l - 1].name}` : NOT_RATED)

/** Vyšší úroveň = lepší. Kladné číslo = zlepšení. */
export const levelDelta = (first: number, last: number) => last - first
