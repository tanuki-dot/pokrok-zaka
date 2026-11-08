import type { PeriodType, TeacherQKey } from './types'
import { addDays, fmt, fmtShort, parseISO, toISO, weekStart } from './dates'

/*
 * Hodnocené období (pokrokveskole.docx, snímek 2) a dotazník učitele podle období (snímek 3 C).
 */

export const PERIOD_LABEL: Record<PeriodType, string> = {
  hodina: 'Hodina',
  tyden: 'Týden',
  mesic: 'Měsíc',
  pololeti: 'Pololetí',
  rok: 'Školní rok',
  vlastni: 'Vlastní období',
}

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']

/** Školní rok, do kterého datum patří (začíná 1. 9.). Vrací rok začátku. */
export const schoolYearOf = (iso: string) => {
  const d = parseISO(iso)
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
}
export const schoolYearLabel = (y: number) => `${y}/${y + 1}`

export interface PeriodSpec {
  type: PeriodType
  from: string
  to: string
}

/** Rozsah období podle typu a výchozího data. */
export function rangeFor(type: PeriodType, anchor: string, extra?: { half?: 1 | 2; year?: number; month?: number }): PeriodSpec {
  const d = parseISO(anchor)
  switch (type) {
    case 'hodina':
      return { type, from: anchor, to: anchor }
    case 'tyden': {
      const from = weekStart(anchor)
      return { type, from, to: addDays(from, 6) }
    }
    case 'mesic': {
      const y = extra?.year ?? d.getFullYear()
      const m = extra?.month ?? d.getMonth()
      return { type, from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) }
    }
    case 'pololeti': {
      const sy = extra?.year ?? schoolYearOf(anchor)
      const half = extra?.half ?? (d.getMonth() >= 8 || d.getMonth() === 0 ? 1 : 2)
      return half === 1 ? { type, from: `${sy}-09-01`, to: `${sy + 1}-01-31` } : { type, from: `${sy + 1}-02-01`, to: `${sy + 1}-06-30` }
    }
    case 'rok': {
      const sy = extra?.year ?? schoolYearOf(anchor)
      return { type, from: `${sy}-09-01`, to: `${sy + 1}-06-30` }
    }
    case 'vlastni':
      return { type, from: anchor, to: anchor }
  }
}

export function periodLabel(type: PeriodType, from: string, to: string): string {
  const f = parseISO(from)
  switch (type) {
    case 'hodina':
      return `hodina ${fmt(from)}`
    case 'tyden':
      return `týden ${fmtShort(from)}–${fmt(to)}`
    case 'mesic':
      return `${MONTHS[f.getMonth()]} ${f.getFullYear()}`
    case 'pololeti': {
      const sy = schoolYearOf(from)
      return `${f.getMonth() === 8 ? 1 : 2}. pololetí ${schoolYearLabel(sy)}`
    }
    case 'rok':
      return `školní rok ${schoolYearLabel(schoolYearOf(from))}`
    case 'vlastni':
      return `${fmt(from)} – ${fmt(to)}`
  }
}

/** Délka vlastního období → nejbližší typ (pro výběr otázek). */
export function effectiveType(type: PeriodType, from: string, to: string): Exclude<PeriodType, 'vlastni'> {
  if (type !== 'vlastni') return type
  const days = Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86400000) + 1
  if (days <= 1) return 'hodina'
  if (days <= 10) return 'tyden'
  if (days <= 45) return 'mesic'
  if (days <= 200) return 'pololeti'
  return 'rok'
}

// ─── Dotazník učitele podle období ───────────────────────────────────────────

export interface TeacherQuestion {
  key: TeacherQKey
  title: string
  multi: boolean
  presets: string[]
}

const PRESETS: Record<TeacherQKey, string[]> = {
  zvladnuti: [
    'Učivo zvládá výborně a dokáže ho použít.',
    'Učivo zvládá dobře, s drobnými nejistotami.',
    'Zvládá základy, potřebuje další procvičení.',
    'Učivo zatím nezvládá, potřebuje podporu.',
  ],
  samostatnost: [
    'Pracuje samostatně.',
    'Občas potřebuje pomoc.',
    'Potřebuje časté vedení.',
    'Samostatnost se zlepšuje.',
  ],
  povedlo: [
    'Pochopení nového učiva.',
    'Splnění zadaných úkolů.',
    'Samostatná práce.',
    'Spolupráce s ostatními.',
    'Vytrvalost při obtížích.',
    'Zlepšení oproti minulému období.',
  ],
  procvicit: [
    'Porozumění učivu.',
    'Praktické použití učiva.',
    'Přesnost a kontrola výsledků.',
    'Samostatnost.',
    'Soustředění.',
    'Organizace práce.',
    'Spolupráce.',
  ],
  dalsi: [
    'Procvičit učivo na dalších úlohách.',
    'Řešit úlohy samostatně bez nápovědy.',
    'Vysvětlit postup vlastními slovy.',
    'Dokončit práci v daném čase.',
    'Prohloubit znalosti v náročnějších úlohách.',
  ],
}

const TITLES: Record<Exclude<PeriodType, 'vlastni'>, Record<TeacherQKey, string>> = {
  hodina: {
    zvladnuti: 'Jak žák zvládl dnešní učivo?',
    samostatnost: 'Jak samostatně dnes pracoval?',
    povedlo: 'Co se žákovi během hodiny povedlo?',
    procvicit: 'Co potřebuje ještě procvičit?',
    dalsi: 'Jaký je další vzdělávací cíl?',
  },
  tyden: {
    zvladnuti: 'Jak žák zvládal učivo během týdne?',
    samostatnost: 'Jak se vyvíjela jeho samostatnost?',
    povedlo: 'V čem se tento týden zlepšil?',
    procvicit: 'Které oblasti potřebuje dále procvičovat?',
    dalsi: 'Na co se zaměřit v příštím týdnu?',
  },
  mesic: {
    zvladnuti: 'Jaké znalosti a dovednosti žák během měsíce získal?',
    samostatnost: 'Jak se vyvíjela jeho samostatnost a aktivita?',
    povedlo: 'Jakého pokroku dosáhl?',
    procvicit: 'Ve kterých oblastech potřebuje podporu?',
    dalsi: 'Jaké cíle stanovit pro další měsíc?',
  },
  pololeti: {
    zvladnuti: 'Jak žák zvládl učivo za pololetí?',
    samostatnost: 'Jak se rozvíjely jeho znalosti a dovednosti?',
    povedlo: 'V čem dosáhl největšího pokroku?',
    procvicit: 'Které oblasti potřebuje dále rozvíjet?',
    dalsi: 'Jaké vzdělávací cíle stanovit pro další pololetí?',
  },
  rok: {
    zvladnuti: 'Jaké znalosti a dovednosti žák během školního roku získal?',
    samostatnost: 'Jak se vyvíjela jeho samostatnost a přístup k práci?',
    povedlo: 'Jakého celkového pokroku dosáhl?',
    procvicit: 'Které oblasti potřebuje nadále rozvíjet?',
    dalsi: 'Jaká doporučení stanovit pro další školní rok?',
  },
}

/** Úprava časových formulací u vlastního období. */
const toCustom = (t: string) =>
  t
    .replace(/dnešní učivo/, 'učivo v tomto období')
    .replace(/dnes/, 'v tomto období')
    .replace(/během hodiny/, 'v tomto období')
    .replace(/během týdne|tento týden/, 'v tomto období')
    .replace(/během měsíce/, 'v tomto období')
    .replace(/za pololetí/, 'za toto období')
    .replace(/během školního roku/, 'v tomto období')
    .replace(/v příštím týdnu|pro další měsíc|pro další pololetí|pro další školní rok/, 'pro další období')

export const TEACHER_KEYS: TeacherQKey[] = ['zvladnuti', 'samostatnost', 'povedlo', 'procvicit', 'dalsi']
const MULTI: Record<TeacherQKey, boolean> = { zvladnuti: false, samostatnost: false, povedlo: true, procvicit: true, dalsi: true }

export function teacherQuestions(type: PeriodType, from: string, to: string): TeacherQuestion[] {
  const eff = effectiveType(type, from, to)
  return TEACHER_KEYS.map((key) => ({
    key,
    title: type === 'vlastni' ? toCustom(TITLES[eff][key]) : TITLES[eff][key],
    multi: MULTI[key],
    presets: PRESETS[key].filter((p) => !(eff === 'hodina' && p.includes('se zlepšuje')) && !(eff === 'hodina' && p.includes('minulému'))),
  }))
}
