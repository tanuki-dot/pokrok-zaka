import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, FolderOpen, MessageSquarePlus, Target, Trash2 } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { setAttachmentMeta, removeAttachment } from '../lib/store'
import { periodLabel } from '../lib/periods'
import { downloadFile, fileKind, fmtSize, openFile } from '../lib/files'
import { fullName } from '../lib/util'
import { fmt } from '../lib/dates'
import type { Assessment, Attachment } from '../lib/types'
import { Thumb } from '../components/Attachments'
import { Card, cx, Empty, PageHeader, Pill, Select, Tabs } from '../components/ui'

/** Jedna práce v portfoliu: náhled, komentář učitele a propojení s cíli hodnocení (#8). */
function WorkItem({ f, assessment }: { f: Attachment; assessment: Assessment }) {
  const [note, setNote] = useState(f.note ?? '')
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const linked = f.goalIds ?? []
  const toggleGoal = (gid: string) => setAttachmentMeta(f.id, { goalIds: linked.includes(gid) ? linked.filter((x) => x !== gid) : [...linked, gid] })

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-start">
      <Thumb file={f} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold">{f.name}</span>
          <Pill tone={f.owner === 'zak' ? 'brand' : 'sea'}>{f.owner === 'zak' ? 'žák' : 'učitel'}</Pill>
          <span className="text-xs text-ink-faint">{fileKind(f.type, f.name)} · {fmtSize(f.size)}</span>
          <span className="ml-auto flex items-center gap-1">
            <button className="rounded-lg p-1.5 text-ink-soft hover:bg-sea-50 hover:text-sea-700" aria-label={`Otevřít ${f.name}`} onClick={() => openFile(f).catch((e) => setErr(e.message))}><ExternalLink size={16} /></button>
            <button className="rounded-lg p-1.5 text-ink-soft hover:bg-sea-50 hover:text-sea-700" aria-label={`Stáhnout ${f.name}`} onClick={() => downloadFile(f, f.name).catch((e) => setErr(e.message))}><Download size={16} /></button>
            {confirm ? (
              <span className="flex items-center gap-1.5 text-xs">
                <button className="font-semibold text-bad" onClick={() => { void removeAttachment(f.id); setConfirm(false) }}>smazat</button>
                <button className="text-ink-faint" onClick={() => setConfirm(false)}>zpět</button>
              </span>
            ) : (
              <button className="rounded-lg p-1.5 text-ink-soft hover:bg-bad-wash hover:text-bad" aria-label={`Odstranit ${f.name}`} onClick={() => setConfirm(true)}><Trash2 size={16} /></button>
            )}
          </span>
        </div>

        {/* Komentář učitele */}
        {editing || note ? (
          <input
            aria-label={`Komentář k práci ${f.name}`}
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-sea-500 focus:outline-none"
            placeholder="Krátký komentář učitele k práci"
            value={note}
            autoFocus={editing}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { setAttachmentMeta(f.id, { note: note.trim() }); setEditing(false) }}
          />
        ) : (
          <button className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sea-600" onClick={() => setEditing(true)}>
            <MessageSquarePlus size={15} /> Přidat komentář
          </button>
        )}

        {/* Propojení s cíli hodnocení */}
        {assessment.goals.length > 0 && (
          <div className="mt-2">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-faint"><Target size={13} /> Propojit s cíli</div>
            <div className="flex flex-wrap gap-1.5">
              {assessment.goals.map((g) => {
                const on = linked.includes(g.id)
                return (
                  <button
                    key={g.id}
                    aria-pressed={on}
                    onClick={() => toggleGoal(g.id)}
                    className={cx('rounded-full border px-2.5 py-1 text-left text-xs font-semibold', on ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line text-ink-soft hover:text-ink')}
                    title={g.text}
                  >
                    {g.text.length > 48 ? g.text.slice(0, 46) + '…' : g.text}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {err && <p role="alert" className="mt-1 text-sm text-bad">{err}</p>}
      </div>
    </li>
  )
}

/** Portfolio a přílohy (pokrokveskole.docx, snímek 6D): práce žáků podle předmětu a data. */
export default function Portfolio() {
  const { db, cls, subj, students } = useCtx()
  const [studentId, setStudentId] = useState('')
  const [order, setOrder] = useState<'datum' | 'predmet'>('datum')
  const classSubjects = db.subjects.filter((p) => p.classId === cls?.id)
  const ids = new Set((studentId ? students.filter((s) => s.id === studentId) : students).map((s) => s.id))

  const groups = db.assessments
    .filter((a) => ids.has(a.studentId) && (order === 'predmet' ? classSubjects.some((p) => p.id === a.subjectId) : a.subjectId === subj?.id))
    .map((a) => ({ a, files: db.attachments.filter((x) => x.assessmentId === a.id) }))
    .filter((g) => g.files.length)
    .sort((x, y) =>
      order === 'predmet'
        ? (db.subjects.find((p) => p.id === x.a.subjectId)?.name ?? '').localeCompare(db.subjects.find((p) => p.id === y.a.subjectId)?.name ?? '', 'cs') || y.a.date.localeCompare(x.a.date)
        : y.a.date.localeCompare(x.a.date),
    )

  return (
    <>
      <PageHeader
        icon={<FolderOpen size={28} />}
        title="Portfolio a přílohy"
        subtitle={`Práce žáků, fotografie, dokumenty, pracovní listy a prezentace. Přidejte komentář a propojte práci s vzdělávacími cíli. Třída ${cls?.name ?? '–'}.`}
        actions={<Tabs value={order} onChange={setOrder} options={[{ value: 'datum', label: `${subj?.name ?? 'Předmět'} · podle data` }, { value: 'predmet', label: 'Všechny předměty' }]} />}
      />
      <Card>
        <div className="mb-4 max-w-xs">
          <Select id="p-zak" aria-label="Žák" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Všichni žáci</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
          </Select>
        </div>
        {groups.length === 0 ? (
          <Empty title="Zatím žádné přílohy">Přílohy přidáte v hodnocení (krok Hodnocení učitele) nebo je přiloží žák k sebehodnocení. Lze nahrát více souborů najednou.</Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map(({ a, files }) => {
              const st = db.students.find((s) => s.id === a.studentId)
              const sp = db.subjects.find((p) => p.id === a.subjectId)
              return (
                <li key={a.id} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">{st ? fullName(st) : '–'}</span>
                    <span className="text-sm text-ink-soft">{sp?.name} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)} · {fmt(a.date)}</span>
                    <Link to={`/hodnoceni/${a.id}`} className="ml-auto text-sm font-semibold text-sea-600">Otevřít hodnocení</Link>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {files.map((f) => <WorkItem key={f.id} f={f} assessment={a} />)}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-faint">V testovacím provozu jsou soubory uložené jen v tomto prohlížeči. Pro ostrý provoz patří do zabezpečeného úložiště školy.</p>
      </Card>
    </>
  )
}
