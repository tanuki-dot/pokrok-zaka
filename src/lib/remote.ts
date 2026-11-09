import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { DB } from './types'

/*
 * Napojení na Supabase (databáze, přihlášení, úložiště příloh).
 *
 * Aplikace pracuje dál s jedním objektem dat v paměti (store.ts). Po přihlášení se
 * načtou všechna data, která učitel smí vidět (RLS), a každá změna se automaticky
 * zapíše do databáze: porovnají se seznamy před a po změně a uloží se jen změněné,
 * nové a smazané řádky. Bez VITE_SUPABASE_URL běží aplikace jako demo v prohlížeči.
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const remoteEnabled = !!(SUPABASE_URL && ANON)
export const anonKey = ANON ?? ''

export const sb: SupabaseClient | null = remoteEnabled
  ? createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pokrok-zaka:prihlaseni' } })
  : null

export async function accessToken(): Promise<string | null> {
  const { data } = (await sb?.auth.getSession()) ?? { data: { session: null as Session | null } }
  return data.session?.access_token ?? null
}

// ─── Mapování app ↔ databáze ─────────────────────────────────────────────────

type Key = 'schools' | 'classes' | 'students' | 'subjects' | 'criteria' | 'units' | 'assessments' | 'selfAssessments' | 'attachments' | 'documents' | 'goals' | 'summaries' | 'phrases' | 'audit'
type Row = Record<string, unknown>
type Item = { id: string } & Record<string, unknown>

interface TableSpec {
  table: string
  /** pole aplikace → sloupec databáze */
  fields: Record<string, string>
  /** které položky se zapisují (např. jen vlastní dovednosti, ne katalog) */
  writable?: (x: Item) => boolean
  insertOnly?: boolean
}

const f = (...names: string[]) => Object.fromEntries(names.map((n) => [n, n.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())]))

/** Pořadí = pořadí zápisu (rodiče před dětmi). */
export const TABLES: Record<Key, TableSpec> = {
  schools: { table: 'schools', fields: f('id', 'name', 'type') },
  classes: { table: 'classes', fields: f('id', 'schoolId', 'name', 'grade', 'field', 'selfWording') },
  students: { table: 'students', fields: f('id', 'classId', 'firstName', 'lastName') },
  subjects: { table: 'subjects', fields: f('id', 'classId', 'name', 'hiddenDefaults') },
  criteria: { table: 'criteria', fields: f('id', 'subjectId', 'name', 'question', 'archived'), writable: (x) => x.subjectId != null },
  units: { table: 'topic_units', fields: { ...f('id', 'subjectName', 'grades', 'schoolType', 'name', 'goals', 'custom') }, writable: (x) => !!x.custom },
  assessments: {
    table: 'assessments',
    fields: f('id', 'studentId', 'subjectId', 'date', 'periodType', 'periodFrom', 'periodTo', 'units', 'topic', 'goals', 'skills', 'scores', 'skillNotes', 'teacherQ', 'feedback', 'swot', 'report', 'nextGoal', 'selfForm', 'status', 'selfCode', 'selfCodeExpires', 'selfCodeCorrection', 'scoresOriginal', 'createdAt', 'updatedAt'),
  },
  selfAssessments: { table: 'self_assessments', fields: f('id', 'assessmentId', 'answers', 'form', 'submittedAt', 'corrections') },
  attachments: { table: 'attachments', fields: f('id', 'assessmentId', 'owner', 'name', 'type', 'size', 'addedAt') },
  documents: { table: 'documents', fields: f('id', 'studentId', 'kind', 'name', 'mime', 'size', 'addedAt') },
  goals: { table: 'goals', fields: f('id', 'studentId', 'subjectId', 'assessmentId', 'text', 'setOn', 'due', 'status') },
  summaries: {
    table: 'summaries',
    fields: { ...f('id', 'studentId', 'subjectId', 'kind', 'sections', 'sectionsOriginal', 'teacherNote', 'status', 'version', 'history', 'createdAt', 'approvedAt'), from: 'period_from', to: 'period_to' },
  },
  phrases: { table: 'phrases', fields: f('id', 'kind', 'text') },
  audit: { table: 'audit_log', fields: f('id', 'at', 'action', 'entity', 'label'), insertOnly: true },
}
const ORDER = Object.keys(TABLES) as Key[]
const LEGACY_SELF = ['learned', 'wentWell', 'struggle', 'needHelp', 'nextWant'] as const

function toRow(key: Key, x: Item): Row {
  const row: Row = {}
  for (const [k, col] of Object.entries(TABLES[key].fields)) if (x[k] !== undefined) row[col] = x[k]
  if (key === 'selfAssessments' && LEGACY_SELF.some((k) => x[k])) row.legacy = Object.fromEntries(LEGACY_SELF.map((k) => [k, x[k] ?? '']))
  return row
}

function fromRow(key: Key, row: Row): Item {
  const x: Record<string, unknown> = {}
  for (const [k, col] of Object.entries(TABLES[key].fields)) if (row[col] !== null && row[col] !== undefined) x[k] = row[col]
  if (key === 'selfAssessments' && row.legacy) Object.assign(x, row.legacy as object)
  if (key === 'assessments') x.selfCode = row.self_code ?? null
  if (key === 'summaries' && !('approvedAt' in x)) x.approvedAt = null
  return x as Item
}

// ─── Načtení dat ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  fullName: string
  role: 'ucitel' | 'vedeni'
  schoolId: string | null
}

export async function loadProfile(): Promise<Profile | null> {
  const { data: u } = await sb!.auth.getUser()
  if (!u.user) return null
  const { data } = await sb!.from('profiles').select('*').eq('id', u.user.id).maybeSingle()
  return { id: u.user.id, email: u.user.email ?? '', fullName: data?.full_name ?? '', role: data?.role ?? 'ucitel', schoolId: data?.school_id ?? null }
}

async function selectAll(table: string, order?: string) {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb!.from(table).select('*').range(from, from + 999)
    if (order) q = q.order(order, { ascending: false })
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as Row[]))
    if (!data || data.length < 1000) break
    if (table === 'audit_log') break // stačí posledních 1000 změn
  }
  return out
}

export async function loadAll(base: Pick<DB, 'settings'>): Promise<DB> {
  const results = await Promise.all(ORDER.map((k) => selectAll(TABLES[k].table, k === 'audit' ? 'at' : undefined)))
  const db: Record<string, unknown> = { version: 3, settings: base.settings }
  ORDER.forEach((k, i) => (db[k] = results[i].map((r) => fromRow(k, r))))
  return db as unknown as DB
}

// ─── Zápis změn ──────────────────────────────────────────────────────────────

export type SyncState = { status: 'idle' | 'saving' | 'error'; message?: string }
let state: SyncState = { status: 'idle' }
const ls = new Set<(s: SyncState) => void>()
const setState = (s: SyncState) => {
  state = s
  ls.forEach((l) => l(s))
}
export const onSyncState = (l: (s: SyncState) => void) => {
  ls.add(l)
  l(state)
  return () => ls.delete(l)
}

let queue: Promise<void> = Promise.resolve()
let failed: { prev: DB; next: DB } | null = null

function diff(prev: DB, next: DB) {
  const ups: [Key, Row[]][] = []
  const dels: [Key, string[]][] = []
  for (const k of ORDER) {
    const spec = TABLES[k]
    const a = (prev[k as keyof DB] as unknown as Item[]) ?? []
    const b = (next[k as keyof DB] as unknown as Item[]) ?? []
    if (a === b) continue
    const before = new Map(a.map((x) => [x.id, x]))
    const after = new Set(b.map((x) => x.id))
    const changed = b.filter((x) => before.get(x.id) !== x && (!spec.writable || spec.writable(x)) && (!spec.insertOnly || !before.has(x.id)))
    if (changed.length) ups.push([k, changed.map((x) => toRow(k, x))])
    const removed = spec.insertOnly ? [] : a.filter((x) => !after.has(x.id) && (!spec.writable || spec.writable(x))).map((x) => x.id)
    if (removed.length) dels.push([k, removed])
  }
  return { ups, dels: dels.reverse() }
}

async function apply(prev: DB, next: DB) {
  const { ups, dels } = diff(prev, next)
  for (const [k, rows] of ups)
    for (let i = 0; i < rows.length; i += 200) {
      const t = sb!.from(TABLES[k].table)
      const chunk = rows.slice(i, i + 200)
      // Záznamy jen pro přidání (historie změn) se nepřepisují: ON CONFLICT DO NOTHING.
      const { error } = await (TABLES[k].insertOnly ? t.upsert(chunk, { ignoreDuplicates: true }) : t.upsert(chunk))
      if (error) throw new Error(error.message)
    }
  for (const [k, ids] of dels) {
    const { error } = await sb!.from(TABLES[k].table).delete().in('id', ids)
    if (error) throw new Error(error.message)
  }
}

/** Zařadí zápis změn (prev → next) do fronty. Změny se zapisují postupně, v pořadí. */
export function sync(prev: DB, next: DB) {
  queue = queue.then(async () => {
    // Po předchozí chybě se zkusí zapsat i nezapsané změny.
    const from = failed?.prev ?? prev
    setState({ status: 'saving' })
    try {
      await apply(from, next)
      failed = null
      setState({ status: 'idle' })
    } catch (e) {
      failed = { prev: from, next }
      setState({ status: 'error', message: (e as Error).message })
    }
  })
  return queue
}

/** Počká, až se zapíší všechny změny (např. před nahráním přílohy). */
export const flush = () => queue

export function retry(current: DB) {
  if (failed) return sync(failed.prev, current)
  return queue
}

// ─── Přílohy v úložišti ──────────────────────────────────────────────────────

const BUCKET = 'prilohy'
export const storagePath = (assessmentId: string, id: string) => `${assessmentId}/${id}`

export async function uploadFile(assessmentId: string, id: string, blob: Blob) {
  await flush()
  const { error } = await sb!.storage.from(BUCKET).upload(storagePath(assessmentId, id), blob, { contentType: blob.type || 'application/octet-stream', upsert: true })
  if (error) throw new Error('Soubor se nepodařilo nahrát na server.')
}
export async function downloadFile(assessmentId: string, id: string): Promise<Blob | undefined> {
  const { data, error } = await sb!.storage.from(BUCKET).download(storagePath(assessmentId, id))
  if (error) return undefined
  return data
}
export async function removeFile(assessmentId: string, id: string) {
  await sb!.storage.from(BUCKET).remove([storagePath(assessmentId, id)])
}

// Podpůrné dokumenty žáka – bucket „dokumenty“, cesta <student_id>/<document_id>.
const BUCKET_DOCS = 'dokumenty'
export const docPath = (studentId: string, id: string) => `${studentId}/${id}`
export async function uploadDoc(studentId: string, id: string, blob: Blob) {
  await flush()
  const { error } = await sb!.storage.from(BUCKET_DOCS).upload(docPath(studentId, id), blob, { contentType: blob.type || 'application/octet-stream', upsert: true })
  if (error) throw new Error('Dokument se nepodařilo nahrát na server.')
}
export async function downloadDoc(studentId: string, id: string): Promise<Blob | undefined> {
  const { data, error } = await sb!.storage.from(BUCKET_DOCS).download(docPath(studentId, id))
  if (error) return undefined
  return data
}
export async function removeDoc(studentId: string, id: string) {
  await sb!.storage.from(BUCKET_DOCS).remove([docPath(studentId, id)])
}

// ─── Sebehodnocení žáka (bez přihlášení, jen přes kód) ───────────────────────

export async function selfFormForCode(code: string) {
  const { data, error } = await sb!.rpc('self_form_for_code', { p_code: code })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}
export async function submitSelf(code: string, answers: unknown, form: unknown) {
  const { data, error } = await sb!.rpc('submit_self_assessment', { p_code: code, p_answers: answers, p_form: form })
  if (error) throw new Error(error.message)
  return data as boolean
}
export async function uploadStudentFile(code: string, file: File) {
  const body = new FormData()
  body.append('code', code)
  body.append('file', file)
  const r = await fetch(`${SUPABASE_URL}/functions/v1/zak-priloha`, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, body })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Soubor se nepodařilo nahrát.')
  return j as { id: string; name: string; size: number; type: string; assessmentId: string }
}

// ─── Vedení školy ────────────────────────────────────────────────────────────

export async function managementStats(from: string, to: string) {
  const { data, error } = await sb!.rpc('management_stats', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return data as { class_name: string; school_type: string; subject_name: string; records: number; with_feedback: number; goals: number; goals_done: number; self_assessed: number; approved_summaries: number; pupils: number; reached: number }[]
}
