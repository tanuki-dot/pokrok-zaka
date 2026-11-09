import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowRight, ClipboardCheck, ClipboardPen, FileClock, HeartHandshake, History, LayoutDashboard, Target, UserPlus, Users } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { fmt, fmtShort, relative } from '../lib/dates'
import { periodLabel } from '../lib/periods'
import { recommendations, studentAssessments, supportReasons } from '../lib/analysis'
import { fullName } from '../lib/util'
import { Button, Card, Help, PageHeader, Pill } from '../components/ui'

const LESSON_GOAL = [
  { key: 'splneno', label: 'Splněno', tone: 'good', color: 'var(--color-lv1)' },
  { key: 'castecne', label: 'Částečně', tone: 'warn', color: 'var(--color-lv3)' },
  { key: 'nesplneno', label: 'Nesplněno', tone: 'bad', color: 'var(--color-lv5)' },
] as const

/*
 * Úvodní stránka aplikace (pokrokveskole.docx, snímek 1): přehled, postup a hlavní tlačítka.
 */

const HOW = [
  'Vyplnit údaje o žákovi a vzdělávací cíl.',
  'Vyplnit hodnocení učitele.',
  'Získat sebehodnocení žáka.',
  'Vytvořit automatické formativní hodnocení.',
  'Zkontrolovat a schválit výslednou zprávu.',
  'Sledovat pokrok žáka v historii.',
]

function Stat({ icon, value, label, note }: { icon: ReactNode; value: ReactNode; label: string; note?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sea-50 text-sea-600">{icon}</span>
      <div className="min-w-0">
        <div className="tabular font-display text-[28px] font-bold leading-none">{value}</div>
        <div className="mt-1 font-semibold">{label}</div>
        {note && <div className="truncate text-xs text-ink-faint">{note}</div>}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { db, subj, students } = useCtx()
  const all = [...db.assessments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const last = [...db.assessments].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const lastSt = last && db.students.find((s) => s.id === last.studentId)
  const lastSubj = last && db.subjects.find((s) => s.id === last.subjectId)
  const drafts = all.filter((a) => a.status === 'rozpracovane')
  const evaluated = new Set(db.assessments.filter((a) => Object.keys(a.scores).length).map((a) => a.studentId)).size
  // #5: kolik žáků vybrané třídy a předmětu ještě nemá žádné ohodnocení.
  const subjAssessed = new Set(db.assessments.filter((a) => a.subjectId === subj?.id && Object.keys(a.scores).length).map((a) => a.studentId))
  const notAssessed = students.filter((st) => !subjAssessed.has(st.id))

  // #5: přehled splnění vzdělávacích cílů (splněno / částečně / nesplněno) ve vybraném předmětu.
  const lessonGoals = { splneno: 0, castecne: 0, nesplneno: 0 }
  for (const a of db.assessments)
    if (a.subjectId === subj?.id) for (const g of a.goals) if (g.status) lessonGoals[g.status]++
  const lessonTotal = lessonGoals.splneno + lessonGoals.castecne + lessonGoals.nesplneno

  const goals = db.goals.filter((g) => g.subjectId === subj?.id)
  const reached = goals.filter((g) => g.status === 'splneny').sort((a, b) => b.setOn.localeCompare(a.setOn))
  const unmet = goals.filter((g) => g.status === 'nesplneny').sort((a, b) => b.setOn.localeCompare(a.setOn))
  const support = students
    .map((st) => {
      const reasons = subj ? supportReasons(db, st.id, subj.id) : []
      const last = subj ? studentAssessments(db, st.id, subj.id).at(-1) : undefined
      const self = last ? db.selfAssessments.find((s) => s.assessmentId === last.id) : undefined
      const rec = reasons.length && last ? recommendations(db, last, self)[0] : undefined
      return { st, reasons, rec }
    })
    .filter((x) => x.reasons.length)
    .sort((a, b) => b.reasons.reduce((n, r) => n + r.severity, 0) - a.reasons.reduce((n, r) => n + r.severity, 0))
  const sName = (id: string) => {
    const s = db.students.find((x) => x.id === id)
    return s ? fullName(s) : '–'
  }

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard size={28} />}
        title="POKROK ŽÁKA"
        subtitle="Formativní hodnocení a sledování individuálního pokroku"
        actions={<Pill tone="warn" className="px-3 py-1 text-sm">Testovací provoz</Pill>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/hodnoceni/nove?novy=1"><Button><UserPlus size={17} /> Nový žák</Button></Link>
        <Link to="/hodnoceni/nove"><Button variant="brand"><ClipboardPen size={17} /> Nové hodnocení</Button></Link>
        <Link to="/historie"><Button><History size={17} /> Historie hodnocení</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<ClipboardCheck size={22} />} value={db.assessments.length} label="Vytvořená hodnocení" note={`${db.assessments.length - drafts.length} dokončených`} />
        <Stat icon={<Users size={22} />} value={evaluated} label="Hodnocení žáci" note={`z ${db.students.length} v evidenci${notAssessed.length ? ` · ${notAssessed.length} bez hodnocení v ${subj?.name ?? 'předmětu'}` : ''}`} />
        <Stat
          icon={<FileClock size={22} />}
          value={last ? fmtShort(last.date) : '–'}
          label="Poslední hodnocení"
          note={last && lastSt ? <Link to={`/hodnoceni/${last.id}`} className="hover:text-sea-600">{fullName(lastSt)}</Link> : 'zatím žádné'}
        />
        <Stat icon={<Target size={22} />} value={lastSubj?.name ?? '–'} label="Poslední předmět a období" note={last ? periodLabel(last.periodType, last.periodFrom, last.periodTo) : ''} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Nedokončená hodnocení" action={<Pill tone="warn">{drafts.length}</Pill>} className="min-w-0">
          {drafts.length === 0 ? (
            <p className="text-sm text-ink-faint">Všechna hodnocení jsou dokončená.</p>
          ) : (
            <ul className="divide-y divide-line">
              {drafts.slice(0, 6).map((a) => {
                const st = db.students.find((s) => s.id === a.studentId)
                const sp = db.subjects.find((s) => s.id === a.subjectId)
                return (
                  <li key={a.id}>
                    <Link to={`/hodnoceni/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 hover:text-sea-600">
                      <span className="font-semibold">{st ? fullName(st) : '–'}</span>
                      <span className="text-sm text-ink-faint">{sp?.name} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-sea-600">Pokračovat <ArrowRight size={14} /></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Jak aplikace funguje" className="min-w-0">
          <ol className="flex flex-col gap-2">
            {HOW.map((t, i) => (
              <li key={t} className="flex items-start gap-3 text-sm">
                <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sea-500 text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card
        className="mt-5"
        title={<span className="inline-flex items-center gap-2"><HeartHandshake size={18} className="text-sea-600" /> Žáci, kteří potřebují větší podporu <Help>Seznam sestavuje aplikace z posledních hodnocení: nízké úrovně, poklesy, opakovaně nesplněné cíle a sebehodnocení žáka. U každého nabídne konkrétní doporučení.</Help></span>}
        action={<span className="text-xs text-ink-faint">{subj?.name} · podle posledních hodnocení</span>}
      >
        {support.length === 0 ? (
          <p className="text-sm text-ink-faint">Podle hodnocení teď nikdo nepotřebuje zvláštní podporu.</p>
        ) : (
          <ul className="divide-y divide-line">
            {support.slice(0, 6).map(({ st, reasons, rec }) => (
              <li key={st.id} className="flex flex-col gap-1.5 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link to={`/zaci/${st.id}`} className="min-w-[150px] font-semibold hover:text-sea-600">{fullName(st)}</Link>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {reasons.map((r) => <Pill key={r.text} tone={r.severity === 2 ? 'bad' : 'warn'} className="whitespace-normal">{r.text}</Pill>)}
                  </span>
                </div>
                {rec && <p className="text-sm text-ink-soft"><span className="font-semibold text-sea-700">Doporučení:</span> {rec}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Přehled cílů" action={<span className="text-xs text-ink-faint">{subj?.name}</span>} className="min-w-0">
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-bold">Splnění vzdělávacích cílů v hodnoceních</h3>
            {lessonTotal === 0 ? (
              <p className="text-sm text-ink-faint">Zatím nejsou v hodnoceních označená splnění cílů.</p>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Splněno ${lessonGoals.splneno}, částečně ${lessonGoals.castecne}, nesplněno ${lessonGoals.nesplneno}`}>
                  {LESSON_GOAL.map((g) => lessonGoals[g.key] > 0 && (
                    <span key={g.key} style={{ width: `${(lessonGoals[g.key] / lessonTotal) * 100}%`, background: g.color }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {LESSON_GOAL.map((g) => (
                    <span key={g.key} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                      {g.label} <strong className="tabular">{lessonGoals[g.key]}</strong>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="grid gap-5 border-t border-line pt-4 sm:grid-cols-2">
            {([['Dosažené cíle', reached, 'good'], ['Nesplněné cíle', unmet, 'bad']] as const).map(([title, list, tone]) => (
              <div key={title} className="min-w-0">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">{title} <Pill tone={tone}>{list.length}</Pill></h3>
                {list.length === 0 ? <p className="text-sm text-ink-faint">Žádné.</p> : (
                  <ul className="flex flex-col gap-2">
                    {list.slice(0, 4).map((g) => (
                      <li key={g.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                        <Link to={`/zaci/${g.studentId}`} className="font-semibold hover:text-sea-600">{sName(g.studentId)}</Link>
                        <span className="text-ink-faint"> · {fmtShort(g.setOn)}</span>
                        <div className="text-ink-soft">{g.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Poslední změny" className="min-w-0">
          <ul className="flex flex-col gap-3">
            {db.audit.slice(0, 7).map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 rounded-lg bg-sea-50 px-2 py-0.5 text-xs font-semibold text-sea-700">{e.entity}</span>
                <span className="min-w-0 flex-1"><span className="font-semibold">{e.action}</span> · {e.label}</span>
                <span className="shrink-0 text-xs text-ink-faint">{relative(e.at)}</span>
              </li>
            ))}
          </ul>
          {last && <p className="mt-3 text-xs text-ink-faint">Poslední hodnocení: {fmt(last.date)}</p>}
        </Card>
      </div>
    </>
  )
}
