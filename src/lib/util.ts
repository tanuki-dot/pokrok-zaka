import type { Criterion, DB } from './types'

export const uid = (p = '') =>
  p + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 12)

/** Dovednosti nabízené pro předmět: společné (bez vypnutých a starších) + vlastní dovednosti předmětu. */
export function criteriaFor(d: DB, subjectId: string): Criterion[] {
  const subj = d.subjects.find((s) => s.id === subjectId)
  const hidden = new Set(subj?.hiddenDefaults ?? [])
  return [
    ...d.criteria.filter((c) => c.subjectId == null && !c.archived && !hidden.has(c.id)),
    ...d.criteria.filter((c) => c.subjectId === subjectId && !c.archived),
  ]
}

/** Všechny dovednosti, které se u předmětu mohou objevit v historii (včetně starších). */
export function allCriteriaFor(d: DB, subjectId: string): Criterion[] {
  const active = criteriaFor(d, subjectId)
  return [...active, ...d.criteria.filter((c) => (c.subjectId == null || c.subjectId === subjectId) && !active.some((x) => x.id === c.id))]
}

export const fullName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`
