import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Assessment, DB, SelfAnswers } from '../lib/types'
import { fmt, fmtShort, inRange, periodFor, today } from '../lib/dates'
import { describeSelf } from '../lib/questionnaire'
import { Card, Pill, Tabs } from './ui'
import { TOOLTIP_STYLE } from './chartStyle'

type P = 'mesic' | 'pololeti' | 'vse'
const GOAL_NUM: Record<SelfAnswers['goalMet'], number> = { ano: 3, castecne: 2, zatimne: 1 }

/** Historie a trend sebehodnocení jednoho žáka (subjektivní pohled žáka). */
export function SelfHistory({ db, assessments, className }: { db: DB; assessments: Assessment[]; className?: string }) {
  const [period, setPeriod] = useState<P>('pololeti')
  const per = period === 'vse' ? { from: '0000-01-01', to: '9999-12-31' } : periodFor(period, today())
  const rows = assessments
    .filter((a) => inRange(a.date, per.from, per.to))
    .map((a) => ({ a, s: db.selfAssessments.find((x) => x.assessmentId === a.id) }))
    .filter((x) => x.s)
  const fresh = rows.filter((x) => x.s!.answers)
  const data = fresh.map(({ a, s }) => ({
    date: a.date,
    'Porozumění': s!.answers!.understanding,
    'Samostatnost': s!.answers!.work,
    'Splnění cíle': GOAL_NUM[s!.answers!.goalMet],
  }))

  return (
    <Card
      title="Sebehodnocení žáka"
      className={className}
      action={<Tabs<P> value={period} onChange={setPeriod} options={[{ value: 'mesic', label: 'Měsíc' }, { value: 'pololeti', label: 'Pololetí' }, { value: 'vse', label: 'Vše' }]} />}
    >
      <p className="mb-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">
        Jde o subjektivní sebehodnocení žáka – ukazuje, jak své učení vnímá, ne jak ho hodnotí učitel.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">V tomto období žák sebehodnocení nevyplnil.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            {data.length >= 2 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => fmtShort(d)} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => fmt(String(d))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Porozumění" stroke="var(--color-sea-500)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Samostatnost" stroke="var(--color-brand-500)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Splnění cíle" stroke="var(--color-lv5)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Pro graf trendu jsou potřeba aspoň dvě odpovědi v novém dotazníku.</p>
            )}
            <p className="mt-1 text-xs text-ink-faint">Vlastní pohled žáka (3 stupně, ne škála učitele): 3 = rozumím / samostatně / cíle splněny · 2 = většinou / občas pomoc / částečně · 1 = zatím ne / častá pomoc</p>
          </div>
          <ul className="flex min-w-0 flex-col divide-y divide-line text-sm">
            {[...rows].reverse().slice(0, 6).map(({ a, s }) => (
              <li key={s!.id} className="py-2">
                <div className="text-xs font-semibold text-ink-faint">{fmt(a.date)} · {a.topic}</div>
                {s!.answers ? (
                  (() => {
                    const d = describeSelf(s!)
                    return (
                      <>
                        <div>{d.understanding} {d.work}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Pill tone={s!.answers!.goalMet === 'ano' ? 'good' : s!.answers!.goalMet === 'castecne' ? 'warn' : 'bad'}>cíle: {d.goalMet.toLowerCase()}</Pill>
                          {d.nothingToImprove ? <Pill tone="good">nic zásadního zlepšovat</Pill> : d.improve.map((t) => <Pill key={t} className="whitespace-normal">{t.replace(/\.$/, '')}</Pill>)}
                        </div>
                        {d.nextWish && <div className="mt-1 text-ink-soft">„{d.nextWish}“</div>}
                      </>
                    )
                  })()
                ) : (
                  <div className="text-ink-soft">{[s!.wentWell, s!.needHelp].filter(Boolean).join(' · ') || 'Starší formát odpovědí.'}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
