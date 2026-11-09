import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Lightbulb, Printer, Search, ThumbsUp, TriangleAlert } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { criteriaFor } from '../lib/store'
import { criterionSeries, studentAssessments } from '../lib/analysis'
import { inRange, periodFor, today } from '../lib/dates'
import { Button, Card, Empty, Input, LevelBadge, PageHeader, Select, Tabs } from '../components/ui'

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

  // #9: průměrná úroveň a vývoj u každé dovednosti napříč třídou (jen poslední úroveň každého žáka v období).
  const skillStats = all
    .map((c) => {
      const levels: number[] = []
      let down = 0
      for (const s of students) {
        const pts = criterionSeries(studentAssessments(db, s.id, subj.id).filter((a) => inRange(a.date, per.from, per.to)), c.id)
        const last = pts.at(-1)
        if (!last) continue
        levels.push(last.level)
        if (pts.length > 1 && last.level > pts[0].level) down++
      }
      return { c, n: levels.length, avg: levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null, down }
    })
    .filter((s) => s.n > 0)
  const ranked = [...skillStats].sort((a, b) => (a.avg! - b.avg!))
  const best = ranked.slice(0, 3)
  const worst = [...ranked].reverse().slice(0, 3)
  const classAvg = skillStats.length ? skillStats.reduce((a, b) => a + b.avg!, 0) / skillStats.length : null
  // Na co se zaměřit: nejslabší dovednosti (průměr ≥ 3) a dovednosti s poklesem u více žáků.
  const focus = [
    ...worst.filter((s) => s.avg! >= 3).map((s) => `Procvičit „${s.c.name.toLowerCase()}“ – třída ji zvládá zatím slabě (průměr ${s.avg!.toFixed(1)}).`),
    ...skillStats.filter((s) => s.down >= 2).map((s) => `Zopakovat „${s.c.name.toLowerCase()}“ – u ${s.down} žáků úroveň klesla.`),
  ]
  const focusUnique = [...new Set(focus)].slice(0, 4)

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={28} />}
        title="Přehled třídy"
        subtitle={`${cls?.name} · ${subj.name} · ${per.label}. Buňka ukazuje poslední úroveň v období a změnu od prvního záznamu v něm.`}
        actions={<a href="#/tisk/trida" target="_blank" rel="noreferrer"><Button><Printer size={16} /> Tisk / PDF třídy</Button></a>}
      />
      {skillStats.length > 0 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Card title={<span className="inline-flex items-center gap-2"><ThumbsUp size={17} className="text-good" /> Nejlépe zvládnuté</span>} className="min-w-0">
            <ul className="flex flex-col gap-2">
              {best.map((s) => (
                <li key={s.c.id} className="flex items-center gap-2 text-sm">
                  <LevelBadge level={Math.round(s.avg!) as 1 | 2 | 3 | 4 | 5} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.c.name}</span>
                  <span className="tabular text-xs text-ink-faint">⌀ {s.avg!.toFixed(1)}</span>
                </li>
              ))}
            </ul>
            {classAvg != null && <p className="mt-3 text-xs text-ink-faint">Průměr celé třídy napříč dovednostmi: ⌀ {classAvg.toFixed(1)} (1 = výborně).</p>}
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><TriangleAlert size={17} className="text-bad" /> Nejméně zvládnuté</span>} className="min-w-0">
            <ul className="flex flex-col gap-2">
              {worst.map((s) => (
                <li key={s.c.id} className="flex items-center gap-2 text-sm">
                  <LevelBadge level={Math.round(s.avg!) as 1 | 2 | 3 | 4 | 5} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.c.name}</span>
                  <span className="tabular text-xs text-ink-faint">⌀ {s.avg!.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><Lightbulb size={17} className="text-sea-600" /> Na co se při výuce zaměřit</span>} className="min-w-0">
            {focusUnique.length === 0 ? (
              <p className="text-sm text-ink-faint">Třída zvládá vybrané dovednosti dobře, žádná výrazná slabina.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-ink-soft">
                {focusUnique.map((f) => <li key={f} className="flex gap-2"><span className="text-sea-600">•</span>{f}</li>)}
              </ul>
            )}
          </Card>
        </div>
      )}
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
                      const diff = pts.length > 1 ? pts[0].level - last!.level : 0
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
        <p className="mt-3 text-xs text-ink-faint">Úroveň 1 = výborně … 5 = zatím nezvládá, – = nehodnoceno · ↑ zlepšení · ↓ potřebuje víc podpory · Cíle: splněné / stanovené v období. Přehled slouží k plánování podpory, ne k pořadí žáků.</p>
      </Card>
    </>
  )
}
