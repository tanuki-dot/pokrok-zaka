import { useSyncExternalStore } from 'react'
import type {
  Assessment, Attachment, AuditEntry, Criterion, DB, DocKind, Document, Feedback, Goal, Phrase, Report, SchoolClass, SelfAnswers, SelfAssessment, SelfFormDef,
  SelfWording, Student, Subject, Summary, TeacherAnswer, TeacherQKey, TopicUnit,
} from './types'
import { deleteDoc, deleteFile, putDoc, putFile } from './files'
import { createDemoDB } from './seed'
import { uid } from './util'
import { migrate } from './migrate'
import { remoteEnabled, retry, sync } from './remote'
import { remapIds } from './remap'

/**
 * Data aplikace v paměti. Dva režimy:
 *  - demo (bez nastaveného serveru): data v localStorage tohoto prohlížeče,
 *  - server (VITE_SUPABASE_URL): po přihlášení se data načtou ze Supabase a každá změna
 *    se zapíše do databáze (remote.sync). Do prohlížeče se pak nic neukládá.
 */

const KEY = 'pokrok-zaka:v1'

export const emptyDB = (): DB => ({
  version: 3, schools: [], classes: [], students: [], subjects: [], criteria: [], units: [], assessments: [], selfAssessments: [],
  attachments: [], documents: [], goals: [], summaries: [], phrases: [], audit: [], settings: { role: 'ucitel', teacherName: '', schoolType: 'SS' },
})

let db: DB = remoteEnabled ? emptyDB() : load()
/** V režimu serveru se změny zapisují až po načtení dat (ne během načítání). */
let remoteReady = false
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      // Starší data (obrácená škála apod.) se převedou; neznámý formát → demo data.
      const parsed = migrate(JSON.parse(raw))
      if (parsed) return parsed
    }
  } catch {
    /* prázdné nebo zablokované úložiště → demo data */
  }
  return createDemoDB()
}

function persist() {
  if (remoteEnabled) return
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* úložiště nedostupné – data zůstanou jen v paměti */
  }
}

// Demo data se uloží hned při prvním spuštění, aby všechny karty pracovaly se stejnými daty.
persist()

function commit(next: DB) {
  const prev = db
  db = next
  persist()
  if (remoteEnabled && remoteReady) void sync(prev, next)
  listeners.forEach((l) => l())
}

/** Data načtená ze serveru (bez zápisu zpět). */
export function setLoaded(next: DB) {
  db = next
  remoteReady = true
  listeners.forEach((l) => l())
}
/** Po odhlášení: vyprázdnit data v paměti. */
export function clearLoaded() {
  remoteReady = false
  db = emptyDB()
  listeners.forEach((l) => l())
}
export const retrySync = () => retry(db)

// Synchronizace mezi kartami v demu (např. žák odešle sebehodnocení v jiné kartě).
if (typeof window !== 'undefined' && !remoteEnabled) {
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
/** Na serveru: přidá ukázková (fiktivní) data s novými identifikátory pro tohoto učitele. */
export function seedDemoRemote(teacherName: string) {
  const demo = remapIds(createDemoDB())
  commit({
    ...demo,
    criteria: [...db.criteria, ...demo.criteria.filter((c) => c.subjectId)],
    units: db.units.length ? db.units : demo.units,
    settings: { ...db.settings, teacherName },
    audit: [{ id: uid('a'), at: now(), action: 'vytvořeno', entity: 'ukázková data', label: 'fiktivní třídy ZŠ a SŠ' }],
  })
}
export function addSchool(name: string, type: DB['settings']['schoolType']) {
  const s = { id: uid('skola-'), name: name.trim(), type }
  commit({ ...db, schools: [...db.schools, s], settings: { ...db.settings, schoolType: type }, audit: audit(db, 'vytvořeno', 'škola', s.name) })
  return s
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

export function addStudent(classId: string, firstName: string, lastName: string): Student {
  const st: Student = { id: uid('s'), classId, firstName: firstName.trim(), lastName: lastName.trim() }
  const cls = db.classes.find((c) => c.id === classId)
  commit({ ...db, students: [...db.students, st], audit: audit(db, 'vytvořeno', 'žák', `${st.firstName} ${st.lastName} · ${cls?.name ?? ''}`) })
  return st
}

export function setClassInfo(classId: string, info: Pick<SchoolClass, 'grade' | 'field'>) {
  commit({ ...db, classes: db.classes.map((c) => (c.id === classId ? { ...c, ...info } : c)) })
}

export function addUnit(subjectName: string, name: string, grade?: number): TopicUnit {
  const u: TopicUnit = { id: uid('u'), subjectName: subjectName.trim().toLowerCase(), grades: grade ? [grade] : [], name: name.trim(), goals: [], custom: true }
  commit({ ...db, units: [...db.units, u], audit: audit(db, 'vytvořeno', 'tematický celek', u.name) })
  return u
}
export function removeUnit(id: string) {
  commit({ ...db, units: db.units.filter((x) => x.id !== id) })
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
    attachments: db.attachments.filter((x) => !aIds.has(x.assessmentId)),
    documents: db.documents.filter((d) => d.studentId !== id),
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

export type AssessmentDraft = Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'selfCode' | 'feedback' | 'status'> & {
  id?: string
  selfCode?: string | null
  status?: Assessment['status']
}

const answerText = (x?: TeacherAnswer) => [...(x?.choices ?? []), x?.note?.trim() ?? ''].filter(Boolean).join(' ')

/** Slovní zpětná vazba odvozená z dotazníku učitele (pro souhrny, SWOT a export). */
export function feedbackOf(q: Partial<Record<TeacherQKey, TeacherAnswer>>): Feedback {
  return { good: answerText(q.povedlo), todo: answerText(q.procvicit), next: answerText(q.dalsi) }
}

export function saveAssessment(draft: AssessmentDraft): Assessment {
  const existing = draft.id ? db.assessments.find((a) => a.id === draft.id) : undefined
  const feedback = feedbackOf(draft.teacherQ)
  const nextGoal = draft.nextGoal || draft.teacherQ.dalsi?.note?.trim() || draft.teacherQ.dalsi?.choices[0] || ''
  const a: Assessment = {
    ...existing,
    ...draft,
    feedback,
    nextGoal,
    status: draft.status ?? existing?.status ?? 'rozpracovane',
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
        { id: uid('g'), studentId: a.studentId, subjectId: a.subjectId, text: a.nextGoal.trim(), setOn: a.date, due: addDaysISO(a.date, 14), status: 'rozpracovany', assessmentId: a.id },
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

/** Hromadné hodnocení (KROK 3): vytvoří hodnocení pro více žáků najednou (jeden zápis). */
export function saveBulkAssessments(drafts: AssessmentDraft[]): number {
  if (!drafts.length) return 0
  const created: Assessment[] = drafts.map((draft) => ({
    ...draft,
    feedback: feedbackOf(draft.teacherQ),
    nextGoal: draft.nextGoal ?? '',
    status: draft.status ?? 'rozpracovane',
    id: draft.id ?? uid('h'),
    selfCode: null,
    createdAt: now(),
    updatedAt: now(),
  } as Assessment))
  commit({
    ...db,
    assessments: [...db.assessments, ...created],
    audit: audit(db, 'vytvořeno', 'hromadné hodnocení', `${created.length} žáků`),
  })
  return created.length
}

/** Uloží formativní zprávu; schválením se hodnocení označí jako dokončené. */
export function saveReport(assessmentId: string, report: Report, swot: Assessment['swot'], approve: boolean) {
  const a = db.assessments.find((x) => x.id === assessmentId)
  if (!a) return
  const r: Report = approve ? { ...report, approved: true, approvedAt: now() } : { ...report, approved: false, approvedAt: null }
  commit({
    ...db,
    assessments: db.assessments.map((x) => (x.id === assessmentId ? { ...x, report: r, swot, status: approve ? 'dokoncene' : x.status, updatedAt: now() } : x)),
    audit: audit(db, approve ? 'schváleno' : 'upraveno', 'formativní hodnocení', `${studentName(db, a.studentId)} · ${a.topic || 'bez tématu'}`),
  })
}

export function setSelfForm(assessmentId: string, form: SelfFormDef | undefined) {
  commit({ ...db, assessments: db.assessments.map((x) => (x.id === assessmentId ? { ...x, selfForm: form, updatedAt: now() } : x)) })
}

// ─── Přílohy ─────────────────────────────────────────────────────────────────

export async function addAttachment(assessmentId: string, owner: Attachment['owner'], file: File): Promise<Attachment> {
  const att: Attachment = { id: uid('f'), assessmentId, owner, name: file.name, type: file.type || 'application/octet-stream', size: file.size, addedAt: now() }
  // Nejdřív soubor (na serveru až po zapsání hodnocení), potom záznam o příloze.
  await putFile(att, file)
  const a = db.assessments.find((x) => x.id === assessmentId)
  commit({ ...db, attachments: [...db.attachments, att], audit: audit(db, 'vytvořeno', owner === 'zak' ? 'příloha žáka' : 'příloha', `${a ? studentName(db, a.studentId) : ''} · ${att.name}`) })
  return att
}

export async function removeAttachment(id: string) {
  const att = db.attachments.find((x) => x.id === id)
  if (att) await deleteFile(att).catch(() => {})
  commit({
    ...db,
    attachments: db.attachments.filter((x) => x.id !== id),
    assessments: db.assessments.map((a) => (a.report?.attachments.includes(id) ? { ...a, report: { ...a.report, attachments: a.report.attachments.filter((x) => x !== id) } } : a)),
    audit: audit(db, 'smazáno', 'příloha', att?.name ?? ''),
  })
}

// ─── Podpůrné dokumenty žáka (PLPP, IVP, PPP, SPC …) ─────────────────────────

export async function addDocument(studentId: string, kind: DocKind, file: File): Promise<Document> {
  const doc: Document = { id: uid('doc'), scope: 'zak', studentId, schoolId: null, subjectId: null, kind, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, addedAt: now() }
  await putDoc(doc, file)
  commit({ ...db, documents: [...db.documents, doc], audit: audit(db, 'vytvořeno', 'dokument žáka', `${studentName(db, studentId)} · ${doc.name}`) })
  return doc
}

export async function addSchoolDocument(schoolId: string, subjectId: string | null, kind: DocKind, file: File): Promise<Document> {
  const doc: Document = { id: uid('doc'), scope: 'skola', studentId: null, schoolId, subjectId, kind, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, addedAt: now() }
  await putDoc(doc, file)
  commit({ ...db, documents: [...db.documents, doc], audit: audit(db, 'vytvořeno', 'školní dokument', doc.name) })
  return doc
}

export async function removeDocument(id: string) {
  const doc = db.documents.find((x) => x.id === id)
  if (doc) await deleteDoc(doc).catch(() => {})
  commit({ ...db, documents: db.documents.filter((x) => x.id !== id), audit: audit(db, 'smazáno', 'dokument žáka', doc?.name ?? '') })
}

function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function deleteAssessment(id: string) {
  const a = db.assessments.find((x) => x.id === id)
  db.attachments.filter((x) => x.assessmentId === id).forEach((x) => void deleteFile(x).catch(() => {}))
  commit({
    ...db,
    assessments: db.assessments.filter((x) => x.id !== id),
    selfAssessments: db.selfAssessments.filter((s) => s.assessmentId !== id),
    attachments: db.attachments.filter((x) => x.assessmentId !== id),
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

export function submitSelfAssessment(code: string, answers: SelfAnswers, form: SelfFormDef): boolean {
  const check = checkSelfCode(code)
  if (!check.ok) return false
  const a = check.assessment
  const prev = check.previous
  const entry: SelfAssessment = {
    id: prev?.id ?? uid('z'),
    assessmentId: a.id,
    form,
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
  if (remoteEnabled) throw new Error('Obnova ze zálohy je dostupná jen v demu.')
  const n = migrate(next as Record<string, unknown>)
  if (!n) throw new Error('Neplatná záloha')
  commit({ ...n, audit: audit(n, 'importováno', 'záloha', `${n.assessments.length} záznamů`) })
}
