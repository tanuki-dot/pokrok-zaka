import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Search } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { criterionSeries, studentAssessments } from '../lib/analysis'
import { fmt } from '../lib/dates'
import { Card, Empty, Input, LevelBadge, PageHeader, Pill } from '../components/ui'
import { Spark } from '../components/ProgressChart'

export default function Students() {
  const { db, cls, subj, students } = useCtx()
  const [q, setQ] = useState('')
  const list = students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <PageHeader icon={<GraduationCap size={28} />} title="Žáci a pokrok" subtitle={`Třída ${cls?.name ?? '–'} · ${subj?.name ?? '–'}. Žáka porovnáváme s jeho vlastním dřívějším výkonem, ne se spolužáky.`} />
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input id="hledat-zaka" className="pl-9" placeholder="Hledat žáka" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {list.length === 0 ? (
          <Empty title="Žádný žák">Přidejte žáky v sekci Třídy a žáci.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const as = subj ? studentAssessments(db, s.id, subj.id) : []
              const last = as.at(-1)
              const samo = criterionSeries(as, 'k-samostatnost')
              const open = db.goals.filter((g) => g.studentId === s.id && g.subjectId === subj?.id && g.status === 'rozpracovany').length
              return (
                <li key={s.id}>
                  <Link to={`/zaci/${s.id}`} className="flex h-full flex-col gap-3 rounded-2xl border border-line p-4 transition-colors hover:border-sea-500">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sea-50 font-bold text-sea-700">
                        {s.firstName[0]}{s.lastName[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{s.firstName} {s.lastName}</div>
                        <div className="text-xs text-ink-faint">{last ? `poslední záznam ${fmt(last.date)}` : 'zatím bez záznamu'}</div>
                      </div>
                      <Spark points={samo} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Pill>{as.length} záznamů</Pill>
                      {open > 0 && <Pill tone="sea">{open} {open === 1 ? 'cíl' : open < 5 ? 'cíle' : 'cílů'} rozpracováno</Pill>}
                      {samo.length > 0 && (
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-faint">samostatnost <LevelBadge size="sm" level={samo.at(-1)!.level} /></span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
