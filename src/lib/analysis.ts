import type {
  Assessment, Criterion, DB, Level, SummaryKind, SummarySection, SummarySentence, Swot,
} from './types'
import { criteriaFor, uid } from './util'
import { fmtShort, inRange, weekStart } from './dates'

/*
 * Vše tady je deterministické: souhrny a návrhy SWOT se skládají jen z uložených
 * záznamů (úrovně, zpětná vazba, cíle, sebehodnocení). Každá věta nese ID záznamů,
 * ze kterých vznikla. Nic se nedomýšlí – zejména ne osobní okolnosti žáka.
 * Věty jsou formulované genderově neutrálně, aby šly použít pro každého žáka.
 */

export const LEVELS: { level: Level; text: string; short: string }[] = [
  { level: 1, text: 'Zvládá samostatně a umí vysvětlit.', short: 'samostatně' },
  { level: 2, text: 'Zvládá s drobnou pomocí.', short: 's drobnou pomocí' },
  { level: 3, text: 'Zvládá základní postup s pomocí.', short: 'základ s pomocí' },
  { level: 4, text: 'Potřebuje výraznou pomoc.', short: 'výrazná pomoc' },
  { level: 5, text: 'Zatím nezvládá, potřebuje další podporu.', short: 'zatím nezvládá' },
]

export const studentAssessments = (d: DB, studentId: string, subjectId?: string) =>
  d.assessments
    .filter((a) => a.studentId === studentId && (!subjectId || a.subjectId === subjectId))
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))

export interface Point {
  date: string
  level: Level
  assessmentId: string
}

export function criterionSeries(list: Assessment[], criterionId: string): Point[] {
  return list
    .filter((a) => a.scores[criterionId])
    .map((a) => ({ date: a.date, level: a.scores[criterionId], assessmentId: a.id }))
}

/** Poslední úroveň v každém týdnu – pro graf a měsíční vývoj. */
export function weeklyLevels(points: Point[]) {
  const byWeek = new Map<string, Point>()
  for (const p of points) byWeek.set(weekStart(p.date), p)
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, p]) => ({ week, ...p }))
}

export function trendWord(first: number, last: number) {
  if (last < first) return 'zlepšení'
  if (last > first) return 'potřebuje víc podpory'
  return 'beze změny'
}

const sentence = (text: string, sources: string[]): SummarySentence => ({
  id: uid('v'),
  text,
  sources: [...new Set(sources)],
})

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.!]?$/, '.')
const list = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} a ${xs[xs.length - 1]}`

/** Opakované texty zpětné vazby sloučí do jedné věty s více zdroji. */
function collectTexts(as: Assessment[], pick: (a: Assessment) => string, max: number) {
  const map = new Map<string, string[]>()
  for (const a of as) {
    const t = pick(a).trim()
    if (!t) continue
    const key = t.toLowerCase()
    map.set(key, [...(map.get(key) ?? []), a.id])
  }
  const items = [...map.entries()].map(([, ids]) => {
    const first = as.find((a) => a.id === ids[0])!
    return { text: clean(pick(first)), ids, last: Math.max(...ids.map((id) => as.findIndex((a) => a.id === id))) }
  })
  // Nejnovější první, pak omezit počet.
  return items.sort((a, b) => b.last - a.last).slice(0, max)
}

interface CritStat {
  c: Criterion
  points: Point[]
  first: Point
  last: Point
}

function stats(list: Assessment[], criteria: Criterion[]): CritStat[] {
  return criteria
    .map((c) => {
      const points = criterionSeries(list, c.id)
      return points.length ? { c, points, first: points[0], last: points[points.length - 1] } : null
    })
    .filter((x): x is CritStat => x !== null)
}

export function generateSummary(
  d: DB,
  studentId: string,
  subjectId: string,
  kind: SummaryKind,
  from: string,
  to: string,
): SummarySection[] {
  const all = studentAssessments(d, studentId, subjectId)
  const inP = all.filter((a) => inRange(a.date, from, to))
  const before = all.filter((a) => a.date < from)
  const criteria = criteriaFor(d, subjectId)
  const st = stats(inP, criteria)
  const goals = d.goals.filter(
    (g) => g.studentId === studentId && g.subjectId === subjectId && inRange(g.setOn, from, to),
  )
  const selfs = d.selfAssessments.filter((s) => inP.some((a) => a.id === s.assessmentId))

  if (inP.length === 0) {
    return [
      {
        key: 'prazdne',
        title: 'Bez záznamů',
        sentences: [sentence('V tomto období nejsou uložené žádné záznamy hodnocení.', [])],
      },
    ]
  }

  const sections: SummarySection[] = []
  const push = (key: string, title: string, sentences: SummarySentence[]) => {
    if (sentences.length) sections.push({ key, title, sentences })
  }

  const mastered = st.filter((s) => s.last.level <= 2)
  const needSupport = st.filter((s) => s.last.level >= 4)

  if (kind === 'tyden') {
    // KROK 7: co zvládl, ve kterých dovednostech se zlepšil, co potřebuje procvičit.
    const good = collectTexts(inP, (a) => a.feedback.good, 4).map((x) => sentence(x.text, x.ids))
    if (mastered.length)
      good.push(
        sentence(
          `Samostatně nebo s drobnou pomocí zvládá: ${list(mastered.map((s) => s.c.name.toLowerCase()))}.`,
          mastered.map((s) => s.last.assessmentId),
        ),
      )
    push('zvladl', 'Co se v týdnu povedlo', good)

    const moves: SummarySentence[] = []
    for (const s of st) {
      const prev = criterionSeries(before, s.c.id).at(-1)
      if (prev && s.last.level < prev.level)
        moves.push(
          sentence(`${s.c.name}: posun z úrovně ${prev.level} na ${s.last.level}.`, [prev.assessmentId, s.last.assessmentId]),
        )
    }
    if (!moves.length && st.some((s) => criterionSeries(before, s.c.id).length))
      moves.push(sentence('Oproti předchozím záznamům zůstávají úrovně beze změny.', inP.map((a) => a.id)))
    push('posun', 'V čem nastal posun', moves)

    const todo = collectTexts(inP, (a) => a.feedback.todo, 3).map((x) => sentence(x.text, x.ids))
    if (needSupport.length)
      todo.push(
        sentence(
          `Výraznou podporu zatím potřebuje v oblasti: ${list(needSupport.map((s) => s.c.name.toLowerCase()))}.`,
          needSupport.map((s) => s.last.assessmentId),
        ),
      )
    push('procvicit', 'Co je potřeba procvičit', todo)

    const next = collectTexts(inP, (a) => a.feedback.next || a.nextGoal, 2).map((x) => sentence(x.text, x.ids))
    push('pristi', 'Co udělat příště', next)
  }

  if (kind === 'mesic') {
    // KROK 8: spojí týdenní záznamy, ukáže změny za měsíc a plnění cílů.
    push(
      'vyvoj',
      'Vývoj dovedností po týdnech',
      st.map((s) => {
        const w = weeklyLevels(s.points)
        const seq = w.map((p) => p.level).join(' → ')
        const word = w.length > 1 ? ` (${trendWord(w[0].level, w[w.length - 1].level)})` : ''
        return sentence(`${s.c.name}: ${seq}${word}.`, s.points.map((p) => p.assessmentId))
      }),
    )

    const changes: SummarySentence[] = []
    const improved = st
      .filter((s) => s.last.level < s.first.level)
      .sort((a, b) => b.first.level - b.last.level - (a.first.level - a.last.level))
    if (improved.length) {
      const top = improved[0]
      changes.push(
        sentence(
          `Největší posun: ${top.c.name.toLowerCase()} (z úrovně ${top.first.level} na ${top.last.level}).`,
          [top.first.assessmentId, top.last.assessmentId],
        ),
      )
    }
    for (const s of st.filter((x) => x.last.level > x.first.level))
      changes.push(
        sentence(
          `${s.c.name}: na konci měsíce úroveň ${s.last.level} oproti ${s.first.level} na začátku – vyplatí se sledovat.`,
          [s.first.assessmentId, s.last.assessmentId],
        ),
      )
    if (!changes.length)
      changes.push(sentence('Úrovně dovedností jsou během měsíce stabilní.', inP.map((a) => a.id)))
    push('zmeny', 'Hlavní změny', changes)

    const g: SummarySentence[] = []
    if (goals.length) {
      const done = goals.filter((x) => x.status === 'splneny')
      g.push(sentence(`Stanovené cíle: ${goals.length}, z toho splněno ${done.length}.`, goals.map((x) => x.id)))
      for (const x of goals.slice(-4))
        g.push(
          sentence(
            `${x.status === 'splneny' ? 'Splněno' : x.status === 'nesplneny' ? 'Zatím nesplněno' : 'Rozpracováno'}: ${clean(x.text)}`,
            [x.id],
          ),
        )
    } else g.push(sentence('V tomto měsíci nebyl stanoven žádný cíl.', []))
    push('cile', 'Plnění cílů', g)

    push(
      'dalsi',
      'Doporučení na další období',
      collectTexts(inP, (a) => a.feedback.next, 2).map((x) => sentence(x.text, x.ids)),
    )
  }

  if (kind === 'pololeti') {
    // KROK 9: co se naučil, v čem se nejvíc zlepšil, co zvládá samostatně,
    // kde potřebuje podporu, jaké cíle do dalšího pololetí.
    const learned: SummarySentence[] = []
    const topics = [...new Set(inP.map((a) => a.topic.trim()).filter(Boolean))]
    if (topics.length)
      learned.push(sentence(`Probraná témata: ${list(topics.slice(0, 8))}.`, inP.filter((a) => a.topic).map((a) => a.id)))
    const doneGoals = goals.filter((x) => x.status === 'splneny')
    for (const x of doneGoals.slice(-3)) learned.push(sentence(`Splněný cíl: ${clean(x.text)}`, [x.id]))
    push('naucil', 'Co se během pololetí naučil/a', learned)

    const improved = st
      .filter((s) => s.last.level < s.first.level)
      .sort((a, b) => b.first.level - b.last.level - (a.first.level - a.last.level))
      .slice(0, 3)
    push(
      'zlepseni',
      'V čem se nejvíce zlepšil/a',
      improved.length
        ? improved.map((s) =>
            sentence(
              `${s.c.name}: z úrovně ${s.first.level} (${fmtShort(s.first.date)}) na ${s.last.level} (${fmtShort(s.last.date)}).`,
              [s.first.assessmentId, s.last.assessmentId],
            ),
          )
        : [sentence('Za pololetí se úrovně dovedností výrazně nezměnily.', inP.map((a) => a.id))],
    )

    const indep: SummarySentence[] = mastered.map((s) =>
      sentence(`${s.c.name}: ${LEVELS[s.last.level - 1].text.toLowerCase()}`, [s.last.assessmentId]),
    )
    indep.push(...collectTexts(inP.slice(-6), (a) => a.feedback.good, 2).map((x) => sentence(x.text, x.ids)))
    push('samostatne', 'Co zvládá samostatně', indep)

    const support: SummarySentence[] = st
      .filter((s) => s.last.level >= 3)
      .map((s) => sentence(`${s.c.name}: ${LEVELS[s.last.level - 1].text.toLowerCase()}`, [s.last.assessmentId]))
    support.push(...collectTexts(inP.slice(-6), (a) => a.feedback.todo, 2).map((x) => sentence(x.text, x.ids)))
    const help = selfs.filter((s) => s.needHelp.trim()).slice(-2)
    for (const h of help) support.push(sentence(`Žák sám uvedl, že potřebuje pomoc: ${clean(h.needHelp)}`, [h.id]))
    push('podpora', 'Kde stále potřebuje podporu', support)

    const nextGoals: SummarySentence[] = goals
      .filter((x) => x.status !== 'splneny')
      .slice(-3)
      .map((x) => sentence(`Pokračovat v cíli: ${clean(x.text)}`, [x.id]))
    nextGoals.push(...collectTexts(inP.slice(-4), (a) => a.feedback.next, 2).map((x) => sentence(x.text, x.ids)))
    const wants = selfs.filter((s) => s.nextWant.trim()).slice(-1)
    for (const w of wants) nextGoals.push(sentence(`Přání žáka: ${clean(w.nextWant)}`, [w.id]))
    push('cile', 'Cíle do dalšího pololetí', nextGoals)
  }

  if (kind !== 'pololeti' && selfs.length) {
    const last = selfs[selfs.length - 1]
    const s: SummarySentence[] = []
    if (last.wentWell.trim()) s.push(sentence(`Podle žáka se povedlo: ${clean(last.wentWell)}`, [last.id]))
    if (last.needHelp.trim()) s.push(sentence(`Podle žáka potřebuje pomoc: ${clean(last.needHelp)}`, [last.id]))
    push('sebehodnoceni', 'Pohled žáka (sebehodnocení)', s)
  }

  return sections
}

/** Návrh SWOT z aktuálního formuláře a předchozích záznamů. Překážky (T) nikdy nedomýšlí. */
export function proposeSwot(
  d: DB,
  draft: Pick<Assessment, 'studentId' | 'subjectId' | 'scores' | 'feedback' | 'date' | 'id'>,
): Swot {
  const criteria = criteriaFor(d, draft.subjectId)
  const name = (id: string) => criteria.find((c) => c.id === id)?.name.toLowerCase() ?? ''
  const entries = Object.entries(draft.scores) as [string, Level][]
  const strong = entries.filter(([, l]) => l <= 2).map(([id]) => name(id)).filter(Boolean)
  const weak = entries.filter(([, l]) => l >= 4).map(([id]) => name(id)).filter(Boolean)

  const prev = studentAssessments(d, draft.studentId, draft.subjectId).filter(
    (a) => a.id !== draft.id && a.date <= draft.date,
  )
  const improved = entries
    .filter(([id, l]) => {
      const p = criterionSeries(prev, id).at(-1)
      return p && l < p.level
    })
    .map(([id]) => name(id))

  const s = [strong.length ? `Zvládá dobře: ${list(strong)}.` : '', draft.feedback.good ? clean(draft.feedback.good) : '']
  const w = [weak.length ? `Potřebuje procvičit: ${list(weak)}.` : '', draft.feedback.todo ? clean(draft.feedback.todo) : '']
  const o = [
    draft.feedback.next ? `Další krok: ${clean(draft.feedback.next)}` : '',
    improved.length ? `Navázat na posun v oblasti: ${list(improved)}.` : '',
  ]
  return {
    s: s.filter(Boolean).join(' '),
    w: w.filter(Boolean).join(' '),
    o: o.filter(Boolean).join(' '),
    t: '',
    proposed: true,
  }
}

export const levelColor = (l: number) => `var(--color-lv${l})`
