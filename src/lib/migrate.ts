import type { Assessment, AuditEntry, Criterion, DB, Level, Summary, SummarySection, TeacherAnswer, TeacherQKey } from './types'
import { LEVELS } from './levels'
import { uid } from './util'
import { DEFAULT_CRITERIA, DEMO_UNITS, LEGACY_CRITERIA } from './catalog'

/*
 * Převod uložených dat mezi verzemi. Nic se nepřepisuje beze stopy: původní úrovně
 * zůstávají v `scoresOriginal`, původní znění souhrnů v `sectionsOriginal`.
 *
 * Verze 1 (do 0.0.4): 1 = nejlepší (samostatně a umí vysvětlit) … 5 = zatím nezvládá.
 * Verze 2 (0.0.5):    1 = nejnižší (zatím nezvládá) … 5 = nejvyšší (samostatně a jistě).
 * Verze 3 (0.0.6+):   1 = výborně … 5 = zatím nezvládá  (pokrokveskole.docx).
 *
 * Převod podle významu:
 *   v2 5 „samostatně a jistě“      → v3 1 „výborně“
 *   v2 4 „samostatně“              → v3 2 „velmi dobře“
 *   v2 3 „s občasnou pomocí“       → v3 3 „částečně zvládá“
 *   v2 2 „s výraznou pomocí“       → v3 4 „potřebuje výraznou pomoc“
 *   v2 1 „zatím nezvládá“          → v3 5 „zatím nezvládá“
 *   tj. v3 = 6 − v2; verze 1 má stejný směr jako verze 3 (v3 = v1).
 */

const flip = (l: number) => (6 - l) as Level
const now = () => new Date().toISOString()

// ── Věty souhrnů vytvořené aplikací (věty učitele bez zdroje se nemění) ──

const V1_LEVEL_TEXT = ['zvládá samostatně a umí vysvětlit.', 'zvládá s drobnou pomocí.', 'zvládá základní postup s pomocí.', 'potřebuje výraznou pomoc.', 'zatím nezvládá, potřebuje další podporu.']
const V2_LEVEL_TEXT = ['zatím nezvládá.', 'zvládá s výraznou pomocí.', 'zvládá s občasnou pomocí.', 'zvládá samostatně.', 'zvládá samostatně a jistě.']

/** Přepočítá čísla úrovní ve větě (posloupnosti, „z úrovně X na Y“, „úroveň X oproti Y“). */
function flipNumbers(t: string) {
  return t
    .replace(/([1-5])((?:\s*→\s*[1-5])+)/g, (m) => m.replace(/[1-5]/g, (d) => String(flip(+d))))
    .replace(/z úrovně ([1-5])( \([^)]*\))? na ([1-5])/g, (_m, a, mid = '', b) => `z úrovně ${flip(+a)}${mid} na ${flip(+b)}`)
    .replace(/úroveň ([1-5]) oproti ([1-5])/g, (_m, a, b) => `úroveň ${flip(+a)} oproti ${flip(+b)}`)
}

/** Věta vytvořená ve verzi 1 → znění pro verzi 3 (čísla zůstávají, mění se popisy úrovní). */
export function convertSentenceV1toV3(text: string): string {
  let t = text.replace('Samostatně nebo s drobnou pomocí zvládá:', 'Samostatně zvládá:')
  V1_LEVEL_TEXT.forEach((old, i) => {
    if (t.endsWith(old)) t = t.slice(0, -old.length) + LEVELS[i].name.toLowerCase() + '.'
  })
  return t
}

/** Věta vytvořená ve verzi 2 → verze 3 (čísla se otočí podle významu). */
export function convertSentenceV2toV3(text: string): string {
  let t = flipNumbers(text)
  V2_LEVEL_TEXT.forEach((old, i) => {
    if (t.endsWith(old)) t = t.slice(0, -old.length) + LEVELS[flip(i + 1) - 1].name.toLowerCase() + '.'
  })
  return t
}

const convertSections = (sections: SummarySection[], fn: (t: string) => string): SummarySection[] =>
  sections.map((sec) => ({ ...sec, sentences: sec.sentences.map((s) => (s.sources.length ? { ...s, text: fn(s.text) } : s)) }))

// ── Hodnocení ve starším tvaru ──

type OldAssessment = Omit<Assessment, 'periodType' | 'periodFrom' | 'periodTo' | 'units' | 'goals' | 'skills' | 'skillNotes' | 'teacherQ' | 'status'> & {
  goal?: string
  goalStatus?: Assessment['goals'][number]['status']
  skills?: string[]
  formative?: string
  formativeProposed?: boolean
  successCriterion?: string
  lesson?: number | null
}

function upgradeAssessment(a: OldAssessment, scale: 'v1' | 'v2'): Assessment {
  const scores =
    scale === 'v2'
      ? (Object.fromEntries(Object.entries(a.scores).map(([k, v]) => [k, flip(v)])) as Record<string, Level>)
      : a.scores
  const teacherQ: Partial<Record<TeacherQKey, TeacherAnswer>> = {}
  if (a.feedback?.good) teacherQ.povedlo = { choices: [], note: a.feedback.good }
  if (a.feedback?.todo) teacherQ.procvicit = { choices: [], note: a.feedback.todo }
  if (a.feedback?.next) teacherQ.dalsi = { choices: [], note: a.feedback.next }
  const {
    goal, goalStatus, formative, formativeProposed: _fp, successCriterion: _sc, lesson: _l, skills, ...rest
  } = a
  void _fp; void _sc; void _l
  return {
    ...rest,
    scores,
    scoresOriginal: a.scoresOriginal ?? { scale, scores: { ...a.scores }, convertedAt: now() },
    periodType: 'hodina',
    periodFrom: a.date,
    periodTo: a.date,
    units: [],
    topic: a.topic ?? '',
    goals: goal ? [{ id: uid('c'), text: goal, status: goalStatus ?? null }] : [],
    skills: skills ?? Object.keys(scores),
    skillNotes: {},
    teacherQ,
    swot: { ...a.swot, proposed: a.swot?.proposed ?? false },
    report: formative
      ? { length: 'stredni', text: formative, original: formative, source: 'sablona', approved: false, approvedAt: null, missing: [], attachments: [] }
      : undefined,
    status: 'dokoncene',
  }
}

function upgradeCriteria(criteria: Criterion[]): Criterion[] {
  const legacyIds = new Set(LEGACY_CRITERIA.map((c) => c.id))
  const defaultIds = new Set(DEFAULT_CRITERIA.map((c) => c.id))
  // Vlastní dovednosti učitele (u předmětu i společné) zůstávají beze změny.
  const own = criteria.filter((c) => c.subjectId !== null || (!legacyIds.has(c.id) && !defaultIds.has(c.id)))
  const usedLegacy = LEGACY_CRITERIA.filter((c) => criteria.some((x) => x.id === c.id))
  return [...DEFAULT_CRITERIA, ...usedLegacy, ...own]
}

type AnyDB = Record<string, unknown> & { version?: number }

export function migrate(raw: AnyDB): DB | null {
  if (!raw || !Array.isArray(raw.assessments)) return null
  if (raw.version === 3) return raw as unknown as DB
  if (raw.version !== 1 && raw.version !== 2) return null
  const scale = raw.version === 1 ? 'v1' : 'v2'
  const old = raw as unknown as Omit<DB, 'version' | 'units' | 'attachments' | 'assessments'> & {
    assessments: OldAssessment[]
    timetable?: unknown
    settings: DB['settings'] & { bells?: unknown }
  }

  const assessments = old.assessments.map((a) => upgradeAssessment(a, scale))
  const fn = scale === 'v1' ? convertSentenceV1toV3 : convertSentenceV2toV3
  const summaries: Summary[] = old.summaries.map((s) => ({
    ...s,
    sectionsOriginal: s.sectionsOriginal ?? s.sections,
    sections: convertSections(s.sections, fn),
    history: s.history?.map((h) => ({ ...h, sections: convertSections(h.sections, fn) })),
  }))
  const { bells: _b, ...settings } = old.settings
  void _b
  const { timetable: _t, ...rest } = old
  void _t
  const note: AuditEntry = {
    id: uid('a'),
    at: now(),
    action: 'převedeno',
    entity: 'škála',
    label: `${assessments.length} hodnocení na škálu 1 (výborně) – 5 (zatím nezvládá), původní hodnoty zachovány`,
  }
  const isDemo = old.classes.some((c) => c.id === 'c-me1')
  return {
    ...rest,
    version: 3,
    classes: old.classes.map((c) =>
      isDemo && c.id === 'c-me1' ? { ...c, grade: c.grade ?? 1, field: c.field ?? 'Mechanik elektrotechnik' } : isDemo && c.id === 'c-7a' ? { ...c, grade: c.grade ?? 7 } : c,
    ),
    criteria: upgradeCriteria(old.criteria),
    units: structuredClone(DEMO_UNITS),
    assessments,
    attachments: [],
    summaries,
    settings,
    audit: [note, ...old.audit].slice(0, 400),
  }
}
