import type {
  Assessment, Criterion, DB, Level, LessonGoalStatus, ReportLength, SelfAssessment, SummaryKind, SummarySection, SummarySentence, Swot,
} from './types'
import { allCriteriaFor, uid } from './util'
import { fmt, fmtShort, inRange, weekStart } from './dates'
import { gainOf, isStrong, isWeak, LEVELS } from './levels'
import { describeSelf, teacherBand } from './questionnaire'
import { periodLabel, PERIOD_LABEL, teacherQuestions } from './periods'

export { LEVELS } from './levels'

/*
 * Deterministické návrhy (šablony): souhrny, formativní zpráva, individuální rozvoj,
 * doporučení a návrhy cílů. Vycházejí jen z uložených údajů – nic nedomýšlí, chybějící
 * hodnocení nevydávají za splněné ani nesplněné a na chybějící podklady upozorní.
 * Pokud je připojená AI (src/lib/ai.ts), použije se místo šablon, se stejnými pravidly.
 *
 * Škála: 1 = výborně (nejlepší) … 5 = zatím nezvládá. Nižší číslo = lepší.
 */

export const NO_OBSTACLES = 'Nebyly zaznamenány konkrétní překážky v učení.'

export const studentAssessments = (d: DB, studentId: string, subjectId?: string) =>
  d.assessments
    .filter((a) => a.studentId === studentId && (!subjectId || a.subjectId === subjectId))
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))

export interface Point {
  date: string
  level: Level
  assessmentId: string
}

/** Jen ohodnocené záznamy – nehodnoceno se nikdy nepočítá jako nejnižší úroveň. */
export function criterionSeries(list: Assessment[], criterionId: string): Point[] {
  return list.filter((a) => a.scores[criterionId]).map((a) => ({ date: a.date, level: a.scores[criterionId], assessmentId: a.id }))
}

export function weeklyLevels(points: Point[]) {
  const byWeek = new Map<string, Point>()
  for (const p of points) byWeek.set(weekStart(p.date), p)
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, p]) => ({ week, ...p }))
}

export function trendWord(first: number, last: number) {
  const g = gainOf(first, last)
  return g > 0 ? 'zlepšení' : g < 0 ? 'potřebuje víc podpory' : 'beze změny'
}

export const GOAL_STATUS_LABEL: Record<LessonGoalStatus, string> = {
  splneno: 'Splněno',
  castecne: 'Částečně splněno',
  nesplneno: 'Nesplněno',
}

const sentence = (text: string, sources: string[]): SummarySentence => ({ id: uid('v'), text, sources: [...new Set(sources)] })
const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.!]?$/, '.')
const noDot = (s: string) => s.trim().replace(/[.!]$/, '')
export const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} a ${xs[xs.length - 1]}`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function collectTexts(as: Assessment[], pick: (a: Assessment) => string, max: number) {
  const map = new Map<string, string[]>()
  for (const a of as) {
    const t = pick(a).trim()
    if (!t) continue
    const key = t.toLowerCase()
    map.set(key, [...(map.get(key) ?? []), a.id])
  }
  return [...map.entries()]
    .map(([, ids]) => {
      const first = as.find((a) => a.id === ids[0])!
      return { text: clean(pick(first)), ids, last: Math.max(...ids.map((id) => as.findIndex((a) => a.id === id))) }
    })
    .sort((a, b) => b.last - a.last)
    .slice(0, max)
}

interface CritStat {
  c: Criterion
  points: Point[]
  first: Point
  last: Point
}

function stats(as: Assessment[], criteria: Criterion[]): CritStat[] {
  return criteria
    .map((c) => {
      const points = criterionSeries(as, c.id)
      return points.length ? { c, points, first: points[0], last: points[points.length - 1] } : null
    })
    .filter((x): x is CritStat => x !== null)
}

const allCriteria = allCriteriaFor

const selfOf = (d: DB, as: Assessment[]) =>
  d.selfAssessments.filter((s) => as.some((a) => a.id === s.assessmentId)).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

function goalCounts(as: Assessment[]) {
  const goals = as.flatMap((a) => a.goals.map((g) => ({ ...g, aid: a.id })))
  const by = (s: LessonGoalStatus) => goals.filter((g) => g.status === s)
  return { goals, met: by('splneno'), part: by('castecne'), notMet: by('nesplneno'), unmarked: goals.filter((g) => !g.status) }
}

// ─── Souhrn za období (snímek 6C) ────────────────────────────────────────────

export function generateSummary(d: DB, studentId: string, subjectId: string, kind: SummaryKind, from: string, to: string): SummarySection[] {
  void kind
  const all = studentAssessments(d, studentId, subjectId)
  const inP = all.filter((a) => inRange(a.date, from, to))
  const before = all.filter((a) => a.date < from)
  const st = stats(inP, allCriteria(d, subjectId))
  const goals = d.goals.filter((g) => g.studentId === studentId && g.subjectId === subjectId && inRange(g.setOn, from, to))
  const selfs = selfOf(d, inP)

  if (inP.length === 0) return [{ key: 'prazdne', title: 'Bez záznamů', sentences: [sentence('V tomto období nejsou uložené žádné záznamy hodnocení.', [])] }]

  const sections: SummarySection[] = []
  const push = (key: string, title: string, s: SummarySentence[]) => s.length && sections.push({ key, title, sentences: s })

  // Co žák zvládá
  const mastered = st.filter((s) => isStrong(s.last.level))
  const can: SummarySentence[] = []
  if (mastered.length) can.push(sentence(`Samostatně zvládá: ${list(mastered.map((s) => s.c.name.toLowerCase()))}.`, mastered.map((s) => s.last.assessmentId)))
  can.push(...collectTexts(inP, (a) => a.feedback.good, 3).map((x) => sentence(x.text, x.ids)))
  const units = [...new Set(inP.flatMap((a) => a.units))].map((id) => d.units.find((u) => u.id === id)?.name).filter(Boolean) as string[]
  const topics = [...new Set([...units, ...inP.map((a) => a.topic.trim()).filter(Boolean)])]
  if (topics.length) can.push(sentence(`Probíraná témata: ${list(topics.slice(0, 8))}.`, inP.filter((a) => a.topic || a.units.length).map((a) => a.id)))
  push('zvlada', 'Co žák zvládá', can)

  // V čem se zlepšil
  const moves: SummarySentence[] = []
  for (const s of st) {
    const w = weeklyLevels(s.points)
    if (w.length > 1) moves.push(sentence(`${s.c.name}: ${w.map((p) => p.level).join(' → ')} (${trendWord(w[0].level, w.at(-1)!.level)}).`, s.points.map((p) => p.assessmentId)))
    else {
      const prev = criterionSeries(before, s.c.id).at(-1)
      if (prev && gainOf(prev.level, s.last.level) > 0) moves.push(sentence(`${s.c.name}: posun z úrovně ${prev.level} na ${s.last.level}.`, [prev.assessmentId, s.last.assessmentId]))
    }
  }
  const best = st.filter((s) => gainOf(s.first.level, s.last.level) > 0).sort((a, b) => gainOf(b.first.level, b.last.level) - gainOf(a.first.level, a.last.level))[0]
  if (best) moves.unshift(sentence(`Největší posun: ${best.c.name.toLowerCase()} (z úrovně ${best.first.level} na ${best.last.level}).`, [best.first.assessmentId, best.last.assessmentId]))
  if (!moves.length) moves.push(sentence('Za období nejsou k dispozici údaje pro porovnání pokroku.', []))
  push('zlepseni', 'V čem se zlepšil/a', moves)

  // Kde potřebuje podporu
  const support: SummarySentence[] = st
    .filter((s) => s.last.level >= 3)
    .map((s) => sentence(`${s.c.name}: ${LEVELS[s.last.level - 1].name.toLowerCase()}.`, [s.last.assessmentId]))
  support.push(...collectTexts(inP, (a) => a.feedback.todo, 3).map((x) => sentence(x.text, x.ids)))
  const lastSelf = selfs.filter((s) => s.answers).at(-1)
  if (lastSelf) {
    const ds = describeSelf(lastSelf)
    if (!ds.nothingToImprove && ds.improve.length) support.push(sentence(`Žák sám uvádí, že chce zlepšit: ${list(ds.improve.map((x) => noDot(x).toLowerCase()))}.`, [lastSelf.id]))
  }
  push('podpora', 'Kde potřebuje podporu', support)

  // Jaké vzdělávací cíle splnil
  const gc = goalCounts(inP)
  const g: SummarySentence[] = []
  if (gc.goals.length) {
    const parts = [gc.met.length && `splněno ${gc.met.length}`, gc.part.length && `částečně ${gc.part.length}`, gc.notMet.length && `nesplněno ${gc.notMet.length}`, gc.unmarked.length && `bez označení ${gc.unmarked.length}`].filter(Boolean) as string[]
    g.push(sentence(`Vzdělávací cíle za období (${gc.goals.length}): ${list(parts)}.`, gc.goals.map((x) => x.aid)))
    for (const x of gc.met.slice(-3)) g.push(sentence(`Splněno: ${clean(x.text)}`, [x.aid]))
  }
  for (const x of goals.filter((y) => y.status === 'splneny').slice(-2)) g.push(sentence(`Splněný další cíl: ${clean(x.text)}`, [x.id]))
  if (!g.length) g.push(sentence('V tomto období nebyly označeny žádné vzdělávací cíle.', []))
  push('cile', 'Jaké vzdělávací cíle splnil/a', g)

  // Doporučené další cíle
  const next: SummarySentence[] = [
    ...gc.part.concat(gc.notMet).slice(-2).map((x) => sentence(`Pokračovat v cíli: ${clean(x.text)}`, [x.aid])),
    ...collectTexts(inP, (a) => a.feedback.next, 2).map((x) => sentence(x.text, x.ids)),
  ]
  const wish = selfs.filter((s) => s.answers?.nextWish.trim()).at(-1)
  if (wish) next.push(sentence(`Přání žáka: ${clean(wish.answers!.nextWish)}`, [wish.id]))
  push('dalsi', 'Doporučené další cíle', next)

  // Pohled žáka
  const pv: SummarySentence[] = []
  if (lastSelf) {
    const ds = describeSelf(lastSelf)
    pv.push(sentence(`Žák své porozumění hodnotí slovy „${noDot(ds.understanding)}“ a splnění cílů „${ds.goalMet.toLowerCase()}“ (subjektivní pohled žáka).`, [lastSelf.id]))
    if (ds.wentWell.length) pv.push(sentence(`Podle žáka se povedlo: ${list(ds.wentWell.map((x) => `„${noDot(x)}“`))}.`, [lastSelf.id]))
  }
  const legacy = selfs.filter((s) => !s.answers).at(-1)
  if (!pv.length && legacy?.wentWell) pv.push(sentence(`Podle žáka se povedlo: ${clean(legacy.wentWell)}`, [legacy.id]))
  push('pohled', 'Pohled žáka', pv)

  return sections
}

// ─── Doporučení, individuální rozvoj a formativní zpráva (snímek 5) ──────────

const REC_BY_CRITERION: Record<string, string> = {
  'k-znalosti': 'Zopakovat klíčové pojmy na krátkých úlohách a ověřit porozumění otázkou „proč?“.',
  'k-reseni': 'Řešit 2–3 podobné úlohy s postupně menší nápovědou a porovnat postupy.',
  'k-samostatnost': 'Zadávat kratší samostatné úkoly a nápovědu postupně ubírat.',
  'k-spoluprace': 'Zařadit práci ve dvojici s jasně rozdělenými rolemi.',
  'k-komunikace': 'Nechat žáka vysvětlit postup vlastními slovy spolužákovi nebo učiteli.',
  'k-organizace': 'Rozdělit zadání na menší kroky s průběžnou kontrolou a termíny.',
  'k-tvorivost': 'Nabídnout otevřené úlohy s více možnými řešeními.',
  'k-kriticke': 'Vést žáka k ověřování výsledků a zdrojů (odhad, zkouška, porovnání).',
  'k-digitalni': 'Procvičit práci s digitálními nástroji na krátkých praktických úkolech.',
  'k-zpetna-vazba': 'Po zpětné vazbě společně stanovit jeden konkrétní krok ke zlepšení a ověřit ho.',
  'k-dovednosti': 'Procvičit postup na 2–3 podobných úlohách s postupně menší nápovědou.',
  'k-ukoly': 'Rozdělit zadání na menší kroky s průběžnou kontrolou.',
  'k-pokrok': 'Pravidelně se žákem projít, co se od minula zlepšilo.',
  'k-sebehodnoceni': 'Na konci hodiny společně porovnat sebehodnocení s hodnocením učitele.',
}

export type DraftLike = Pick<Assessment, 'studentId' | 'subjectId' | 'scores' | 'skillNotes' | 'feedback' | 'teacherQ' | 'date' | 'id' | 'goals' | 'periodType' | 'periodFrom' | 'periodTo' | 'units' | 'topic'>

interface Ctx {
  name: (id: string) => string
  entries: [string, Level][]
  strong: [string, Level][]
  mid: [string, Level][]
  weak: [string, Level][]
  prev: Assessment[]
  self?: ReturnType<typeof describeSelf>
  selfRaw?: SelfAssessment
}

function context(d: DB, a: DraftLike, self?: SelfAssessment): Ctx {
  const crits = allCriteria(d, a.subjectId)
  const name = (id: string) => crits.find((c) => c.id === id)?.name.toLowerCase() ?? 'dovednost'
  const entries = (Object.entries(a.scores) as [string, Level][]).sort((x, y) => x[1] - y[1])
  return {
    name,
    entries,
    strong: entries.filter(([, l]) => isStrong(l)),
    mid: entries.filter(([, l]) => l === 3),
    weak: entries.filter(([, l]) => isWeak(l)),
    prev: studentAssessments(d, a.studentId, a.subjectId).filter((x) => x.id !== a.id && x.date <= a.date),
    self: self?.answers ? describeSelf(self) : undefined,
    selfRaw: self,
  }
}

export function recommendations(d: DB, a: DraftLike, self?: SelfAssessment): string[] {
  const c = context(d, a, self)
  const crits = allCriteria(d, a.subjectId)
  const recs: string[] = []
  for (const [id] of [...c.weak, ...c.mid].sort((x, y) => y[1] - x[1])) {
    const crit = crits.find((x) => x.id === id)
    recs.push(REC_BY_CRITERION[id] ?? `Procvičit: ${noDot(crit?.question || crit?.name || '').toLowerCase()}.`)
  }
  if (c.self && !c.self.nothingToImprove) {
    const imp = c.self.improve.join(' ').toLowerCase()
    if (/soustřed/.test(imp)) recs.push('Rozdělit práci na kratší úseky s jasným cílem.')
    if (/organiz/.test(imp)) recs.push(REC_BY_CRITERION['k-organizace'])
    if (/procvič|příprav/.test(imp)) recs.push('Nabídnout procvičovací úlohy navíc s možností kontroly výsledků.')
  }
  if (a.goals.some((g) => g.status === 'nesplneno')) recs.push('Vrátit se k nesplněnému cíli v kratších krocích a ověřit, kde se postup zastavil.')
  if (!recs.length && c.strong.length) recs.push('Nabídnout náročnější úlohy, ve kterých žák využije, co už zvládá.')
  return [...new Set(recs)].slice(0, 4)
}

/** Individuální rozvoj žáka (4 barevná pole). Překážky jen z doložených údajů. */
export function proposeDevelopment(d: DB, a: DraftLike, self?: SelfAssessment): Swot {
  const c = context(d, a, self)
  const s: string[] = []
  if (c.strong.length) s.push(`Samostatně zvládá: ${list(c.strong.map(([id]) => c.name(id)))}.`)
  if (a.feedback.good) s.push(clean(a.feedback.good))
  const met = a.goals.filter((g) => g.status === 'splneno')
  if (met.length) s.push(`Splněné cíle: ${list(met.map((g) => noDot(g.text)))}.`)
  const improved = c.entries.filter(([id, l]) => {
    const p = criterionSeries(c.prev, id).at(-1)
    return p && gainOf(p.level, l) > 0
  })
  if (improved.length) s.push(`Zaznamenaný pokrok: ${list(improved.map(([id]) => c.name(id)))}.`)
  if (c.self?.wentWell.length) s.push(`Sám/sama uvádí: ${list(c.self.wentWell.map((x) => `„${noDot(x)}“`))}.`)

  const w: string[] = []
  if (c.weak.length) w.push(`Potřebuje výraznou podporu: ${list(c.weak.map(([id]) => c.name(id)))}.`)
  if (c.mid.length) w.push(`Částečně zvládá, potřebuje procvičit: ${list(c.mid.map(([id]) => c.name(id)))}.`)
  if (a.feedback.todo) w.push(clean(a.feedback.todo))
  const partial = a.goals.filter((g) => g.status === 'castecne' || g.status === 'nesplneno')
  if (partial.length) w.push(`Dosud nesplněné cíle: ${list(partial.map((g) => noDot(g.text)))}.`)
  if (c.self && !c.self.nothingToImprove && c.self.improve.length) w.push(`Sám/sama chce zlepšit: ${list(c.self.improve.map((x) => noDot(x).toLowerCase()))}.`)

  const o: string[] = []
  const recs = recommendations(d, a, self)
  if (recs.length) o.push(recs.map((r) => `– ${r}`).join('\n'))
  if (a.feedback.next) o.push(`Další krok: ${clean(a.feedback.next)}`)
  if (improved.length) o.push(`Navázat na posun v oblasti: ${list(improved.map(([id]) => c.name(id)))}.`)
  if (c.strong.length) o.push(`Prohlubovat dovednosti v náročnějších úlohách (${list(c.strong.slice(0, 2).map(([id]) => c.name(id)))}).`)

  const t: string[] = []
  const stuck = c.weak.filter(([id]) => {
    const p = criterionSeries(c.prev, id).at(-1)
    return p && isWeak(p.level)
  })
  if (stuck.length) t.push(`${cap(list(stuck.map(([id]) => c.name(id))))}: úroveň zůstává opakovaně nízká. Potřebná podpora: častější kontrola porozumění a kratší kroky.`)
  const knowledge = a.scores['k-znalosti']
  if (c.self && knowledge && c.selfRaw?.answers) {
    const band = teacherBand(knowledge)
    if (band && c.selfRaw.answers.understanding > band) t.push('Žák hodnotí své porozumění výš, než odpovídá hodnocení učitele. Doporučení: společně projít, co už zvládá a co si potřebuje procvičit.')
  }
  const prevGoals = c.prev.at(-1)?.goals ?? []
  if (a.goals.some((g) => g.status === 'nesplneno') && prevGoals.some((g) => g.status === 'nesplneno')) t.push('Cíle se opakovaně nedaří splnit. Doporučení: menší a lépe měřitelné cíle s průběžnou kontrolou.')
  if (c.self && /soustřed/i.test(c.self.improve.join(' '))) t.push('Žák sám uvádí obtíže se soustředěním. Doporučení: kratší úseky práce s jasným cílem.')

  return { s: s.join(' '), w: w.join(' '), o: o.join('\n'), t: t.length ? t.join('\n') : NO_OBSTACLES, proposed: true }
}

/** Upozornění na chybějící podklady (zpráva se vytvoří jen z dostupných údajů). */
export function missingInfo(d: DB, a: DraftLike, self: SelfAssessment | undefined, length: ReportLength): string[] {
  const m: string[] = []
  if (!Object.keys(a.scores).length) m.push('Není ohodnocena žádná dovednost.')
  if (!a.goals.length) m.push('Není zadán vzdělávací cíl.')
  for (const g of a.goals) if (!g.status) m.push(`U cíle „${noDot(g.text)}“ není označeno splnění.`)
  if (!self) m.push('Chybí sebehodnocení žáka.')
  if (!Object.values(a.teacherQ).some((x) => x && (x.choices.length || x.note.trim())) && !Object.values(a.skillNotes).some((x) => x.trim()))
    m.push('Chybí slovní komentáře učitele.')
  if (length === 'dlouhe' && !studentAssessments(d, a.studentId, a.subjectId).some((x) => x.id !== a.id && x.date <= a.date))
    m.push('Nejsou předchozí hodnocení pro porovnání.')
  return m
}

/** Slovní formativní hodnocení (zpráva pro žáka a rodiče) v délce krátké / střední / dlouhé. */
export function reportText(d: DB, a: DraftLike, self: SelfAssessment | undefined, length: ReportLength): { text: string; missing: string[] } {
  const c = context(d, a, self)
  const lvl = ([id, l]: [string, Level]) => `${c.name(id)} (${LEVELS[l - 1].name.toLowerCase()})`
  const paras: string[] = []
  const period = periodLabel(a.periodType, a.periodFrom, a.periodTo)
  const answers = teacherQuestions(a.periodType, a.periodFrom, a.periodTo)
  const ans = (k: 'zvladnuti' | 'samostatnost') => {
    const x = a.teacherQ[k]
    return [...(x?.choices ?? []), x?.note ?? ''].map((t) => t.trim()).filter(Boolean).map(clean).join(' ')
  }

  // Co zvládá
  const can = [c.strong.length ? `V hodnoceném období (${period}) zvládá ${list(c.strong.map(lvl))}.` : '', a.feedback.good ? clean(a.feedback.good) : '']
  if (length !== 'kratke' && ans('zvladnuti')) can.push(ans('zvladnuti'))
  paras.push(can.filter(Boolean).join(' ') || `V hodnoceném období (${period}) zatím nejsou doložené silné stránky.`)

  // Co zlepšit
  const work = [...c.weak, ...c.mid].sort((x, y) => y[1] - x[1])
  const todo = [work.length ? `Zlepšit potřebuje: ${list(work.map(lvl))}.` : '', a.feedback.todo ? clean(a.feedback.todo) : '']
  if (todo.some(Boolean)) paras.push(todo.filter(Boolean).join(' '))

  if (length !== 'kratke') {
    if (ans('samostatnost')) paras.push(`Samostatnost: ${ans('samostatnost')}`)
    if (a.goals.length) {
      paras.push(
        'Vzdělávací cíle: ' +
          a.goals.map((g) => `„${noDot(g.text)}“ – ${g.status ? GOAL_STATUS_LABEL[g.status].toLowerCase() : 'splnění zatím není označeno'}`).join('; ') +
          '.',
      )
    }
    const notes = Object.entries(a.skillNotes).filter(([, n]) => n.trim())
    if (length === 'dlouhe' && notes.length) paras.push('Komentáře k dovednostem: ' + notes.map(([id, n]) => `${c.name(id)} – ${noDot(n)}`).join('; ') + '.')
  }

  if (length === 'dlouhe') {
    const cmp = c.entries
      .map(([id, l]) => {
        const p = criterionSeries(c.prev, id).at(-1)
        if (!p) return ''
        const g = gainOf(p.level, l)
        return g > 0 ? `${c.name(id)} se zlepšila z úrovně ${p.level} na ${l}` : g < 0 ? `${c.name(id)} je nyní na úrovni ${l} (dříve ${p.level})` : `${c.name(id)} zůstává na úrovni ${l}`
      })
      .filter(Boolean)
    if (cmp.length) paras.push(`Ve srovnání s předchozím hodnocením: ${list(cmp)}.`)
    const att = d.attachments.filter((x) => x.assessmentId === a.id)
    if (att.length) paras.push(`Doložené práce a dokumenty: ${list(att.map((x) => x.name))}.`)
  }

  // Pohled žáka – odlišit od hodnocení učitele, rozdíly citlivě a věcně
  if (c.self && length !== 'kratke') {
    const parts = [`Podle vlastního sebehodnocení žák uvádí: „${noDot(c.self.understanding)}“`]
    if (length === 'dlouhe') parts.push(`práce: „${noDot(c.self.work)}“`)
    parts.push(`splnění cílů: „${c.self.goalMet.toLowerCase()}“`)
    let p = parts.join(', ') + '.'
    const band = teacherBand(a.scores['k-znalosti'])
    if (band && c.selfRaw?.answers) {
      if (c.selfRaw.answers.understanding > band) p += ' Vlastní pohled je o něco příznivější než hodnocení učitele, vyplatí se společně projít, co je potřeba ještě procvičit.'
      else if (c.selfRaw.answers.understanding < band) p += ' Žák se hodnotí přísněji, než odpovídá hodnocení učitele, zaslouží si povzbuzení, že učivo zvládá lépe, než si myslí.'
      else p += ' Pohled žáka se shoduje s hodnocením učitele.'
    }
    if (length === 'dlouhe' && c.self.nextWish) p += ` Příště chce: „${noDot(c.self.nextWish)}“.`
    paras.push(p)
  }

  // Další krok / doporučení
  const recs = recommendations(d, a, self)
  if (length === 'kratke') paras.push(`Další krok: ${a.feedback.next ? clean(a.feedback.next) : recs[0] ?? 'stanovit společně se žákem.'}`)
  else paras.push('Doporučení pro další učení: ' + [a.feedback.next ? clean(a.feedback.next) : '', ...recs.slice(0, length === 'dlouhe' ? 4 : 2)].filter(Boolean).map(noDot).join('; ') + '.')

  void answers
  return { text: paras.join('\n\n'), missing: missingInfo(d, a, self, length) }
}

// ─── Návrh vzdělávacích cílů (bez AI: z katalogu ŠVP a předchozích záznamů) ──

export function goalSuggestions(d: DB, a: Pick<DraftLike, 'studentId' | 'subjectId' | 'units' | 'topic' | 'periodType'>): string[] {
  const out: string[] = []
  for (const id of a.units) out.push(...(d.units.find((u) => u.id === id)?.goals ?? []))
  const own = studentAssessments(d, a.studentId, a.subjectId)
  const open = d.goals.filter((g) => g.studentId === a.studentId && g.subjectId === a.subjectId && g.status === 'rozpracovany').at(-1)
  if (open) out.push(clean(open.text))
  const last = own.at(-1)
  if (last?.feedback.next) out.push(clean(last.feedback.next))
  for (const g of last?.goals ?? []) if (g.status && g.status !== 'splneno') out.push(clean(g.text))
  if (a.topic.trim()) {
    const t = a.topic.trim()
    out.push(
      a.periodType === 'hodina'
        ? `Žák vysvětlí a samostatně použije učivo z tématu „${t}“.`
        : `Žák během období (${PERIOD_LABEL[a.periodType].toLowerCase()}) prohloubí znalosti z tématu „${t}“ a použije je v úlohách.`,
    )
  }
  return [...new Set(out.filter(Boolean))].slice(0, 6)
}

// ─── Žáci, kteří potřebují větší podporu ─────────────────────────────────────

export interface SupportReason {
  text: string
  severity: 2 | 1
}

export function supportReasons(d: DB, studentId: string, subjectId: string): SupportReason[] {
  const as = studentAssessments(d, studentId, subjectId)
  if (!as.length) return []
  const reasons: SupportReason[] = []
  const low: string[] = []
  const down: string[] = []
  for (const c of allCriteria(d, subjectId)) {
    const s = criterionSeries(as, c.id)
    const last = s.at(-1)
    if (!last) continue
    if (isWeak(last.level)) low.push(c.name.toLowerCase())
    const prev = s.at(-2)
    if (prev && gainOf(prev.level, last.level) < 0) down.push(c.name.toLowerCase())
  }
  if (low.length) reasons.push({ text: `Nízká úroveň: ${list(low)}`, severity: 2 })
  if (down.length) reasons.push({ text: `Pokles: ${list(down)}`, severity: 1 })
  const recent = as.slice(-3).flatMap((a) => a.goals.filter((g) => g.status))
  const notMet = recent.filter((g) => g.status === 'nesplneno').length
  if (notMet >= 2) reasons.push({ text: `Nesplněné cíle: ${notMet}× v posledních hodnoceních`, severity: 2 })
  const lastSelf = selfOf(d, as).filter((s) => s.answers).at(-1)?.answers
  if (lastSelf?.understanding === 1) reasons.push({ text: 'Žák uvádí, že učivu zatím moc nerozumí', severity: 1 })
  if (lastSelf?.work === 1) reasons.push({ text: 'Žák uvádí, že potřeboval/a častější pomoc', severity: 1 })
  return reasons
}

export const fmtDate = fmt
export const fmtShortDate = fmtShort
