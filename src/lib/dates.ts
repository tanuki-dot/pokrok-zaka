import type { SummaryKind } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toISO(new Date())

export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Pondělí týdne, do kterého datum patří. */
export const weekStart = (iso: string) => {
  const d = parseISO(iso)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toISO(d)
}

export interface Period {
  from: string
  to: string
  label: string
}

const MONTHS = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
]

export const fmt = (iso: string) => {
  const d = parseISO(iso)
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}
export const fmtShort = (iso: string) => {
  const d = parseISO(iso)
  return `${d.getDate()}. ${d.getMonth() + 1}.`
}

export function periodFor(kind: SummaryKind, anchor: string): Period {
  const d = parseISO(anchor)
  if (kind === 'tyden') {
    const from = weekStart(anchor)
    const to = addDays(from, 6)
    return { from, to, label: `týden ${fmtShort(from)}–${fmt(to)}` }
  }
  if (kind === 'mesic') {
    const from = toISO(new Date(d.getFullYear(), d.getMonth(), 1))
    const to = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    return { from, to, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
  }
  if (kind === 'rok') {
    const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
    return { from: `${y}-09-01`, to: `${y + 1}-06-30`, label: `školní rok ${y}/${y + 1}` }
  }
  if (kind === 'vlastni') return { from: anchor, to: anchor, label: fmt(anchor) }
  // Pololetí: 1. pololetí 1. 9. – 31. 1., 2. pololetí 1. 2. – 30. 6.
  const m = d.getMonth()
  if (m >= 8 || m === 0) {
    const y = m === 0 ? d.getFullYear() - 1 : d.getFullYear()
    return { from: `${y}-09-01`, to: `${y + 1}-01-31`, label: `1. pololetí ${y}/${y + 1}` }
  }
  const y = d.getFullYear()
  return { from: `${y}-02-01`, to: `${y}-06-30`, label: `2. pololetí ${y - 1}/${y}` }
}

export const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to

export const KIND_LABEL: Record<SummaryKind, string> = {
  tyden: 'Týdenní',
  mesic: 'Měsíční',
  pololeti: 'Pololetní',
  rok: 'Roční',
  vlastni: 'Za vlastní období',
}

export const weekLabel = (iso: string) => `${fmtShort(weekStart(iso))}`

export const relative = (isoDateTime: string) => {
  const diff = Date.now() - new Date(isoDateTime).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `před ${h} h`
  const days = Math.round(h / 24)
  if (days === 1) return 'včera'
  if (days < 5) return `před ${days} dny`
  return fmt(isoDateTime.slice(0, 10))
}
