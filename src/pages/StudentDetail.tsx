import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ClipboardPen, FileText, Pencil, UserCheck } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { setSelection } from '../lib/selection'
import { setGoalStatus, setSchoolType } from '../lib/store'
import { criterionSeries, GOAL_STATUS_LABEL, LEVELS, studentAssessments, trendWord, weeklyLevels } from '../lib/analysis'
import { allCriteriaFor } from '../lib/util'
import { periodLabel } from '../lib/periods'
import { MONTHS } from '../lib/periods'
import { SelfHistory } from '../components/SelfHistory'
import { fmt, fmtShort, KIND_LABEL } from '../lib/dates'
import type { Assessment, DB, GoalStatus } from '../lib/types'
import { Button, Card, cx, Empty, LevelBadge, PageHeader, Pill } from '../components/ui'
import { StudentDocuments } from '../components/StudentDocuments'
import { ProgressChart } from '../components/ProgressChart'
import { TOOLTIP_STYLE } from '../components/chartStyle'

const GOAL_LABEL: Record<GoalStatus, string> = { rozpracovany: 'Rozpracováno', splneny: 'Splněno', nesplneny: 'Zatím nesplněno' }
const LINE_COLORS = ['var(--color-sea-500)', 'var(--color-orange)', 'var(--color-blue)', 'var(--color-lv1)', 'var(--color-bad)', 'var(--color-warn)', 'var(--color-ink-soft)']
const axis = { fontSize: 12, fill: 'var(--color-ink-faint)' }

/** Porovnání výsledků v čase: všechny hodnocené dovednosti (jen ohodnocené body). */
function CompareSkills({ as, crits }: { as: Assessment[]; crits: { id: string; name: string }[] }) {
  const used = crits.filter((c) => as.some((a) => a.scores[c.id])).slice(0, 7)
  const data = as.filter((a) => Object.keys(a.scores).length).map((a) => ({ date: a.date, ...Object.fromEntries(used.map((c) => [c.name, a.scores[c.id] ?? null])) }))
  if (data.length < 2) return <p className="text-sm text-ink-faint">Pro porovnání jsou potřeba aspoň dvě hodnocení.</p>
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtShort(d)} tick={axis} axisLine={false} tickLine={false} />
          <YAxis reversed domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => fmt(String(d))} formatter={(v, n) => [v ? `${v} – ${LEVELS[Number(v) - 1].name}` : 'nehodnoceno', n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {used.map((c, i) => (
            // connectNulls: nehodnocené body se přeskočí, nekreslí se jako nejnižší hodnota
            <Line key={c.id} type="monotone" dataKey={c.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Přehled splnění vzdělávacích cílů po měsících. */
function GoalsChart({ as }: { as: Assessment[] }) {
  const byMonth = new Map<string, { m: string; Splněno: number; Částečně: number; Nesplněno: number }>()
  for (const a of as)
    for (const g of a.goals) {
      if (!g.status) continue
      const key = a.date.slice(0, 7)
      const row = byMonth.get(key) ?? { m: key, Splněno: 0, Částečně: 0, Nesplněno: 0 }
      row[g.status === 'splneno' ? 'Splněno' : g.status === 'castecne' ? 'Částečně' : 'Nesplněno']++
      byMonth.set(key, row)
    }
  const data = [...byMonth.values()].sort((a, b) => a.m.localeCompare(b.m))
  if (!data.length) return <p className="text-sm text-ink-faint">Zatím nejsou označená splnění cílů.</p>
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="m" tickFormatter={(m: string) => MONTHS[+m.slice(5, 7) - 1]} tick={axis} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--color-muted)' }} labelFormatter={(m) => `${MONTHS[+String(m).slice(5, 7) - 1]} ${String(m).slice(0, 4)}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Splněno" stackId="g" fill="var(--color-lv1)" isAnimationActive={false} />
          <Bar dataKey="Částečně" stackId="g" fill="var(--color-lv3)" isAnimationActive={false} />
          <Bar dataKey="Nesplněno" stackId="g" fill="var(--color-lv5)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Hodnocení učitele (porozumění učivu, 1–5) a vlastní pohled žáka (3 stupně) – dvě oddělené osy. */
function TeacherVsSelf({ db, as }: { db: DB; as: Assessment[] }) {
  const data = as
    .map((a) => {
      const self = db.selfAssessments.find((s) => s.assessmentId === a.id)?.answers
      return { date: a.date, 'Učitel – porozumění učivu': a.scores['k-znalosti'] ?? null, 'Pohled žáka': self?.understanding ?? null }
    })
    .filter((x) => x['Učitel – porozumění učivu'] !== null || x['Pohled žáka'] !== null)
  if (!data.some((x) => x['Pohled žáka'] !== null)) return <p className="text-sm text-ink-faint">Žák zatím sebehodnocení nevyplnil.</p>
  const selfTick = (v: number) => (v === 3 ? 'rozumím' : v === 2 ? 'většině' : 'zatím ne')
  return (
    <>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtShort(d)} tick={axis} axisLine={false} tickLine={false} />
            <YAxis yAxisId="u" reversed domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={axis} axisLine={false} tickLine={false} />
            <YAxis yAxisId="z" orientation="right" domain={[0.5, 3.5]} ticks={[1, 2, 3]} tickFormatter={selfTick} tick={axis} axisLine={false} tickLine={false} width={64} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => fmt(String(d))} formatter={(v, n) => [n === 'Pohled žáka' ? selfTick(Number(v)) : `${v} – ${LEVELS[Number(v) - 1]?.name ?? ''}`, n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="u" type="monotone" dataKey="Učitel – porozumění učivu" stroke="var(--color-sea-500)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            <Line yAxisId="z" type="monotone" dataKey="Pohled žáka" stroke="var(--color-orange)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-faint">Levá osa: hodnocení učitele (1 = výborně). Pravá osa: vlastní pohled žáka ze sebehodnocení, zobrazený zvlášť, nejde o objektivní číselné hodnocení.</p>
    </>
  )
}

export default function StudentDetail() {
  const { id } = useParams()
  const { db, subj } = useCtx()
  const st = db.students.find((s) => s.id === id)

  useEffect(() => {
    if (st && db.subjects.find((p) => p.id === subj?.id)?.classId !== st.classId) {
      const p = db.subjects.find((x) => x.classId === st.classId)
      const school = db.schools.find((s) => s.id === db.classes.find((c) => c.id === st.classId)?.schoolId)
      // Žák z jiného typu školy (ZŠ/SŠ): přepnout i typ školy, jinak by se nenašla jeho třída.
      if (school && school.type !== db.settings.schoolType) setSchoolType(school.type)
      setSelection({ classId: st.classId, subjectId: p?.id ?? '' })
    }
  }, [st, subj?.id, db])

  const as = st && subj ? studentAssessments(db, st.id, subj.id) : []
  const criteria = subj ? allCriteriaFor(db, subj.id) : []
  const withData = criteria.filter((c) => criterionSeries(as, c.id).length > 0)
  const [crit, setCrit] = useState('k-znalosti')
  const active = withData.find((c) => c.id === crit) ?? withData[0]

  if (!st) return <Empty title="Žák nenalezen" />
  const cls = db.classes.find((c) => c.id === st.classId)
  const goals = db.goals.filter((g) => g.studentId === st.id && g.subjectId === subj?.id).sort((a, b) => b.setOn.localeCompare(a.setOn))
  const summaries = db.summaries.filter((s) => s.studentId === st.id && s.subjectId === subj?.id).sort((a, b) => b.from.localeCompare(a.from))
  const activeSeries = active ? weeklyLevels(criterionSeries(as, active.id)) : []
  const indep = criterionSeries(as, 'k-samostatnost')

  return (
    <>
      <Link to="/zaci" className="no-print mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Žáci</Link>
      <PageHeader
        title={`${st.firstName} ${st.lastName}`}
        subtitle={`Třída ${cls?.name} · ${subj?.name ?? '–'} · ${as.length} hodnocení. Žáka porovnáváme s jeho vlastním dřívějším výkonem.`}
        actions={
          <>
            <Link to={`/souhrny?zak=${st.id}`}><Button><FileText size={16} /> Vytvořit souhrn</Button></Link>
            <Link to={`/hodnoceni/nove?zak=${st.id}`}><Button variant="brand"><ClipboardPen size={16} /> Nové hodnocení</Button></Link>
          </>
        }
      />

      <div className="mb-4"><StudentDocuments studentId={st.id} /></div>

      {as.length === 0 ? (
        <Empty title="Zatím žádná hodnocení">V tomto předmětu žák ještě nebyl hodnocen.</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card title="Vývoj hodnocené dovednosti" className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Dovednost">
              {withData.map((c) => (
                <button key={c.id} role="tab" aria-selected={active?.id === c.id} onClick={() => setCrit(c.id)}
                  className={cx('rounded-full border px-3 py-1 text-sm font-semibold', active?.id === c.id ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line text-ink-soft hover:text-ink')}>
                  {c.name}
                </button>
              ))}
            </div>
            {active && <ProgressChart points={criterionSeries(as, active.id)} />}
            {activeSeries.length > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                <strong className="text-ink">{active?.name}: {activeSeries.map((p) => p.level).join(' → ')}</strong> = {trendWord(activeSeries[0].level, activeSeries.at(-1)!.level)}. Škála 1 = výborně … 5 = zatím nezvládá, zlepšení jde nahoru.
              </p>
            )}
          </Card>

          <Card title="Aktuální úroveň" className="min-w-0">
            <ul className="flex flex-col divide-y divide-line">
              {withData.map((c) => {
                const s = criterionSeries(as, c.id)
                const first = s[0]
                const last = s.at(-1)!
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <LevelBadge level={last.level} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{c.name}</div>
                      <div className="truncate text-xs text-ink-faint">{LEVELS[last.level - 1].name} · {fmtShort(last.date)}</div>
                    </div>
                    {s.length > 1 && (
                      <span className={cx('tabular text-xs font-semibold', last.level < first.level ? 'text-good' : last.level > first.level ? 'text-bad' : 'text-ink-faint')}>{first.level} → {last.level}</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">Nehodnocené dovednosti se nezobrazují ani nezapočítávají.</p>
          </Card>

          <Card title="Porovnání výsledků v čase" className="min-w-0 xl:col-span-2"><CompareSkills as={as} crits={criteria} /></Card>

          <Card title="Vývoj samostatnosti" className="min-w-0">
            {indep.length ? <ProgressChart points={indep} height={200} color="var(--color-orange)" /> : <p className="text-sm text-ink-faint">Samostatnost zatím nebyla hodnocena.</p>}
          </Card>
          <Card title="Přehled splnění vzdělávacích cílů" className="min-w-0"><GoalsChart as={as} /></Card>

          <Card title="Hodnocení učitele a sebehodnocení žáka" className="min-w-0 xl:col-span-2"><TeacherVsSelf db={db} as={as} /></Card>

          <Card title="Další cíle žáka" className="min-w-0">
            {goals.length === 0 ? (
              <p className="text-sm text-ink-faint">Zatím bez dalších cílů.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {goals.slice(0, 8).map((g) => (
                  <li key={g.id} className="rounded-xl border border-line p-3">
                    <div className="text-[15px] font-semibold">{g.text}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      stanoveno {fmt(g.setOn)}
                      <div className="ml-auto flex gap-1">
                        {(['rozpracovany', 'splneny', 'nesplneny'] as GoalStatus[]).map((s) => (
                          <button key={s} onClick={() => setGoalStatus(g.id, s)} aria-pressed={g.status === s}
                            className={cx('rounded-full border px-2 py-0.5 font-semibold', g.status === s ? (s === 'splneny' ? 'border-transparent bg-good-wash text-good' : s === 'nesplneny' ? 'border-transparent bg-orange-wash text-orange' : 'border-transparent bg-sea-50 text-sea-700') : 'border-line text-ink-faint hover:text-ink')}>
                            {GOAL_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Souhrny" className="min-w-0">
            {summaries.length === 0 ? <p className="text-sm text-ink-faint">Zatím žádný souhrn.</p> : (
              <ul className="divide-y divide-line">
                {summaries.map((s) => (
                  <li key={s.id}>
                    <Link to={`/souhrny/${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-sea-600">
                      <FileText size={17} className="text-ink-faint" />
                      <span className="font-semibold">{KIND_LABEL[s.kind]}</span>
                      <span className="text-sm text-ink-faint">{fmtShort(s.from)}–{fmt(s.to)}</span>
                      <Pill tone={s.status === 'schvaleno' ? 'good' : 'warn'} className="ml-auto">{s.status === 'schvaleno' ? 'schváleno' : 'návrh'} · v{s.version}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <SelfHistory db={db} assessments={as} className="min-w-0 xl:col-span-2" />

          <Card title="Historie hodnocení" className="min-w-0 xl:col-span-2">
            <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
              {[...as].reverse().map((a) => {
                const self = db.selfAssessments.find((s) => s.assessmentId === a.id)
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-sea-500" />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tabular text-sm font-semibold text-ink-faint">{fmt(a.date)}</span>
                      <span className="font-bold">{a.topic || periodLabel(a.periodType, a.periodFrom, a.periodTo)}</span>
                      {a.periodType !== 'hodina' && <Pill tone="sea">{periodLabel(a.periodType, a.periodFrom, a.periodTo)}</Pill>}
                      {a.status === 'rozpracovane' && <Pill tone="warn">rozpracováno</Pill>}
                      {self && <Pill tone="brand"><UserCheck size={12} /> sebehodnocení</Pill>}
                      <Link to={`/hodnoceni/${a.id}`} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-sea-600"><Pencil size={14} /> Otevřít a opravit</Link>
                    </div>
                    {a.goals.length > 0 && (
                      <ul className="mt-1 text-sm text-ink-soft">
                        {a.goals.map((g) => <li key={g.id}><span className="text-ink-faint">Cíl:</span> {g.text} {g.status && <Pill tone={g.status === 'splneno' ? 'good' : g.status === 'castecne' ? 'warn' : 'bad'}>{GOAL_STATUS_LABEL[g.status].toLowerCase()}</Pill>}</li>)}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(a.scores).map(([cid, l]) => (
                        <span key={cid} className="inline-flex items-center gap-1.5 rounded-lg border border-line py-0.5 pl-0.5 pr-2 text-xs">
                          <LevelBadge level={l} size="sm" /> {criteria.find((c) => c.id === cid)?.name ?? 'dovednost'}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>
      )}
    </>
  )
}
