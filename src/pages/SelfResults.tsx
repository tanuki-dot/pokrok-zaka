import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareHeart } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { inRange, periodFor, today, fmtShort } from '../lib/dates'
import { describeSelf } from '../lib/questionnaire'
import { PERIOD_LABEL } from '../lib/periods'
import type { PeriodType, SelfAnswers, SelfAssessment } from '../lib/types'
import { Card, cx, Empty, PageHeader, Pill, Select, Tabs } from '../components/ui'

type P = 'tyden' | 'mesic' | 'pololeti' | 'vse'

/** Obecné popisy tří stupňů (znění otázek se liší podle období). */
const LEVEL3 = {
  understanding: { 3: 'Rozumí a dokáže učivo použít', 2: 'Většině rozumí, něco potřebuje procvičit', 1: 'Zatím nerozumí / potřebuje pomoc' },
  work: { 3: 'Pracuje samostatně', 2: 'Občas potřebuje pomoc', 1: 'Potřebuje častou pomoc' },
} as const
const GOAL = { ano: 'Ano', castecne: 'Částečně', zatimne: 'Zatím ne' } as const
const TONE3: Record<number, string> = { 3: 'var(--color-lv1)', 2: 'var(--color-lv3)', 1: 'var(--color-lv5)' }
const TONE_GOAL: Record<string, string> = { ano: 'var(--color-lv1)', castecne: 'var(--color-lv3)', zatimne: 'var(--color-lv5)' }

function Distribution({ title, options, values, tone }: { title: string; options: { value: string | number; label: string }[]; values: (string | number)[]; tone: (v: string | number) => string }) {
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
                  <span className="min-w-0 flex-1">{o.label}</span>
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

function Counts({ title, lists }: { title: string; lists: string[][] }) {
  const counts = new Map<string, number>()
  for (const l of lists) for (const x of l) counts.set(x, (counts.get(x) ?? 0) + 1)
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const max = Math.max(1, ...items.map(([, n]) => n))
  return (
    <Card title={title} action={<span className="text-xs text-ink-faint">více odpovědí</span>}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">Žádné odpovědi.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map(([label, n]) => (
            <li key={label}>
              <div className="flex justify-between gap-2"><span>{label}</span><span className="tabular text-ink-soft">{n}×</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-sea-500" style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function SelfResults() {
  const { db, cls, subj, students } = useCtx()
  const [period, setPeriod] = useState<P>('mesic')
  const [ptype, setPtype] = useState<'' | PeriodType>('')
  if (!subj) return <Empty title="Vyberte předmět" />

  const per = period === 'vse' ? { from: '0000-01-01', to: '9999-12-31', label: 'celé období' } : periodFor(period, today())
  const studentIds = new Set(students.map((s) => s.id))
  const as = db.assessments.filter((a) => a.subjectId === subj.id && studentIds.has(a.studentId) && inRange(a.date, per.from, per.to) && (!ptype || a.periodType === ptype))
  const byAssessment = new Map(as.map((a) => [a.id, a]))
  const selfs = db.selfAssessments
    .filter((s) => byAssessment.has(s.assessmentId))
    .sort((a, b) => byAssessment.get(a.assessmentId)!.date.localeCompare(byAssessment.get(b.assessmentId)!.date))
  const fresh = selfs.filter((s) => s.answers) as (SelfAssessment & { answers: SelfAnswers })[]
  const legacy = selfs.length - fresh.length
  const described = fresh.map((s) => describeSelf(s))

  return (
    <>
      <PageHeader
        icon={<MessageSquareHeart size={28} />}
        title="Sebehodnocení žáků"
        subtitle={`${cls?.name ?? '–'} · ${subj.name} · ${per.label}. Třídu a předmět změníte nahoře.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select id="s-typ" aria-label="Typ hodnoceného období" className="w-auto" value={ptype} onChange={(e) => setPtype(e.target.value as '' | PeriodType)}>
              <option value="">Všechny dotazníky</option>
              {(Object.keys(PERIOD_LABEL) as PeriodType[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
            </Select>
            <Tabs<P> value={period} onChange={setPeriod} options={[{ value: 'tyden', label: 'Týden' }, { value: 'mesic', label: 'Měsíc' }, { value: 'pololeti', label: 'Pololetí' }, { value: 'vse', label: 'Vše' }]} />
          </div>
        }
      />
      <p className="mb-4 rounded-xl border border-warn/30 bg-warn-wash px-4 py-3 text-sm text-warn">
        <strong>Subjektivní sebehodnocení:</strong> odpovědi ukazují, jak žáci sami vnímají své učení. Nejsou to známky ani objektivní hodnocení, slouží jako podklad pro rozhovor a další cíl.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Odpovědi</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">{selfs.length}</div>
          <div className="text-xs text-ink-faint">z {as.length} hodnocení{legacy ? ` · ${legacy} ve starším formátu` : ''}</div>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Zapojení</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">{as.length ? Math.round((selfs.length / as.length) * 100) : 0} %</div>
          <div className="text-xs text-ink-faint">hodnocení se sebehodnocením</div>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-ink-soft">Žáci, kteří odpověděli</div>
          <div className="tabular mt-1 font-display text-[30px] font-bold leading-tight">{new Set(selfs.map((s) => byAssessment.get(s.assessmentId)!.studentId)).size} / {students.length}</div>
          <div className="text-xs text-ink-faint">aspoň jednou</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution title="1. Porozumění učivu" options={[3, 2, 1].map((v) => ({ value: v, label: LEVEL3.understanding[v as 1 | 2 | 3] }))} values={fresh.map((s) => s.answers.understanding)} tone={(v) => TONE3[v as number]} />
        <Distribution title="2. Práce a samostatnost" options={[3, 2, 1].map((v) => ({ value: v, label: LEVEL3.work[v as 1 | 2 | 3] }))} values={fresh.map((s) => s.answers.work)} tone={(v) => TONE3[v as number]} />
        <Distribution title="5. Splnění cílů" options={(['ano', 'castecne', 'zatimne'] as const).map((v) => ({ value: v, label: GOAL[v] }))} values={fresh.map((s) => s.answers.goalMet)} tone={(v) => TONE_GOAL[v as string]} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Counts title="3. Co se povedlo" lists={described.map((d) => d.wentWell)} />
        <Counts title="4. Co zlepšit" lists={described.map((d) => d.improve)} />
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
                <th className="py-2 pr-3 font-semibold">Cíle (poslední)</th>
                <th className="py-2 font-semibold">Chce zlepšit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((st) => {
                const mine = fresh.filter((s) => byAssessment.get(s.assessmentId)!.studentId === st.id)
                const all = selfs.filter((s) => byAssessment.get(s.assessmentId)!.studentId === st.id)
                const last = mine.at(-1)
                const d = last ? describeSelf(last) : undefined
                const u = mine.map((s) => s.answers.understanding)
                return (
                  <tr key={st.id} className="align-top">
                    <td className="py-2.5 pr-3"><Link to={`/zaci/${st.id}`} className="font-semibold hover:text-sea-600">{st.lastName} {st.firstName}</Link></td>
                    <td className="tabular py-2.5 pr-3 text-center">{all.length || '–'}</td>
                    <td className="py-2.5 pr-3">{d ? d.understanding : <span className="text-ink-faint">–</span>}</td>
                    <td className="py-2.5 pr-3">
                      {u.length >= 2 ? (
                        <span className="tabular" title={mine.map((s) => fmtShort(byAssessment.get(s.assessmentId)!.date)).join(', ')}>
                          {u.join(' → ')}{' '}
                          <span className={cx('font-bold', u.at(-1)! > u[0] ? 'text-good' : u.at(-1)! < u[0] ? 'text-bad' : 'text-ink-faint')}>{u.at(-1)! > u[0] ? '↑' : u.at(-1)! < u[0] ? '↓' : '→'}</span>
                        </span>
                      ) : <span className="text-ink-faint">–</span>}
                    </td>
                    <td className="py-2.5 pr-3">{d ? d.goalMet : <span className="text-ink-faint">–</span>}</td>
                    <td className="py-2.5">
                      {d ? (d.nothingToImprove ? <Pill tone="good">nic zásadního</Pill> : <span className="flex flex-wrap gap-1">{d.improve.map((t) => <Pill key={t} className="whitespace-normal">{t.replace(/\.$/, '')}</Pill>)}</span>) : <span className="text-ink-faint">–</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">Vývoj porozumění podle žáka: 3 = rozumím a dokážu použít, 2 = většině rozumím, 1 = zatím nerozumím.</p>
      </Card>
    </>
  )
}
