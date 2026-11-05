import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, ArrowRight, ClipboardPen, FileClock, LayoutDashboard, MessageSquareText, Target, UserCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCtx } from '../lib/useCtx'
import { addDays, fmtShort, relative, today, weekStart } from '../lib/dates'
import { Button, Card, Pill, PageHeader } from '../components/ui'
import { fullName } from '../lib/util'

function Stat({ icon, value, label, note, tone }: { icon: ReactNode; value: ReactNode; label: string; note?: ReactNode; tone: string }) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line" style={{ color: tone, background: `color-mix(in srgb, ${tone} 8%, white)` }}>
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

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(mon, -7 * (7 - i)))
  const activity = weeks.map((w) => ({
    week: w,
    zaznamy: subjA.filter((a) => weekStart(a.date) === w).length,
  }))

  const goalData = [
    { name: 'Splněno', value: goals.filter((g) => g.status === 'splneny').length, color: 'var(--color-lv1)' },
    { name: 'Rozpracováno', value: open.length, color: 'var(--color-sea-500)' },
    { name: 'Zatím nesplněno', value: goals.filter((g) => g.status === 'nesplneny').length, color: 'var(--color-lv4)' },
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
        <Stat icon={<Target size={24} />} tone="var(--color-lv1)" value={open.length} label="Rozpracované cíle" note={`z ${goals.length} stanovených`} />
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Záznamy po týdnech" action={<Pill tone="sea">{subj?.name}</Pill>}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => fmtShort(w)} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(w) => `Týden od ${fmtShort(String(w))}`} formatter={(v) => [v, 'Záznamy']} contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', fontSize: 13 }} />
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
