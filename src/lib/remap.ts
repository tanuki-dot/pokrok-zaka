import type { DB } from './types'

/*
 * Ukázková data mají pevné identifikátory (např. „c-me1“). Na serveru je sdílí všichni
 * učitelé jedné databáze, proto každý dostane vlastní kopii s novými identifikátory.
 * Mění se jen řetězce, které přesně odpovídají některému z identifikátorů (i v odkazech
 * jako studentId, sources souhrnů apod.). Společný katalog (dovednosti, celky ŠVP) zůstává.
 */
export function remapIds(d: DB): DB {
  const tag = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
  const map = new Map<string, string>()
  const add = (id: string) => map.set(id, `${id}-${tag}`)
  d.schools.forEach((x) => add(x.id))
  d.classes.forEach((x) => add(x.id))
  d.students.forEach((x) => add(x.id))
  d.subjects.forEach((x) => add(x.id))
  d.criteria.filter((c) => c.subjectId).forEach((x) => add(x.id))
  d.assessments.forEach((a) => {
    add(a.id)
    a.goals.forEach((g) => add(g.id))
  })
  d.selfAssessments.forEach((x) => add(x.id))
  d.attachments.forEach((x) => add(x.id))
  d.goals.forEach((x) => add(x.id))
  d.summaries.forEach((s) => {
    add(s.id)
    s.sections.forEach((sec) => sec.sentences.forEach((v) => add(v.id)))
  })
  d.phrases.forEach((x) => add(x.id))

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return map.get(v) ?? v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  // Klíče objektu skóre jsou id dovedností – vlastní dovednosti je potřeba přejmenovat i tam.
  const out = walk(d) as DB
  out.assessments = out.assessments.map((a) => ({
    ...a,
    scores: Object.fromEntries(Object.entries(a.scores).map(([k, l]) => [map.get(k) ?? k, l])) as typeof a.scores,
    skillNotes: Object.fromEntries(Object.entries(a.skillNotes).map(([k, n]) => [map.get(k) ?? k, n])),
  }))
  return out
}
