import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, ArrowRight, ClipboardPen, HeartHandshake, FileClock, LayoutDashboard, MessageSquareText, Target, UserCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCtx } from '../lib/useCtx'
import { addDays, fmtShort, relative, today, weekStart } from '../lib/dates'
import { Button, Card, Pill, PageHeader } from '../components/ui'
import { fullName } from '../lib/util'
import { supportReasons } from '../lib/analysis'
import { periodFor } from '../lib/dates'
import { TOOLTIP_STYLE } from '../components/chartStyle'

function Stat({ icon, value, label, note, tone }: { icon: ReactNode; value: ReactNode; label: string; note?: ReactNode; tone: string }) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line" style={{ color: tone, background: `color-mix(in srgb, ${tone} 10%, var(--color-surface))` }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="tabular font-display text-[30px] font-bold leading-none" style={{ color: tone }}>{value}</div>
        <div className="mt-1 font-semibold">{label}</div>
        {note && <div className="text-xs text-ink-faint">{note}</div>}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { db, cls, subj, students } = useCtx()
  const t = today()
  const mon = weekStart(t)
  const subjA = db.assessments.filter((a) => a.subjectId === subj?.id)
  const thisWeek = subjA.filter((a) => a.date >= mon)
  const lastWeek = subjA.filter((a) => a.date >= addDays(mon, -7) && a.date < mon)
  const withFb = thisWeek.filter((a) => a.feedback.good && a.feedback.next)
  const goals = db.goals.filter((g) => g.subjectId === subj?.id)
  const open = goals.filter((g) => g.status === 'rozpracovany')
  const drafts = db.summaries.filter((s) => s.status === 'navrh' && s.subjectId === subj?.id)
  const selfThisWeek = db.selfAssessments.filter((s) => thisWeek.some((a) => a.id === s.assessmentId))

  const missing = students.filter((s) => !thisWeek.some((a) => a.studentId === s.id))
  const support = students
    .map((st) => ({ st, reasons: subj ? supportReasons(db, st.id, subj.id) : [] }))
    .filter((x) => x.reasons.length)
    .sort((a, b) => b.reasons.reduce((n, r) => n + r.severity, 0) - a.reasons.reduce((n, r) => n + r.severity, 0))
  const reached = goals.filter((g) => g.status === 'splneny').sort((a, b) => b.setOn.localeCompare(a.setOn))
  const unmet = goals.filter((g) => g.status === 'nesplneny').sort((a, b) => b.setOn.localeCompare(a.setOn))
  const month = periodFor('mesic', t)
  const monthLessons = subjA.filter((a) => a.date >= month.from && a.date <= month.to && a.goalStatus)
  const lessonCount = (s: string) => monthLessons.filter((a) => a.goalStatus === s).length
  const sName = (id: string) => {
    const s = db.students.find((x) => x.id === id)
    return s ? fullName(s) : '–'
  }

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(mon, -7 * (7 - i)))
  const activity = weeks.map((w) => ({
    week: w,
    zaznamy: subjA.filter((a) => weekStart(a.date) === w).length,
  }))

  const goalData = [
    { name: 'Splněno', value: goals.filter((g) => g.status === 'splneny').length, color: 'var(--color-good)' },
    { name: 'Rozpracováno', value: open.length, color: 'var(--color-sea-500)' },
    { name: 'Zatím nesplněno', value: goals.filter((g) => g.status === 'nesplneny').length, color: 'var(--color-orange)' },
  ]
  const goalTotal = goalData.reduce((a, b) => a + b.value, 0)

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard size={28} />}
        title="Přehled"
        subtitle={<>Dobrý den, {db.settings.teacherName.split(' ').slice(-1)}. Takhle vypadá {subj?.name.toLowerCase() ?? 'výuka'} ve třídě {cls?.name ?? '–'} tento týden.</>}
        actions={
          <Link to="/hodnoceni/nove">
            <Button variant="brand"><ClipboardPen size={17} /> Nové hodnocení</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<ClipboardPen size={24} />} tone="var(--color-sea-500)" value={thisWeek.length} label="Záznamy tento týden" note={`minulý týden ${lastWeek.length}`} />
        <Stat icon={<MessageSquareText size={24} />} tone="#7c4ddb" value={thisWeek.length ? `${Math.round((withFb.length / thisWeek.length) * 100)} %` : '–'} label="Se zpětnou vazbou" note="co se povedlo + další krok" />
        <Stat icon={<Target size={24} />} tone="var(--color-good)" value={open.length} label="Rozpracované cíle" note={`z ${goals.length} stanovených`} />
        <Stat icon={<UserCheck size={24} />} tone="var(--color-brand-500)" value={selfThisWeek.length} label="Sebehodnocení" note="odevzdaná tento týden" />
      </div>

      {missing.length > 0 && subj && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
          <AlertCircle className="shrink-0 text-brand-600" size={26} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-brand-700">Další krok</div>
            <div className="text-sm text-ink-soft">
              {missing.length === students.length
                ? `Tento týden zatím nikdo z ${cls?.name} nemá záznam z předmětu ${subj.name.toLowerCase()}.`
                : `Bez záznamu tento týden: ${missing.slice(0, 4).map(fullName).join(', ')}${missing.length > 4 ? ` a další (${missing.length - 4})` : ''}.`}
            </div>
          </div>
          <Link to={`/hodnoceni/nove?zak=${missing[0].id}`}>
            <Button className="border-brand-500 text-brand-700">Ohodnotit {missing[0].firstName} <ArrowRight size={16} /></Button>
          </Link>
        </div>
      )}

      <Card
        className="mt-5"
        title={<span className="inline-flex items-center gap-2"><HeartHandshake size={18} className="text-brand-500" /> Žáci, kteří potřebují větší podporu</span>}
        action={<span className="text-xs text-ink-faint">{subj?.name} · podle posledních záznamů</span>}
      >
        {support.length === 0 ? (
          <p className="text-sm text-ink-faint">Podle záznamů teď nikdo nepotřebuje zvláštní podporu.</p>
        ) : (
          <ul className="divide-y divide-line">
            {support.slice(0, 6).map(({ st, reasons }) => (
              <li key={st.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <Link to={`/zaci/${st.id}`} className="min-w-[150px] font-semibold hover:text-sea-600">{fullName(st)}</Link>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {reasons.map((r) => <Pill key={r.text} tone={r.severity === 2 ? 'bad' : 'warn'} className="whitespace-normal">{r.text}</Pill>)}
                </span>
                <Link to={`/hodnoceni/nove?zak=${st.id}`} className="shrink-0 text-sm font-semibold text-sea-600">Ohodnotit</Link>
              </li>
            ))}
          </ul>
        )}
        {support.length > 6 && <p className="mt-2 text-xs text-ink-faint">A dalších {support.length - 6} žáků – celý přehled je v Přehledu třídy.</p>}
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Záznamy po týdnech" action={<Pill tone="sea">{subj?.name}</Pill>}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => fmtShort(w)} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--color-muted)' }} labelFormatter={(w) => `Týden od ${fmtShort(String(w))}`} formatter={(v) => [v, 'Záznamy']} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="zaznamy" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {activity.map((a) => (
                    <Cell key={a.week} fill={a.week === mon ? 'var(--color-brand-500)' : 'var(--color-sea-500)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Stav cílů">
          {goalTotal === 0 ? (
            <p className="text-sm text-ink-faint">Zatím nejsou stanovené žádné cíle.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={goalData} dataKey="value" innerRadius={52} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {goalData.map((g) => <Cell key={g.name} fill={g.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><div className="tabular font-display text-3xl font-bold">{goalTotal}</div><div className="text-xs text-ink-faint">cílů</div></div>
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-col gap-2.5 text-sm">
                {goalData.map((g) => (
                  <li key={g.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                    <span className="font-semibold">{g.name}</span>
                    <span className="tabular ml-auto text-ink-soft">{g.value} ({Math.round((g.value / goalTotal) * 100)} %)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Přehled cílů" className="mt-5" action={<span className="text-xs text-ink-faint">{subj?.name}</span>}>
        <p className="mb-4 text-sm text-ink-soft">
          Vzdělávací cíle hodin za {month.label}:{' '}
          {monthLessons.length ? (
            <>
              <strong className="text-good">splněno {lessonCount('splneno')}</strong> · <strong className="text-warn">částečně {lessonCount('castecne')}</strong> ·{' '}
              <strong className="text-bad">nesplněno {lessonCount('nesplneno')}</strong>
            </>
          ) : 'zatím neoznačeno.'}
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {([['Dosažené cíle', reached, 'good'], ['Nesplněné cíle', unmet, 'bad']] as const).map(([title, list, tone]) => (
            <div key={title} className="min-w-0">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">{title} <Pill tone={tone}>{list.length}</Pill></h3>
              {list.length === 0 ? (
                <p className="text-sm text-ink-faint">Žádné.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {list.slice(0, 5).map((g) => (
                    <li key={g.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                      <Link to={`/zaci/${g.studentId}`} className="font-semibold hover:text-sea-600">{sName(g.studentId)}</Link>
                      <span className="text-ink-faint"> · {fmtShort(g.setOn)}</span>
                      <div className="text-ink-soft">{g.text}</div>
                    </li>
                  ))}
                </ul>
              )}
              {list.length > 5 && <p className="mt-1.5 text-xs text-ink-faint">a dalších {list.length - 5}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Souhrny ke schválení" action={<Link to="/souhrny" className="text-sm font-semibold text-sea-600">Všechny souhrny <ArrowRight className="inline" size={14} /></Link>}>
          {drafts.length === 0 ? (
            <p className="text-sm text-ink-faint">Žádný návrh nečeká na schválení.</p>
          ) : (
            <ul className="divide-y divide-line">
              {drafts.slice(0, 5).map((s) => {
                const st = db.students.find((x) => x.id === s.studentId)
                return (
                  <li key={s.id}>
                    <Link to={`/souhrny/${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-sea-600">
                      <FileClock size={18} className="text-brand-500" />
                      <span className="font-semibold">{st ? fullName(st) : '–'}</span>
                      <span className="text-sm text-ink-faint">{s.kind === 'tyden' ? 'týdenní' : s.kind === 'mesic' ? 'měsíční' : 'pololetní'} · {fmtShort(s.from)}–{fmtShort(s.to)}</span>
                      <Pill tone="warn" className="ml-auto">návrh</Pill>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Poslední změny">
          <ul className="flex flex-col gap-3">
            {db.audit.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 rounded-lg bg-sea-50 px-2 py-0.5 text-xs font-semibold text-sea-700">{e.entity}</span>
                <span className="min-w-0 flex-1"><span className="font-semibold">{e.action}</span> · {e.label}</span>
                <span className="shrink-0 text-xs text-ink-faint">{relative(e.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
