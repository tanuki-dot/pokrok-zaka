import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { School } from 'lucide-react'
import { useDB } from '../lib/store'
import { addDays, fmtShort, inRange, periodFor, today, weekStart } from '../lib/dates'
import { Card, PageHeader, Tabs } from '../components/ui'
import { TOOLTIP_STYLE } from '../components/chartStyle'

/*
 * KROK 10 – vedení školy vidí jen souhrnná čísla: zda učitelé dávají průběžnou
 * zpětnou vazbu, stanovují cíle a sledují pokrok. Žádná jména ani úrovně žáků.
 */

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–')

export default function Management() {
  const db = useDB()
  const [p, setP] = useState<'mesic' | 'pololeti'>('pololeti')
  const per = periodFor(p, today())

  const rows = db.subjects.map((s) => {
    const cls = db.classes.find((c) => c.id === s.classId)
    const school = db.schools.find((x) => x.id === cls?.schoolId)
    const as = db.assessments.filter((a) => a.subjectId === s.id && inRange(a.date, per.from, per.to))
    const fb = as.filter((a) => a.feedback.good.trim() && a.feedback.next.trim())
    const goals = db.goals.filter((g) => g.subjectId === s.id && inRange(g.setOn, per.from, per.to))
    const self = db.selfAssessments.filter((x) => as.some((a) => a.id === x.assessmentId))
    const sums = db.summaries.filter((x) => x.subjectId === s.id && x.status === 'schvaleno' && inRange(x.to, per.from, per.to))
    const pupils = db.students.filter((x) => x.classId === s.classId).length
    const reached = new Set(as.map((a) => a.studentId)).size
    return { id: s.id, label: `${cls?.name} · ${s.name}`, school: school?.type === 'ZS' ? 'ZŠ' : 'SŠ', as: as.length, fb: fb.length, goals: goals.length, done: goals.filter((g) => g.status === 'splneny').length, self: self.length, sums: sums.length, pupils, reached }
  })

  const total = rows.reduce(
    (t, r) => ({ as: t.as + r.as, fb: t.fb + r.fb, goals: t.goals + r.goals, done: t.done + r.done, self: t.self + r.self }),
    { as: 0, fb: 0, goals: 0, done: 0, self: 0 },
  )

  const mon = weekStart(today())
  const weeks = Array.from({ length: 10 }, (_, i) => addDays(mon, -7 * (9 - i)))
  const chart = weeks.map((w) => {
    const as = db.assessments.filter((a) => weekStart(a.date) === w)
    return {
      week: w,
      'Záznamy se zpětnou vazbou': as.filter((a) => a.feedback.good.trim() && a.feedback.next.trim()).length,
      'Stanovené cíle': db.goals.filter((g) => weekStart(g.setOn) === w).length,
    }
  })

  const tiles = [
    { label: 'Záznamy hodnocení', value: total.as, note: per.label },
    { label: 'Se zpětnou vazbou', value: pct(total.fb, total.as), note: 'co se povedlo + další krok' },
    { label: 'Stanovené cíle', value: total.goals, note: `splněno ${pct(total.done, total.goals)}` },
    { label: 'Zapojení žáků', value: pct(total.self, total.as), note: 'záznamů se sebehodnocením' },
  ]

  return (
    <>
      <PageHeader
        icon={<School size={28} />}
        title="Vedení školy"
        subtitle="Souhrnné informace o používání průběžné zpětné vazby, stanovování cílů a sledování pokroku. Bez přístupu k jednotlivým žákům."
        actions={<Tabs value={p} onChange={setP} options={[{ value: 'mesic', label: 'Tento měsíc' }, { value: 'pololeti', label: 'Pololetí' }]} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="text-sm font-semibold text-ink-soft">{t.label}</div>
            <div className="tabular mt-1 font-display text-[32px] font-bold leading-tight">{t.value}</div>
            <div className="text-xs text-ink-faint">{t.note}</div>
          </Card>
        ))}
      </div>

      <Card title="Vývoj po týdnech (celá škola)" className="mt-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="week" tickFormatter={(w: string) => fmtShort(w)} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--color-muted)' }} labelFormatter={(w) => `Týden od ${fmtShort(String(w))}`} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Záznamy se zpětnou vazbou" fill="var(--color-sea-500)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Stanovené cíle" fill="var(--color-brand-500)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={`Třídy a předměty · ${per.label}`} className="mt-4">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-semibold">Třída · předmět</th>
                <th className="py-2 pr-3 font-semibold">Škola</th>
                <th className="py-2 pr-3 text-right font-semibold">Záznamy</th>
                <th className="py-2 pr-3 text-right font-semibold">Žáci se záznamem</th>
                <th className="py-2 pr-3 text-right font-semibold">Se zpětnou vazbou</th>
                <th className="py-2 pr-3 text-right font-semibold">Cíle (splněno)</th>
                <th className="py-2 pr-3 text-right font-semibold">Sebehodnocení</th>
                <th className="py-2 text-right font-semibold">Schválené souhrny</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-3 font-semibold">{r.label}</td>
                  <td className="py-2.5 pr-3">{r.school}</td>
                  <td className="py-2.5 pr-3 text-right">{r.as}</td>
                  <td className="py-2.5 pr-3 text-right">{r.reached} / {r.pupils}</td>
                  <td className="py-2.5 pr-3 text-right">{pct(r.fb, r.as)}</td>
                  <td className="py-2.5 pr-3 text-right">{r.goals} ({pct(r.done, r.goals)})</td>
                  <td className="py-2.5 pr-3 text-right">{pct(r.self, r.as)}</td>
                  <td className="py-2.5 text-right">{r.sums}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">Přehled podporuje principy Kvalitní školy (výuka, vzdělávací výsledky, podpora žáků). Nenahrazuje hodnoticí systém České školní inspekce.</p>
      </Card>
    </>
  )
}
