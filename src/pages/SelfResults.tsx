import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareHeart } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { inRange, periodFor, today, fmtShort } from '../lib/dates'
import { describe, IMPROVE_NOTHING, Q_GOAL_MET, Q_IMPROVE, Q_UNDERSTANDING, Q_WENT_WELL, Q_WORK, type Option } from '../lib/questionnaire'
import type { SelfAnswers, SelfAssessment } from '../lib/types'
import { Card, cx, Empty, PageHeader, Pill, Tabs } from '../components/ui'

type P = 'tyden' | 'mesic' | 'pololeti' | 'vse'

const TONE3: Record<number, string> = { 3: 'var(--color-lv5)', 2: 'var(--color-lv3)', 1: 'var(--color-lv1)' }
const TONE_GOAL: Record<string, string> = { ano: 'var(--color-lv5)', castecne: 'var(--color-lv3)', zatimne: 'var(--color-lv1)' }

function Distribution<V extends string | number>({ title, options, values, tone }: { title: string; options: Option<V>[]; values: V[]; tone: (v: V) => string }) {
  const total = values.length
  return (
    <Card title={title}>
      {total === 0 ? (
        <p className="text-sm text-ink-faint">Žádné odpovědi.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {options.map((o) => {
              const n = values.filter((v) => v === o.value).length
              return n ? <span key={String(o.value)} style={{ width: `${(n / total) * 100}%`, background: tone(o.value) }} /> : null
            })}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {options.map((o) => {
              const n = values.filter((v) => v === o.value).length
              return (
                <li key={String(o.value)} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone(o.value) }} />
                  <span className="min-w-0 flex-1">{o.label.standard}</span>
                  <span className="tabular shrink-0 text-ink-soft">{n} ({Math.round((n / total) * 100)} %)</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}

function Counts({ title, options, lists }: { title: string; options: Option[]; lists: string[][] }) {
  const total = lists.length
  const max = Math.max(1, ...options.map((o) => lists.filter((l) => l.includes(o.value)).length))
  return (
    <Card title={title} action={<span className="text-xs text-ink-faint">více odpovědí</span>}>
      {total === 0 ? (
        <p className="text-sm text-ink-faint">Žádné odpovědi.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {options.map((o) => {
            const n = lists.filter((l) => l.includes(o.value)).length
            return (
              <li key={o.value}>
                <div className="flex justify-between gap-2"><span>{o.label.standard}</span><span className="tabular text-ink-soft">{n}×</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-sea-500" style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function SelfResults() {
  const { db, cls, subj, students } = useCtx()
  const [period, setPeriod] = useState<P>('mesic')
  if (!subj) return <Empty title="Vyberte předmět" />

  const per = period === 'vse' ? { from: '0000-01-01', to: '9999-12-31', label: 'celé období' } : periodFor(period, today())
  const studentIds = new Set(students.map((s) => s.id))
  const as = db.assessments.filter((a) => a.subjectId === subj.id && studentIds.has(a.studentId) && inRange(a.date, per.from, per.to))
  const byAssessment = new Map(as.map((a) => [a.id, a]))
  const selfs = db.selfAssessments
    .filter((s) => byAssessment.has(s.assessmentId))
    .sort((a, b) => byAssessment.get(a.assessmentId)!.date.localeCompare(byAssessment.get(b.assessmentId)!.date))
  const fresh = selfs.filter((s) => s.answers) as (SelfAssessment & { answers: SelfAnswers })[]
  const legacy = selfs.length - fresh.length

  return (
    <>
      <PageHeader
        icon={<MessageSquareHeart size={28} />}
        title="Sebehodnocení žáků"
        subtitle={`${cls?.name ?? '–'} · ${subj.name} · ${per.label}. Třídu a předmět změníte nahoře.`}
        actions={
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
        }
      />
      <p className="mb-4 rounded-xl border border-warn/30 bg-warn-wash px-4 py-3 text-sm text-warn">
        <strong>Subjektivní sebehodnocení:</strong> odpovědi ukazují, jak žáci sami vnímají své učení. Nejsou to známky a nepřevádí se na ně – slouží jako podklad pro rozhovor a další cíl.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Odpovědi</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">{selfs.length}</div>
          <div className="text-xs text-ink-faint">z {as.length} hodnocení v období{legacy ? ` · ${legacy} ve starším formátu` : ''}</div>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Zapojení</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">{as.length ? Math.round((selfs.length / as.length) * 100) : 0} %</div>
          <div className="text-xs text-ink-faint">hodnocení se sebehodnocením</div>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Žáci, kteří odpověděli</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">
            {new Set(selfs.map((s) => byAssessment.get(s.assessmentId)!.studentId)).size} / {students.length}
          </div>
          <div className="text-xs text-ink-faint">aspoň jednou v období</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution title="1. Porozumění učivu" options={Q_UNDERSTANDING} values={fresh.map((s) => s.answers.understanding)} tone={(v) => TONE3[v]} />
        <Distribution title="2. Jak se pracovalo" options={Q_WORK} values={fresh.map((s) => s.answers.work)} tone={(v) => TONE3[v]} />
        <Distribution title="5. Splnění cíle hodiny" options={Q_GOAL_MET} values={fresh.map((s) => s.answers.goalMet)} tone={(v) => TONE_GOAL[v]} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Counts title="3. Co se povedlo" options={Q_WENT_WELL} lists={fresh.map((s) => s.answers.wentWell)} />
        <Counts title="4. Co zlepšit" options={Q_IMPROVE} lists={fresh.map((s) => s.answers.improve)} />
      </div>

      <Card title="Podle žáků" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-semibold">Žák</th>
                <th className="py-2 pr-3 text-center font-semibold">Odpovědi</th>
                <th className="py-2 pr-3 font-semibold">Porozumění (poslední)</th>
                <th className="py-2 pr-3 font-semibold">Vývoj porozumění</th>
                <th className="py-2 pr-3 font-semibold">Cíl hodiny (poslední)</th>
                <th className="py-2 font-semibold">Chce zlepšit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((st) => {
                const mine = fresh.filter((s) => byAssessment.get(s.assessmentId)!.studentId === st.id)
                const all = selfs.filter((s) => byAssessment.get(s.assessmentId)!.studentId === st.id)
                const last = mine.at(-1)
                const u = mine.map((s) => s.answers.understanding)
                return (
                  <tr key={st.id} className="align-top">
                    <td className="py-2.5 pr-3"><Link to={`/zaci/${st.id}`} className="font-semibold hover:text-sea-600">{st.lastName} {st.firstName}</Link></td>
                    <td className="tabular py-2.5 pr-3 text-center">{all.length || '–'}</td>
                    <td className="py-2.5 pr-3">{last ? describe.understanding(last.answers.understanding) : <span className="text-ink-faint">–</span>}</td>
                    <td className="py-2.5 pr-3">
                      {u.length >= 2 ? (
                        <span className="tabular" title={mine.map((s) => fmtShort(byAssessment.get(s.assessmentId)!.date)).join(', ')}>
                          {u.join(' → ')}{' '}
                          <span className={cx('font-bold', u.at(-1)! > u[0] ? 'text-good' : u.at(-1)! < u[0] ? 'text-bad' : 'text-ink-faint')}>
                            {u.at(-1)! > u[0] ? '↑' : u.at(-1)! < u[0] ? '↓' : '→'}
                          </span>
                        </span>
                      ) : <span className="text-ink-faint">–</span>}
                    </td>
                    <td className="py-2.5 pr-3">{last ? describe.goalMet(last.answers.goalMet) : <span className="text-ink-faint">–</span>}</td>
                    <td className="py-2.5">
                      {last ? (
                        last.answers.improve.includes(IMPROVE_NOTHING) ? <Pill tone="good">cíl zvládnut</Pill> : (
                          <span className="flex flex-wrap gap-1">{describe.improve(last.answers.improve).map((t) => <Pill key={t} className="whitespace-normal">{t.replace(/\.$/, '')}</Pill>)}</span>
                        )
                      ) : <span className="text-ink-faint">–</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">Porozumění: 3 = rozumím a dokážu použít, 2 = většině rozumím, 1 = zatím moc nerozumím.</p>
      </Card>
    </>
  )
}
