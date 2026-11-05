import type { Criterion, DB } from './types'

export const uid = (p = '') =>
  p + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 12)

/** Aktivní kritéria předmětu: výchozí oblasti (bez vypnutých) + vlastní kritéria předmětu. */
export function criteriaFor(d: DB, subjectId: string): Criterion[] {
  const subj = d.subjects.find((s) => s.id === subjectId)
  const hidden = new Set(subj?.hiddenDefaults ?? [])
  return [
    ...d.criteria.filter((c) => c.subjectId === null && !hidden.has(c.id)),
    ...d.criteria.filter((c) => c.subjectId === subjectId),
  ]
}

export const fullName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`
