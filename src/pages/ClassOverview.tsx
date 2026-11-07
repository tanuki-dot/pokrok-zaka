import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Search } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { criteriaFor } from '../lib/store'
import { criterionSeries, studentAssessments } from '../lib/analysis'
import { inRange, periodFor, today } from '../lib/dates'
import { Card, Empty, Input, LevelBadge, PageHeader, Select, Tabs } from '../components/ui'

type P = 'tyden' | 'mesic' | 'pololeti' | 'vse'

export default function ClassOverview() {
  const { db, cls, subj, students } = useCtx()
  const [period, setPeriod] = useState<P>('mesic')
  const [q, setQ] = useState('')
  const [crit, setCrit] = useState('')
  if (!subj) return <Empty title="Vyberte předmět" />

  const per = period === 'vse' ? { from: '0000-01-01', to: '9999-12-31', label: 'celé období' } : periodFor(period, today())
  const all = criteriaFor(db, subj.id)
  const criteria = crit ? all.filter((c) => c.id === crit) : all
  const list = students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={28} />}
        title="Přehled třídy"
        subtitle={`${cls?.name} · ${subj.name} · ${per.label}. Buňka ukazuje poslední úroveň v období a změnu od prvního záznamu v něm.`}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs<P>
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'tyden', label: 'Týden' },
              { value: 'mesic', label: 'Měsíc' },
              { value: 'pololeti', label: 'Pololetí' },
              { value: 'vse', label: 'Vše' },
            ]}
          />
          <Select id="filtr-dovednost" aria-label="Dovednost" className="w-auto" value={crit} onChange={(e) => setCrit(e.target.value)}>
            <option value="">Všechny dovednosti</option>
            {all.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="relative ml-auto w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input id="filtr-zak" className="pl-9" placeholder="Hledat žáka" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="sticky left-0 z-10 border-b border-line bg-surface py-2 pr-3 font-semibold">Žák</th>
                {criteria.map((c) => <th key={c.id} className="border-b border-line px-2 py-2 text-center font-semibold">{c.name}</th>)}
                <th className="border-b border-line px-2 py-2 text-center font-semibold">Záznamy</th>
                <th className="border-b border-line px-2 py-2 text-center font-semibold">Cíle</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const as = studentAssessments(db, s.id, subj.id).filter((a) => inRange(a.date, per.from, per.to))
                const goals = db.goals.filter((g) => g.studentId === s.id && g.subjectId === subj.id && inRange(g.setOn, per.from, per.to))
                return (
                  <tr key={s.id} className="hover:bg-canvas/70">
                    <td className="sticky left-0 border-b border-line bg-surface py-2 pr-3">
                      <Link to={`/zaci/${s.id}`} className="font-semibold hover:text-sea-600">{s.lastName} {s.firstName}</Link>
                    </td>
                    {criteria.map((c) => {
                      const pts = criterionSeries(as, c.id)
                      const last = pts.at(-1)
                      const diff = pts.length > 1 ? last!.level - pts[0].level : 0
                      return (
                        <td key={c.id} className="border-b border-line px-2 py-2 text-center">
                          <span className="inline-flex items-center gap-1">
                            <LevelBadge level={last?.level} size="sm" />
                            {diff !== 0 && (
                              <span className={diff > 0 ? 'text-xs font-bold text-good' : 'text-xs font-bold text-bad'} title={diff > 0 ? 'zlepšení' : 'potřebuje víc podpory'}>
                                {diff > 0 ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </td>
                      )
                    })}
                    <td className="tabular border-b border-line px-2 py-2 text-center">{as.length}</td>
                    <td className="tabular border-b border-line px-2 py-2 text-center">
                      {goals.length ? `${goals.filter((g) => g.status === 'splneny').length}/${goals.length}` : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">Úroveň 1 = nejnižší, 5 = nejvyšší, – = nehodnoceno · ↑ zlepšení · ↓ potřebuje víc podpory · Cíle: splněné / stanovené v období. Přehled slouží k plánování podpory, ne k pořadí žáků.</p>
      </Card>
    </>
  )
}
