import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardPen, FileText, Pencil, UserCheck } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { setSelection } from '../lib/selection'
import { criteriaFor, setGoalStatus } from '../lib/store'
import { criterionSeries, LEVELS, studentAssessments, trendWord, weeklyLevels } from '../lib/analysis'
import { fmt, fmtShort, KIND_LABEL } from '../lib/dates'
import type { GoalStatus } from '../lib/types'
import { Button, Card, cx, Empty, LevelBadge, PageHeader, Pill } from '../components/ui'
import { ProgressChart } from '../components/ProgressChart'

const GOAL_LABEL: Record<GoalStatus, string> = { rozpracovany: 'Rozpracováno', splneny: 'Splněno', nesplneny: 'Zatím nesplněno' }

export default function StudentDetail() {
  const { id } = useParams()
  const { db, subj } = useCtx()
  const st = db.students.find((s) => s.id === id)

  useEffect(() => {
    if (st && db.subjects.find((p) => p.id === subj?.id)?.classId !== st.classId) {
      const p = db.subjects.find((x) => x.classId === st.classId)
      const school = db.schools.find((s) => s.id === db.classes.find((c) => c.id === st.classId)?.schoolId)
      if (school && school.type !== db.settings.schoolType) return // přepnutí typu školy řeší horní lišta
      setSelection({ classId: st.classId, subjectId: p?.id ?? '' })
    }
  }, [st, subj?.id, db])

  const as = st && subj ? studentAssessments(db, st.id, subj.id) : []
  const criteria = subj ? criteriaFor(db, subj.id) : []
  const withData = criteria.filter((c) => criterionSeries(as, c.id).length > 0)
  const [crit, setCrit] = useState('k-samostatnost')
  const active = withData.find((c) => c.id === crit) ?? withData[0]

  if (!st) return <Empty title="Žák nenalezen" />
  const cls = db.classes.find((c) => c.id === st.classId)
  const goals = db.goals.filter((g) => g.studentId === st.id && g.subjectId === subj?.id).sort((a, b) => b.setOn.localeCompare(a.setOn))
  const summaries = db.summaries.filter((s) => s.studentId === st.id && s.subjectId === subj?.id).sort((a, b) => b.from.localeCompare(a.from))
  const activeSeries = active ? weeklyLevels(criterionSeries(as, active.id)) : []

  return (
    <>
      <Link to="/zaci" className="no-print mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Žáci</Link>
      <PageHeader
        title={`${st.firstName} ${st.lastName}`}
        subtitle={`Třída ${cls?.name} · ${subj?.name ?? '–'} · ${as.length} záznamů`}
        actions={
          <>
            <Link to={`/souhrny?zak=${st.id}`}><Button><FileText size={16} /> Vytvořit souhrn</Button></Link>
            <Link to={`/hodnoceni/nove?zak=${st.id}`}><Button variant="brand"><ClipboardPen size={16} /> Nové hodnocení</Button></Link>
          </>
        }
      />

      {as.length === 0 ? (
        <Empty title="Zatím žádné záznamy">V tomto předmětu žák ještě nebyl hodnocen.</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card title="Vývoj dovednosti v čase">
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Dovednost">
              {withData.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={active?.id === c.id}
                  onClick={() => setCrit(c.id)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-sm font-semibold',
                    active?.id === c.id ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line text-ink-soft hover:text-ink',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {active && <ProgressChart points={criterionSeries(as, active.id)} />}
            {activeSeries.length > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                <strong className="text-ink">{active?.name}: {activeSeries.map((p) => p.level).join(' → ')}</strong>
                {' '}= {trendWord(activeSeries[0].level, activeSeries.at(-1)!.level)}. Nižší číslo znamená vyšší zvládnutí, proto je osa otočená a zlepšení jde nahoru.
              </p>
            )}
          </Card>

          <Card title="Aktuální úroveň">
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
                      <div className="truncate text-xs text-ink-faint">{LEVELS[last.level - 1].text}</div>
                    </div>
                    {s.length > 1 && (
                      <span className={cx('tabular text-xs font-semibold', last.level < first.level ? 'text-good' : last.level > first.level ? 'text-bad' : 'text-ink-faint')}>
                        {first.level} → {last.level}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card title="Cíle" className="xl:col-span-1">
            {goals.length === 0 ? (
              <p className="text-sm text-ink-faint">Zatím bez cílů. Cíl se zakládá v hodnocení (krok 7).</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {goals.map((g) => (
                  <li key={g.id} className="rounded-xl border border-line p-3">
                    <div className="text-[15px] font-semibold">{g.text}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      stanoveno {fmt(g.setOn)} · do {fmt(g.due)}
                      <div className="ml-auto flex gap-1">
                        {(['rozpracovany', 'splneny', 'nesplneny'] as GoalStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setGoalStatus(g.id, s)}
                            aria-pressed={g.status === s}
                            className={cx(
                              'rounded-full border px-2 py-0.5 font-semibold',
                              g.status === s
                                ? s === 'splneny' ? 'border-transparent bg-good-wash text-good' : s === 'nesplneny' ? 'border-transparent bg-orange-wash text-orange' : 'border-transparent bg-sea-50 text-sea-700'
                                : 'border-line text-ink-faint hover:text-ink',
                            )}
                          >
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

          <Card title="Souhrny">
            {summaries.length === 0 ? (
              <p className="text-sm text-ink-faint">Zatím žádný souhrn.</p>
            ) : (
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

          <Card title="Časová osa záznamů" className="xl:col-span-2">
            <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
              {[...as].reverse().map((a) => {
                const self = db.selfAssessments.find((s) => s.assessmentId === a.id)
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-sea-500" />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tabular text-sm font-semibold text-ink-faint">{fmt(a.date)}{a.lesson != null && ` · ${a.lesson}. hod`}</span>
                      <span className="font-bold">{a.topic || 'Bez tématu'}</span>
                      {self && <Pill tone="brand"><UserCheck size={12} /> sebehodnocení</Pill>}
                      <Link to={`/hodnoceni/${a.id}`} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-sea-600"><Pencil size={14} /> Otevřít a opravit</Link>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(a.scores).map(([cid, l]) => (
                        <span key={cid} className="inline-flex items-center gap-1.5 rounded-lg border border-line py-0.5 pl-0.5 pr-2 text-xs">
                          <LevelBadge level={l} size="sm" /> {criteria.find((c) => c.id === cid)?.name ?? 'kritérium'}
                        </span>
                      ))}
                    </div>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                      {a.feedback.good && <div><dt className="text-xs font-semibold text-good">Povedlo se</dt><dd>{a.feedback.good}</dd></div>}
                      {a.feedback.todo && <div><dt className="text-xs font-semibold text-orange">Procvičit</dt><dd>{a.feedback.todo}</dd></div>}
                      {a.feedback.next && <div><dt className="text-xs font-semibold text-sea-700">Další krok</dt><dd>{a.feedback.next}</dd></div>}
                    </dl>
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
