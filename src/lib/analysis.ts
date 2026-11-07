import type {
  Assessment, Criterion, DB, Level, LessonGoalStatus, SelfAnswers, SelfAssessment, SummaryKind, SummarySection, SummarySentence, Swot,
} from './types'
import { criteriaFor, uid } from './util'
import { fmtShort, inRange, weekStart } from './dates'
import { LEVELS } from './levels'
import { describe, IMPROVE_NOTHING, IMPROVE_NOUN, teacherBand, WENT_WELL_NOUN } from './questionnaire'

export { LEVELS } from './levels'

/*
 * Vše tady je deterministické: souhrny, SWOT, formativní hodnocení a doporučení se skládají
 * jen z uložených záznamů (úrovně, slovní zpětná vazba, splnění cíle, sebehodnocení žáka).
 * Každá věta souhrnu nese ID záznamů, ze kterých vznikla. Nic se nedomýšlí – zejména ne
 * osobní okolnosti žáka. Věty jsou formulované genderově neutrálně.
 *
 * Škála: 1 = nejnižší, 5 = nejvyšší zvládnutí. Vyšší číslo = lepší.
 */

export const STRONG = 4 // od této úrovně: zvládá samostatně
export const WEAK = 2 // do této úrovně: potřebuje výraznou pomoc nebo zatím nezvládá

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
  if (last > first) return 'zlepšení'
  if (last < first) return 'potřebuje víc podpory'
  return 'beze změny'
}

export const GOAL_STATUS_LABEL: Record<LessonGoalStatus, string> = {
  splneno: 'Splněno',
  castecne: 'Částečně splněno',
  nesplneno: 'Nesplněno',
}

const sentence = (text: string, sources: string[]): SummarySentence => ({
  id: uid('v'),
  text,
  sources: [...new Set(sources)],
})

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.!]?$/, '.')
export const list = (xs: string[]) =>
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

const gain = (s: CritStat) => s.last.level - s.first.level

/** Věty o splnění vzdělávacích cílů hodin v období. */
function lessonGoalSentences(inP: Assessment[]): SummarySentence[] {
  const marked = inP.filter((a) => a.goalStatus)
  if (!marked.length) return []
  const count = (s: LessonGoalStatus) => marked.filter((a) => a.goalStatus === s).length
  const parts = [
    count('splneno') && `splněno ${count('splneno')}×`,
    count('castecne') && `částečně ${count('castecne')}×`,
    count('nesplneno') && `nesplněno ${count('nesplneno')}×`,
  ].filter(Boolean) as string[]
  return [sentence(`Vzdělávací cíl hodiny: ${list(parts)}.`, marked.map((a) => a.id))]
}

/** Věty z pohledu žáka (sebehodnocení) – nový dotazník i starší volné odpovědi. */
function selfSentences(selfs: SelfAssessment[], max = 2): SummarySentence[] {
  const out: SummarySentence[] = []
  const fresh = selfs.filter((s) => s.answers)
  const last = fresh.at(-1)
  if (last?.answers) {
    const a = last.answers
    const well = a.wentWell.map((v) => WENT_WELL_NOUN[v]).filter(Boolean)
    if (well.length) out.push(sentence(`Podle sebehodnocení se žákovi daří: ${list(well)}.`, [last.id]))
    const imp = a.improve.filter((v) => v !== IMPROVE_NOTHING).map((v) => IMPROVE_NOUN[v]).filter(Boolean)
    if (imp.length) out.push(sentence(`Sám/sama by chtěl/a: ${list(imp)}.`, [last.id]))
    else if (a.improve.includes(IMPROVE_NOTHING)) out.push(sentence('Podle sebehodnocení žák dnešní cíl zvládl.', [last.id]))
  }
  if (fresh.length >= 2) {
    const u = fresh.map((s) => s.answers!.understanding)
    const word = u.at(-1)! > u[0] ? 'roste' : u.at(-1)! < u[0] ? 'klesá' : 'je stálé'
    out.push(sentence(`Porozumění učivu podle žáka ${word} (subjektivní hodnocení žáka).`, fresh.map((s) => s.id)))
  }
  const legacy = selfs.filter((s) => !s.answers).at(-1)
  if (!out.length && legacy) {
    if (legacy.wentWell?.trim()) out.push(sentence(`Podle žáka se povedlo: ${clean(legacy.wentWell)}`, [legacy.id]))
    if (legacy.needHelp?.trim()) out.push(sentence(`Podle žáka potřebuje pomoc: ${clean(legacy.needHelp)}`, [legacy.id]))
  }
  return out.slice(0, max + 1)
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
  const selfs = d.selfAssessments
    .filter((s) => inP.some((a) => a.id === s.assessmentId))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

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

  const mastered = st.filter((s) => s.last.level >= STRONG)
  const needSupport = st.filter((s) => s.last.level <= WEAK)

  if (kind === 'tyden') {
    // Co zvládl, ve kterých dovednostech se zlepšil, co potřebuje procvičit.
    const good = collectTexts(inP, (a) => a.feedback.good, 4).map((x) => sentence(x.text, x.ids))
    if (mastered.length)
      good.push(
        sentence(
          `Samostatně zvládá: ${list(mastered.map((s) => s.c.name.toLowerCase()))}.`,
          mastered.map((s) => s.last.assessmentId),
        ),
      )
    good.push(...lessonGoalSentences(inP))
    push('zvladl', 'Co se v týdnu povedlo', good)

    const moves: SummarySentence[] = []
    for (const s of st) {
      const prev = criterionSeries(before, s.c.id).at(-1)
      if (prev && s.last.level > prev.level)
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
    // Spojí týdenní záznamy, ukáže změny za měsíc a plnění cílů.
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
    const improved = st.filter((s) => gain(s) > 0).sort((a, b) => gain(b) - gain(a))
    if (improved.length) {
      const top = improved[0]
      changes.push(
        sentence(
          `Největší posun: ${top.c.name.toLowerCase()} (z úrovně ${top.first.level} na ${top.last.level}).`,
          [top.first.assessmentId, top.last.assessmentId],
        ),
      )
    }
    for (const s of st.filter((x) => gain(x) < 0))
      changes.push(
        sentence(
          `${s.c.name}: na konci měsíce úroveň ${s.last.level} oproti ${s.first.level} na začátku – vyplatí se sledovat.`,
          [s.first.assessmentId, s.last.assessmentId],
        ),
      )
    if (!changes.length)
      changes.push(sentence('Úrovně dovedností jsou během měsíce stabilní.', inP.map((a) => a.id)))
    push('zmeny', 'Hlavní změny', changes)

    const g: SummarySentence[] = [...lessonGoalSentences(inP)]
    if (goals.length) {
      const done = goals.filter((x) => x.status === 'splneny')
      g.push(sentence(`Stanovené další cíle: ${goals.length}, z toho splněno ${done.length}.`, goals.map((x) => x.id)))
      for (const x of goals.slice(-4))
        g.push(
          sentence(
            `${x.status === 'splneny' ? 'Splněno' : x.status === 'nesplneny' ? 'Zatím nesplněno' : 'Rozpracováno'}: ${clean(x.text)}`,
            [x.id],
          ),
        )
    } else if (!g.length) g.push(sentence('V tomto měsíci nebyl stanoven žádný cíl.', []))
    push('cile', 'Plnění cílů', g)

    push(
      'dalsi',
      'Doporučení na další období',
      collectTexts(inP, (a) => a.feedback.next || a.swot.rec || '', 2).map((x) => sentence(x.text, x.ids)),
    )
  }

  if (kind === 'pololeti') {
    // Co se naučil, v čem se nejvíc zlepšil, co zvládá samostatně, kde potřebuje podporu,
    // jaké cíle do dalšího pololetí.
    const learned: SummarySentence[] = []
    const topics = [...new Set(inP.map((a) => a.topic.trim()).filter(Boolean))]
    if (topics.length)
      learned.push(sentence(`Probraná témata: ${list(topics.slice(0, 8))}.`, inP.filter((a) => a.topic).map((a) => a.id)))
    learned.push(...lessonGoalSentences(inP))
    const doneGoals = goals.filter((x) => x.status === 'splneny')
    for (const x of doneGoals.slice(-3)) learned.push(sentence(`Splněný cíl: ${clean(x.text)}`, [x.id]))
    push('naucil', 'Co se během pololetí naučil/a', learned)

    const improved = st.filter((s) => gain(s) > 0).sort((a, b) => gain(b) - gain(a)).slice(0, 3)
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
      sentence(`${s.c.name}: ${LEVELS[s.last.level - 1].name.toLowerCase()}.`, [s.last.assessmentId]),
    )
    indep.push(...collectTexts(inP.slice(-6), (a) => a.feedback.good, 2).map((x) => sentence(x.text, x.ids)))
    push('samostatne', 'Co zvládá samostatně', indep)

    const support: SummarySentence[] = st
      .filter((s) => s.last.level <= 3)
      .map((s) => sentence(`${s.c.name}: ${LEVELS[s.last.level - 1].name.toLowerCase()}.`, [s.last.assessmentId]))
    support.push(...collectTexts(inP.slice(-6), (a) => a.feedback.todo, 2).map((x) => sentence(x.text, x.ids)))
    const lastFresh = selfs.filter((s) => s.answers).at(-1)
    const imp = lastFresh?.answers?.improve.filter((v) => v !== IMPROVE_NOTHING).map((v) => IMPROVE_NOUN[v]).filter(Boolean) ?? []
    if (lastFresh && imp.length) support.push(sentence(`Žák sám uvedl, že by chtěl/a ${list(imp)}.`, [lastFresh.id]))
    const legacyHelp = selfs.filter((s) => !s.answers && s.needHelp?.trim()).slice(-1)
    for (const h of legacyHelp) support.push(sentence(`Žák sám uvedl, že potřebuje pomoc: ${clean(h.needHelp!)}`, [h.id]))
    push('podpora', 'Kde stále potřebuje podporu', support)

    const nextGoals: SummarySentence[] = goals
      .filter((x) => x.status !== 'splneny')
      .slice(-3)
      .map((x) => sentence(`Pokračovat v cíli: ${clean(x.text)}`, [x.id]))
    nextGoals.push(...collectTexts(inP.slice(-4), (a) => a.feedback.next, 2).map((x) => sentence(x.text, x.ids)))
    const wish = selfs.filter((s) => s.answers?.nextWish.trim()).at(-1)
    if (wish) nextGoals.push(sentence(`Přání žáka: ${clean(wish.answers!.nextWish)}`, [wish.id]))
    const legacyWish = !wish ? selfs.filter((s) => s.nextWant?.trim()).at(-1) : undefined
    if (legacyWish) nextGoals.push(sentence(`Přání žáka: ${clean(legacyWish.nextWant!)}`, [legacyWish.id]))
    push('cile', 'Cíle do dalšího pololetí', nextGoals)
  }

  if (kind !== 'pololeti') push('sebehodnoceni', 'Pohled žáka (sebehodnocení)', selfSentences(selfs))

  return sections
}

// ─── SWOT, formativní hodnocení a doporučení ─────────────────────────────────

/** Konkrétní doporučení podle slabší dovednosti (výchozí oblasti). */
const REC_BY_CRITERION: Record<string, string> = {
  'k-znalosti': 'Zopakovat klíčové pojmy na krátkých úlohách a ověřit porozumění otázkou „proč?“.',
  'k-dovednosti': 'Procvičit postup na 2–3 podobných úlohách s postupně menší nápovědou.',
  'k-samostatnost': 'Zadávat kratší samostatné úkoly a nápovědu postupně ubírat.',
  'k-spoluprace': 'Zařadit práci ve dvojici s jasně rozdělenými rolemi.',
  'k-ukoly': 'Rozdělit zadání na menší kroky s průběžnou kontrolou.',
  'k-pokrok': 'Pravidelně se žákem projít, co se od minula zlepšilo.',
  'k-sebehodnoceni': 'Na konci hodiny společně porovnat sebehodnocení s hodnocením učitele.',
}
const REC_BY_IMPROVE: Record<string, string> = {
  porozumet: 'Vysvětlit učivo jiným způsobem (příklad, obrázek) a ověřit porozumění.',
  procvicovat: 'Nabídnout procvičovací úlohy navíc.',
  samostatneji: REC_BY_CRITERION['k-samostatnost'],
  soustredit: 'Rozdělit práci na kratší úseky s jasným cílem.',
  spolupracovat: REC_BY_CRITERION['k-spoluprace'],
}

type DraftLike = Pick<Assessment, 'studentId' | 'subjectId' | 'scores' | 'feedback' | 'date' | 'id' | 'goalStatus'>

interface Ctx {
  name: (id: string) => string
  entries: [string, Level][]
  strong: string[]
  mid: string[]
  weak: [string, Level][]
  prev: Assessment[]
  answers?: SelfAnswers
}

function context(d: DB, draft: DraftLike, self?: SelfAssessment): Ctx {
  const criteria = criteriaFor(d, draft.subjectId)
  const name = (id: string) => criteria.find((c) => c.id === id)?.name.toLowerCase() ?? ''
  const entries = Object.entries(draft.scores) as [string, Level][]
  return {
    name,
    entries,
    strong: entries.filter(([, l]) => l >= STRONG).map(([id]) => name(id)).filter(Boolean),
    mid: entries.filter(([, l]) => l === 3).map(([id]) => name(id)).filter(Boolean),
    weak: entries.filter(([, l]) => l <= WEAK),
    prev: studentAssessments(d, draft.studentId, draft.subjectId).filter((a) => a.id !== draft.id && a.date <= draft.date),
    answers: self?.answers,
  }
}

/** Doporučení pro další rozvoj žáka (max. 4, bez opakování). */
export function recommendations(d: DB, draft: DraftLike, self?: SelfAssessment): string[] {
  const c = context(d, draft, self)
  const criteria = criteriaFor(d, draft.subjectId)
  const recs: string[] = []
  const sorted = [...c.weak, ...c.entries.filter(([, l]) => l === 3)].sort((a, b) => a[1] - b[1])
  for (const [id] of sorted) {
    const crit = criteria.find((x) => x.id === id)
    recs.push(REC_BY_CRITERION[id] ?? `Procvičit: ${(crit?.question || crit?.name || '').replace(/[.?]$/, '').toLowerCase()}.`)
  }
  for (const v of c.answers?.improve ?? []) if (REC_BY_IMPROVE[v]) recs.push(REC_BY_IMPROVE[v])
  if (draft.goalStatus === 'nesplneno') recs.push('Vrátit se k cíli hodiny v kratších krocích a ověřit, kde se postup zastavil.')
  if (!recs.length && c.strong.length) recs.push('Nabídnout náročnější úlohy, ve kterých žák využije, co už zvládá.')
  return [...new Set(recs)].slice(0, 4)
}

/**
 * Automatický SWOT z hodnocení učitele, sebehodnocení žáka a slovní zpětné vazby.
 * Překážky (T) vycházejí jen z uložených údajů (stagnace, nesoulad hodnocení, nesplněné cíle),
 * nikdy z domněnek o osobní situaci žáka.
 */
export function proposeSwot(d: DB, draft: DraftLike, self?: SelfAssessment): Swot {
  const c = context(d, draft, self)
  const a = c.answers

  const s: string[] = []
  if (c.strong.length) s.push(`Samostatně zvládá: ${list(c.strong)}.`)
  if (draft.feedback.good) s.push(clean(draft.feedback.good))
  if (draft.goalStatus === 'splneno') s.push('Splnil/a vzdělávací cíl hodiny.')
  const well = a?.wentWell.map((v) => WENT_WELL_NOUN[v]).filter(Boolean) ?? []
  if (well.length) s.push(`Podle sebehodnocení: ${list(well)}.`)

  const w: string[] = []
  const weakNames = c.weak.map(([id]) => c.name(id)).filter(Boolean)
  if (weakNames.length) w.push(`Potřebuje výraznou podporu: ${list(weakNames)}.`)
  if (c.mid.length) w.push(`Zvládá s občasnou pomocí: ${list(c.mid)}.`)
  if (draft.feedback.todo) w.push(clean(draft.feedback.todo))
  const imp = a?.improve.filter((v) => v !== IMPROVE_NOTHING).map((v) => IMPROVE_NOUN[v]).filter(Boolean) ?? []
  if (imp.length) w.push(`Sám/sama chce: ${list(imp)}.`)

  const o: string[] = []
  if (draft.feedback.next) o.push(`Další krok: ${clean(draft.feedback.next)}`)
  const improved = c.entries
    .filter(([id, l]) => {
      const p = criterionSeries(c.prev, id).at(-1)
      return p && l > p.level
    })
    .map(([id]) => c.name(id))
  if (improved.length) o.push(`Navázat na posun v oblasti: ${list(improved)}.`)
  if (c.strong.length && weakNames.length) o.push(`Využít to, co už zvládá (${list(c.strong)}), při procvičování slabších oblastí.`)
  if (a?.wentWell.includes('nevzdal')) o.push('Vytrvalost při obtížích je dobrý základ pro náročnější úlohy.')

  const t: string[] = []
  const stuck = c.weak
    .filter(([id]) => {
      const p = criterionSeries(c.prev, id).at(-1)
      return p && p.level <= WEAK
    })
    .map(([id]) => c.name(id))
  if (stuck.length) t.push(`${list(stuck).replace(/^./, (x) => x.toUpperCase())}: úroveň se opakovaně drží nízko – bez cílené podpory hrozí, že bude chybět pro další učivo.`)
  const knowledge = draft.scores['k-znalosti']
  if (a && knowledge) {
    const band = teacherBand(knowledge)
    if (band && a.understanding > band) t.push('Žák hodnotí své porozumění výš než učitel – hrozí, že nepozná, co si potřebuje procvičit.')
    if (band && a.understanding < band) t.push('Žák si věří méně, než odpovídá jeho výkonu – nízká sebedůvěra může brzdit samostatnou práci.')
  }
  const lastGoal = c.prev.at(-1)?.goalStatus
  if (draft.goalStatus === 'nesplneno' && lastGoal === 'nesplneno') t.push('Cíl hodiny se opakovaně nedaří splnit – mezery v učivu se mohou prohlubovat.')
  if (a?.improve.includes('soustredit')) t.push('Žák sám uvádí potíže se soustředěním.')

  return {
    s: s.join(' '),
    w: w.join(' '),
    o: o.join(' '),
    t: t.join(' '),
    rec: recommendations(d, draft, self).map((r) => `– ${r}`).join('\n'),
    proposed: true,
  }
}

/** Krátké formativní hodnocení žáka z hodnocení učitele, sebehodnocení a zpětné vazby. */
export function formativeText(d: DB, draft: DraftLike, self?: SelfAssessment): string {
  const c = context(d, draft, self)
  const a = c.answers
  const lines: string[] = []
  const lvl = ([id, l]: [string, Level]) => `${c.name(id)} (${l} – ${LEVELS[l - 1].name.toLowerCase()})`

  const strong = c.entries.filter(([, l]) => l >= STRONG)
  if (strong.length || draft.feedback.good)
    lines.push(`Co se daří: ${[strong.length ? list(strong.map(lvl)) + '.' : '', draft.feedback.good ? clean(draft.feedback.good) : ''].filter(Boolean).join(' ')}`)
  const work = c.entries.filter(([, l]) => l <= 3).sort((x, y) => x[1] - y[1])
  if (work.length || draft.feedback.todo)
    lines.push(`Na čem pracovat: ${[work.length ? list(work.map(lvl)) + '.' : '', draft.feedback.todo ? clean(draft.feedback.todo) : ''].filter(Boolean).join(' ')}`)
  if (draft.goalStatus) lines.push(`Vzdělávací cíl hodiny: ${GOAL_STATUS_LABEL[draft.goalStatus].toLowerCase()}.`)
  if (a) {
    const goalSelf = describe.goalMet(a.goalMet).replace(/\.$/, '').toLowerCase()
    const agree =
      draft.goalStatus &&
      ((draft.goalStatus === 'splneno' && a.goalMet === 'ano') ||
        (draft.goalStatus === 'castecne' && a.goalMet === 'castecne') ||
        (draft.goalStatus === 'nesplneno' && a.goalMet === 'zatimne'))
    lines.push(
      `Pohled žáka: ${describe.understanding(a.understanding).replace(/\.$/, '').toLowerCase()}; splnění cíle podle sebe: ${goalSelf}${draft.goalStatus ? (agree ? ' – shoduje se s hodnocením učitele' : ' – liší se od hodnocení učitele, vyplatí se o tom mluvit') : ''}.`,
    )
  }
  const next = draft.feedback.next ? clean(draft.feedback.next) : recommendations(d, draft, self)[0]
  if (next) lines.push(`Další krok: ${next}`)
  return lines.join('\n')
}

// ─── Návrh vzdělávacího cíle ─────────────────────────────────────────────────

const GOAL_BY_CRITERION: Record<string, (topic: string) => string> = {
  'k-znalosti': (t) => `Žák rozumí ${t ? `tématu „${t}“` : 'učivu'} a dokáže ho vysvětlit vlastními slovy.`,
  'k-dovednosti': (t) => `Žák použije ${t ? `učivo z tématu „${t}“` : 'učivo'} při řešení úlohy.`,
  'k-samostatnost': (t) => `Žák vyřeší úlohu${t ? ` z tématu „${t}“` : ''} samostatně, bez pomoci.`,
  'k-spoluprace': () => 'Žák při práci ve dvojici aktivně přispěje a respektuje ostatní.',
  'k-ukoly': () => 'Žák dokončí zadanou práci v daném čase.',
  'k-sebehodnoceni': () => 'Žák na konci hodiny popíše, co už umí a co potřebuje zlepšit.',
}

/**
 * Návrhy vzdělávacího cíle z předchozích záznamů (bez AI): rozpracované cíle žáka,
 * poslední „další krok“, nejslabší dovednost a cíl z minulé hodiny ve třídě.
 */
export function goalSuggestions(d: DB, studentId: string, subjectId: string, topic: string): string[] {
  const out: string[] = []
  const own = studentAssessments(d, studentId, subjectId)
  const openGoal = d.goals.filter((g) => g.studentId === studentId && g.subjectId === subjectId && g.status === 'rozpracovany').at(-1)
  if (openGoal) out.push(clean(openGoal.text))
  const last = own.at(-1)
  if (last?.feedback.next) out.push(clean(last.feedback.next))
  if (last) {
    const weakest = (Object.entries(last.scores) as [string, Level][]).sort((a, b) => a[1] - b[1])[0]
    if (weakest && weakest[1] <= 3) {
      const crit = criteriaFor(d, subjectId).find((c) => c.id === weakest[0])
      const fn = GOAL_BY_CRITERION[weakest[0]]
      if (fn) out.push(fn(topic.trim()))
      else if (crit?.question && !crit.question.endsWith('?')) out.push(clean(crit.question))
    }
  }
  const classGoal = d.assessments
    .filter((a) => a.subjectId === subjectId && a.goal.trim())
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (classGoal) out.push(clean(classGoal.goal))
  return [...new Set(out.filter(Boolean))].slice(0, 3)
}

// ─── Žáci, kteří potřebují větší podporu ─────────────────────────────────────

export interface SupportReason {
  text: string
  severity: 2 | 1
}

export function supportReasons(d: DB, studentId: string, subjectId: string): SupportReason[] {
  const as = studentAssessments(d, studentId, subjectId)
  if (!as.length) return []
  const criteria = criteriaFor(d, subjectId)
  const reasons: SupportReason[] = []
  const low: string[] = []
  const down: string[] = []
  for (const c of criteria) {
    const s = criterionSeries(as, c.id)
    const last = s.at(-1)
    if (!last) continue
    if (last.level <= WEAK) low.push(c.name.toLowerCase())
    const prev = s.at(-2)
    if (prev && last.level < prev.level) down.push(c.name.toLowerCase())
  }
  if (low.length) reasons.push({ text: `Nízká úroveň: ${list(low)}`, severity: 2 })
  if (down.length) reasons.push({ text: `Pokles: ${list(down)}`, severity: 1 })
  const recentGoals = as.slice(-3).filter((a) => a.goalStatus)
  const notMet = recentGoals.filter((a) => a.goalStatus === 'nesplneno').length
  if (notMet >= 2) reasons.push({ text: `Cíl hodiny nesplněn ${notMet}× z posledních ${recentGoals.length}`, severity: 2 })
  const lastSelf = d.selfAssessments
    .filter((s) => s.answers && as.some((a) => a.id === s.assessmentId))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .at(-1)?.answers
  if (lastSelf?.understanding === 1) reasons.push({ text: 'Žák uvádí, že učivu zatím moc nerozumí', severity: 1 })
  if (lastSelf?.work === 1) reasons.push({ text: 'Žák uvádí, že potřeboval/a častější pomoc', severity: 1 })
  const unmet = d.goals.filter((g) => g.studentId === studentId && g.subjectId === subjectId && g.status === 'nesplneny').length
  if (unmet) reasons.push({ text: `Nesplněné cíle: ${unmet}`, severity: 1 })
  return reasons
}
