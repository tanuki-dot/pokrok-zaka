import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { periodLabel } from '../lib/periods'
import { fmt } from '../lib/dates'
import { fullName } from '../lib/util'
import { AttachmentList } from '../components/Attachments'
import { Card, Empty, PageHeader, Select, Tabs } from '../components/ui'

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
        subtitle={`Práce žáků, fotografie, dokumenty, pracovní listy a prezentace přiřazené ke konkrétním hodnocením. Třída ${cls?.name ?? '–'}.`}
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
          <Empty title="Zatím žádné přílohy">Přílohy přidáte v hodnocení (krok Hodnocení učitele) nebo je přiloží žák k sebehodnocení.</Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map(({ a, files }) => {
              const st = db.students.find((s) => s.id === a.studentId)
              const sp = db.subjects.find((p) => p.id === a.subjectId)
              return (
                <li key={a.id} className="rounded-2xl border border-line p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">{st ? fullName(st) : '–'}</span>
                    <span className="text-sm text-ink-soft">{sp?.name} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)} · {fmt(a.date)}</span>
                    <Link to={`/hodnoceni/${a.id}`} className="ml-auto text-sm font-semibold text-sea-600">Otevřít hodnocení</Link>
                  </div>
                  <AttachmentList items={files} canDelete />
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
