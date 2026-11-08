import { useState } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, Pencil, Search } from 'lucide-react'
import { useDB } from '../lib/store'
import { PERIOD_LABEL, periodLabel } from '../lib/periods'
import { fmt } from '../lib/dates'
import { fullName } from '../lib/util'
import type { PeriodType } from '../lib/types'
import { Card, Empty, Input, PageHeader, Pill, Select } from '../components/ui'

/** Historie hodnocení (pokrokveskole.docx, snímek 6A): vyhledávání a filtry, otevření a oprava. */
export default function History() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [ptype, setPtype] = useState<'' | PeriodType>('')
  const [status, setStatus] = useState('')

  const subjectNames = [...new Set(db.subjects.map((s) => s.name))].sort((a, b) => a.localeCompare(b, 'cs'))
  const rows = db.assessments
    .map((a) => {
      const st = db.students.find((s) => s.id === a.studentId)
      const subj = db.subjects.find((s) => s.id === a.subjectId)
      const cls = db.classes.find((c) => c.id === st?.classId)
      return { a, st, subj, cls }
    })
    .filter(({ a, st, subj, cls }) =>
      (!q.trim() || (st && fullName(st).toLowerCase().includes(q.trim().toLowerCase()))) &&
      (!classId || cls?.id === classId) &&
      (!subjectName || subj?.name === subjectName) &&
      (!ptype || a.periodType === ptype) &&
      (!status || a.status === status),
    )
    .sort((x, y) => y.a.date.localeCompare(x.a.date) || y.a.updatedAt.localeCompare(x.a.updatedAt))

  return (
    <>
      <PageHeader icon={<HistoryIcon size={28} />} title="Historie hodnocení" subtitle="Všechna uložená hodnocení. Otevřete je, opravte nebo doplňte." />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input id="h-hledat" className="pl-9" placeholder="Hledat žáka" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Hledat žáka" />
          </div>
          <Select id="h-trida" aria-label="Třída" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Všechny třídy</option>
            {db.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select id="h-predmet" aria-label="Předmět" value={subjectName} onChange={(e) => setSubjectName(e.target.value)}>
            <option value="">Všechny předměty</option>
            {subjectNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select id="h-obdobi" aria-label="Hodnocené období" value={ptype} onChange={(e) => setPtype(e.target.value as '' | PeriodType)}>
            <option value="">Všechna období</option>
            {(Object.keys(PERIOD_LABEL) as PeriodType[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
          </Select>
          <Select id="h-stav" aria-label="Stav" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Dokončená i rozpracovaná</option>
            <option value="dokoncene">Dokončená</option>
            <option value="rozpracovane">Rozpracovaná</option>
          </Select>
        </div>
        <p className="mb-2 text-sm text-ink-faint">{rows.length} hodnocení</p>
        {rows.length === 0 ? (
          <Empty title="Žádné hodnocení neodpovídá filtrům" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-semibold">Datum</th>
                  <th className="py-2 pr-3 font-semibold">Žák</th>
                  <th className="py-2 pr-3 font-semibold">Třída · předmět</th>
                  <th className="py-2 pr-3 font-semibold">Období</th>
                  <th className="py-2 pr-3 font-semibold">Cíle</th>
                  <th className="py-2 pr-3 font-semibold">Stav</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 300).map(({ a, st, subj, cls }) => {
                  const met = a.goals.filter((g) => g.status === 'splneno').length
                  return (
                    <tr key={a.id} className="align-top">
                      <td className="tabular py-2.5 pr-3">{fmt(a.date)}</td>
                      <td className="py-2.5 pr-3">{st ? <Link to={`/zaci/${st.id}`} className="font-semibold hover:text-sea-600">{st.lastName} {st.firstName}</Link> : '–'}</td>
                      <td className="py-2.5 pr-3">{cls?.name} · {subj?.name}</td>
                      <td className="py-2.5 pr-3">{periodLabel(a.periodType, a.periodFrom, a.periodTo)}</td>
                      <td className="tabular py-2.5 pr-3">{a.goals.length ? `${met}/${a.goals.length} splněno` : '–'}</td>
                      <td className="py-2.5 pr-3"><Pill tone={a.status === 'dokoncene' ? 'good' : 'warn'}>{a.status === 'dokoncene' ? 'dokončeno' : 'rozpracováno'}</Pill></td>
                      <td className="py-2.5 text-right">
                        <Link to={`/hodnoceni/${a.id}`} className="inline-flex items-center gap-1 font-semibold text-sea-600"><Pencil size={14} /> Otevřít</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
