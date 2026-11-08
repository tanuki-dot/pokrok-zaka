import type { Level } from './types'

/**
 * Pětibodová slovní škála (pokrokveskole.docx): 1 = nejlepší, 5 = nejnižší úroveň zvládnutí.
 * Stejný význam platí v historii, grafech i souhrnech. Nevybraná dovednost = „Nehodnoceno“
 * a do souhrnů ani průměrů se nezapočítává.
 */
export const LEVELS: { level: Level; name: string; desc: string }[] = [
  { level: 1, name: 'Výborně', desc: 'Žák zvládá učivo samostatně, jistě a dokáže ho využít i v nových situacích.' },
  { level: 2, name: 'Velmi dobře', desc: 'Žák zvládá učivo samostatně a správně.' },
  { level: 3, name: 'Částečně zvládá', desc: 'Žák zvládá základy, ale občas potřebuje pomoc.' },
  { level: 4, name: 'Potřebuje výraznou pomoc', desc: 'Žák potřebuje časté vedení a podporu učitele.' },
  { level: 5, name: 'Zatím nezvládá', desc: 'Žák učivo nezvládá ani s výraznou pomocí.' },
]

export const NOT_RATED = 'Nehodnoceno'

export const levelLabel = (l?: number) => (l ? `${l} – ${LEVELS[l - 1].name}` : NOT_RATED)

/** Zvládá samostatně (1–2) / potřebuje výraznou podporu (4–5). */
export const isStrong = (l: number) => l <= 2
export const isWeak = (l: number) => l >= 4

/** Kladné číslo = zlepšení (nižší číslo je lepší). */
export const gainOf = (first: number, last: number) => first - last
