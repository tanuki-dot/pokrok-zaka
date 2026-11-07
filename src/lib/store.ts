import { useSyncExternalStore } from 'react'
import type {
  Assessment, AuditEntry, Criterion, DB, Goal, Phrase, SchoolClass, SelfAnswers, SelfAssessment, SelfWording, Student, Subject, Summary,
} from './types'
import { createDemoDB } from './seed'
import { uid } from './util'
import { migrate } from './migrate'

/**
 * Lokální úložiště pro demo režim (localStorage). Rozhraní akcí odpovídá tomu,
 * co by v ostrém provozu dělaly dotazy do Supabase – stačí vyměnit tělo funkcí.
 */

const KEY = 'pokrok-zaka:v1'

let db: DB = load()
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      // Starší data (verze 1, obrácená škála) se převedou; neznámý formát → demo data.
      const parsed = migrate(JSON.parse(raw))
      if (parsed) return parsed
    }
  } catch {
    /* prázdné nebo zablokované úložiště → demo data */
  }
  return createDemoDB()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* úložiště nedostupné – data zůstanou jen v paměti */
  }
}

// Demo data se uloží hned při prvním spuštění, aby všechny karty pracovaly se stejnými daty.
persist()

function commit(next: DB) {
  db = next
  persist()
  listeners.forEach((l) => l())
}

// Synchronizace mezi kartami (např. žák odešle sebehodnocení v jiné kartě).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      const next = migrate(JSON.parse(e.newValue))
      if (next) {
        db = next
        listeners.forEach((l) => l())
      }
    } catch {
      /* ignorovat poškozená data */
    }
  })
}

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => db,
  )
}
export const getDB = () => db

export { uid, criteriaFor } from './util'

const now = () => new Date().toISOString()

function audit(d: DB, action: AuditEntry['action'], entity: string, label: string): AuditEntry[] {
  return [{ id: uid('a'), at: now(), action, entity, label }, ...d.audit].slice(0, 400)
}

const studentName = (d: DB, id: string) => {
  const s = d.students.find((x) => x.id === id)
  return s ? `${s.firstName} ${s.lastName}` : 'žák'
}

// ─── Nastavení / demo ────────────────────────────────────────────────────────

export function setRole(role: DB['settings']['role']) {
  commit({ ...db, settings: { ...db.settings, role } })
}
export function setSchoolType(schoolType: DB['settings']['schoolType']) {
  commit({ ...db, settings: { ...db.settings, schoolType } })
}
export function resetDemo() {
  commit(createDemoDB())
}

// ─── Třídy, předměty, žáci (KROK 1) ──────────────────────────────────────────

export function addClass(schoolId: string, name: string): SchoolClass {
  const c: SchoolClass = { id: uid('c'), schoolId, name: name.trim() }
  commit({ ...db, classes: [...db.classes, c], audit: audit(db, 'vytvořeno', 'třída', c.name) })
  return c
}

export function setClassWording(classId: string, selfWording: SelfWording) {
  commit({ ...db, classes: db.classes.map((c) => (c.id === classId ? { ...c, selfWording } : c)) })
}

export function addSubject(classId: string, name: string): Subject {
  const s: Subject = { id: uid('p'), classId, name: name.trim(), hiddenDefaults: [] }
  const cls = db.classes.find((c) => c.id === classId)
  commit({ ...db, subjects: [...db.subjects, s], audit: audit(db, 'vytvořeno', 'předmět', `${s.name} · ${cls?.name ?? ''}`) })
  return s
}

export function removeSubject(id: string) {
  const s = db.subjects.find((x) => x.id === id)
  commit({
    ...db,
    subjects: db.subjects.filter((x) => x.id !== id),
    criteria: db.criteria.filter((c) => c.subjectId !== id),
    audit: audit(db, 'smazáno', 'předmět', s?.name ?? ''),
  })
}

export function addStudents(classId: string, people: { firstName: string; lastName: string }[], imported = false) {
  const added: Student[] = people
    .filter((p) => p.firstName.trim() || p.lastName.trim())
    .map((p) => ({ id: uid('s'), classId, firstName: p.firstName.trim(), lastName: p.lastName.trim() }))
  const cls = db.classes.find((c) => c.id === classId)
  commit({
    ...db,
    students: [...db.students, ...added],
    audit: audit(db, imported ? 'importováno' : 'vytvořeno', 'žáci', `${added.length} × ${cls?.name ?? ''}`),
  })
  return added
}

export function removeStudent(id: string) {
  const name = studentName(db, id)
  const aIds = new Set(db.assessments.filter((a) => a.studentId === id).map((a) => a.id))
  commit({
    ...db,
    students: db.students.filter((s) => s.id !== id),
    assessments: db.assessments.filter((a) => a.studentId !== id),
    selfAssessments: db.selfAssessments.filter((s) => !aIds.has(s.assessmentId)),
    goals: db.goals.filter((g) => g.studentId !== id),
    summaries: db.summaries.filter((s) => s.studentId !== id),
    audit: audit(db, 'smazáno', 'žák', name),
  })
}

// ─── Kritéria (KROK 2) ───────────────────────────────────────────────────────

export function addCriterion(subjectId: string, name: string, question: string): Criterion {
  const c: Criterion = { id: uid('k'), subjectId, name: name.trim(), question: question.trim() }
  commit({ ...db, criteria: [...db.criteria, c], audit: audit(db, 'vytvořeno', 'kritérium', c.name) })
  return c
}
export function removeCriterion(id: string) {
  const c = db.criteria.find((x) => x.id === id)
  commit({ ...db, criteria: db.criteria.filter((x) => x.id !== id), audit: audit(db, 'smazáno', 'kritérium', c?.name ?? '') })
}
export function toggleDefault(subjectId: string, criterionId: string) {
  commit({
    ...db,
    subjects: db.subjects.map((s) =>
      s.id !== subjectId
        ? s
        : {
            ...s,
            hiddenDefaults: s.hiddenDefaults.includes(criterionId)
              ? s.hiddenDefaults.filter((x) => x !== criterionId)
              : [...s.hiddenDefaults, criterionId],
          },
    ),
  })
}

// ─── Banka vět (KROK 4) ──────────────────────────────────────────────────────

export function addPhrase(kind: Phrase['kind'], text: string) {
  commit({ ...db, phrases: [...db.phrases, { id: uid('v'), kind, text: text.trim() }] })
}
export function removePhrase(id: string) {
  commit({ ...db, phrases: db.phrases.filter((p) => p.id !== id) })
}

// ─── Hodnocení (KROK 3–7) ────────────────────────────────────────────────────

export type AssessmentDraft = Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'selfCode'> & {
  id?: string
  selfCode?: string | null
}

export function saveAssessment(draft: AssessmentDraft): Assessment {
  const existing = draft.id ? db.assessments.find((a) => a.id === draft.id) : undefined
  const a: Assessment = {
    ...draft,
    id: existing?.id ?? uid('h'),
    selfCode: draft.selfCode ?? existing?.selfCode ?? null,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  }
  const assessments = existing ? db.assessments.map((x) => (x.id === a.id ? a : x)) : [...db.assessments, a]

  // Další cíl z hodnocení se propisuje do cílů žáka (jeden cíl na záznam).
  let goals = db.goals
  const linked = goals.find((g) => g.assessmentId === a.id)
  if (a.nextGoal.trim()) {
    if (linked) goals = goals.map((g) => (g.id === linked.id ? { ...g, text: a.nextGoal.trim() } : g))
    else
      goals = [
        ...goals,
        {
          id: uid('g'),
          studentId: a.studentId,
          subjectId: a.subjectId,
          text: a.nextGoal.trim(),
          setOn: a.date,
          due: addDaysISO(a.date, 14),
          status: 'rozpracovany',
          assessmentId: a.id,
        },
      ]
  } else if (linked) {
    goals = goals.filter((g) => g.id !== linked.id)
  }

  commit({
    ...db,
    assessments,
    goals,
    audit: audit(db, existing ? 'upraveno' : 'vytvořeno', 'hodnocení', `${studentName(db, a.studentId)} · ${a.topic || 'bez tématu'}`),
  })
  return a
}

function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function deleteAssessment(id: string) {
  const a = db.assessments.find((x) => x.id === id)
  commit({
    ...db,
    assessments: db.assessments.filter((x) => x.id !== id),
    selfAssessments: db.selfAssessments.filter((s) => s.assessmentId !== id),
    goals: db.goals.filter((g) => g.assessmentId !== id),
    audit: audit(db, 'smazáno', 'hodnocení', a ? `${studentName(db, a.studentId)} · ${a.topic}` : ''),
  })
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Jak dlouho platí odkaz pro žáka. */
export const SELF_CODE_HOURS = 24

const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

/**
 * Vydá kód pro sebehodnocení (platí SELF_CODE_HOURS hodin, jednorázový).
 * correction = true → žák smí už odeslané odpovědi opravit (řízená oprava).
 */
export function issueSelfCode(assessmentId: string, correction = false): string {
  const a = db.assessments.find((x) => x.id === assessmentId)
  if (a?.selfCode && !isExpired(a.selfCodeExpires) && !!a.selfCodeCorrection === correction) return a.selfCode
  const code = newCode()
  const expires = new Date(Date.now() + SELF_CODE_HOURS * 3600_000).toISOString()
  commit({
    ...db,
    assessments: db.assessments.map((x) =>
      x.id === assessmentId ? { ...x, selfCode: code, selfCodeExpires: expires, selfCodeCorrection: correction } : x,
    ),
    audit: correction ? audit(db, 'upraveno', 'sebehodnocení', `${a ? studentName(db, a.studentId) : ''} · povolena oprava`) : db.audit,
  })
  return code
}

export function revokeSelfCode(assessmentId: string) {
  commit({ ...db, assessments: db.assessments.map((x) => (x.id === assessmentId ? { ...x, selfCode: null, selfCodeExpires: null, selfCodeCorrection: false } : x)) })
}

export const isExpired = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now()

export type CodeCheck =
  | { ok: true; assessment: Assessment; correction: boolean; previous?: SelfAssessment }
  | { ok: false; reason: 'neplatny' | 'vyprsel' | 'odeslano' }

/** Ověří kód z odkazu / QR. Žák uvidí jen hodnocení, ke kterému kód patří. */
export function checkSelfCode(code: string): CodeCheck {
  const a = db.assessments.find((x) => x.selfCode && x.selfCode === code.toUpperCase())
  if (!a) return { ok: false, reason: 'neplatny' }
  if (isExpired(a.selfCodeExpires)) return { ok: false, reason: 'vyprsel' }
  const previous = db.selfAssessments.find((s) => s.assessmentId === a.id)
  if (previous && !a.selfCodeCorrection) return { ok: false, reason: 'odeslano' }
  return { ok: true, assessment: a, correction: !!a.selfCodeCorrection, previous }
}

export function submitSelfAssessment(code: string, answers: SelfAnswers): boolean {
  const check = checkSelfCode(code)
  if (!check.ok) return false
  const a = check.assessment
  const prev = check.previous
  const entry: SelfAssessment = {
    id: prev?.id ?? uid('z'),
    assessmentId: a.id,
    answers: { ...answers, nextWish: answers.nextWish.trim().slice(0, 500) },
    submittedAt: now(),
    corrections: prev ? (prev.corrections ?? 0) + 1 : 0,
  }
  commit({
    ...db,
    selfAssessments: [...db.selfAssessments.filter((s) => s.assessmentId !== a.id), entry],
    // Kód je jednorázový – po odeslání zanikne (brání duplicitnímu odeslání).
    assessments: db.assessments.map((x) => (x.id === a.id ? { ...x, selfCode: null, selfCodeExpires: null, selfCodeCorrection: false } : x)),
    audit: audit(db, prev ? 'upraveno' : 'odevzdáno', 'sebehodnocení', `${studentName(db, a.studentId)} · ${a.topic}`),
  })
  return true
}

// ─── Cíle ────────────────────────────────────────────────────────────────────

export function setGoalStatus(id: string, status: Goal['status']) {
  const g = db.goals.find((x) => x.id === id)
  commit({
    ...db,
    goals: db.goals.map((x) => (x.id === id ? { ...x, status } : x)),
    audit: audit(db, 'upraveno', 'cíl', `${g ? studentName(db, g.studentId) : ''} · ${status}`),
  })
}

// ─── Souhrny (KROK 7–10) ─────────────────────────────────────────────────────

export function saveSummary(s: Summary, isNew: boolean) {
  commit({
    ...db,
    summaries: isNew ? [...db.summaries, s] : db.summaries.map((x) => (x.id === s.id ? s : x)),
    audit: audit(db, isNew ? 'vytvořeno' : 'upraveno', 'souhrn', `${studentName(db, s.studentId)} · v${s.version}`),
  })
}

export function approveSummary(id: string) {
  const s = db.summaries.find((x) => x.id === id)
  if (!s) return
  commit({
    ...db,
    summaries: db.summaries.map((x) => (x.id === id ? { ...x, status: 'schvaleno', approvedAt: now() } : x)),
    audit: audit(db, 'schváleno', 'souhrn', `${studentName(db, s.studentId)} · v${s.version}`),
  })
}

export function deleteSummary(id: string) {
  const s = db.summaries.find((x) => x.id === id)
  commit({
    ...db,
    summaries: db.summaries.filter((x) => x.id !== id),
    audit: audit(db, 'smazáno', 'souhrn', s ? studentName(db, s.studentId) : ''),
  })
}

// ─── Záloha ──────────────────────────────────────────────────────────────────

export function replaceDB(next: unknown) {
  const n = migrate(next as Record<string, unknown>)
  if (!n) throw new Error('Neplatná záloha')
  commit({ ...n, audit: audit(n, 'importováno', 'záloha', `${n.assessments.length} záznamů`) })
}
