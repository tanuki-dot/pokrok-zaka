import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { criterionSeries, GOAL_STATUS_LABEL, studentAssessments, trendWord } from '../lib/analysis'
import { levelLabel } from '../lib/levels'
import { periodLabel } from '../lib/periods'
import { allCriteriaFor, fullName } from '../lib/util'
import { fmt } from '../lib/dates'
import { Button } from '../components/ui'

/** #11: Tisk / PDF celé historie hodnocení jednoho žáka (vývoj v čase). */
export default function PrintStudent() {
  const { id } = useParams()
  const { db, subj } = useCtx()
  const st = db.students.find((s) => s.id === id)
  if (!st) return <p className="p-10">Žák nenalezen.</p>
  if (!subj) return <p className="p-10">Vyberte předmět v přehledu aplikace.</p>
  const cls = db.classes.find((c) => c.id === st.classId)
  const school = db.schools.find((s) => s.id === cls?.schoolId)
  const as = studentAssessments(db, st.id, subj.id)
  const crits = allCriteriaFor(db, subj.id)
  const withData = crits.filter((c) => criterionSeries(as, c.id).length > 0)

  return (
    <div className="min-h-full bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center gap-3 px-4">
        <span className="text-sm text-ink-faint">{as.length} hodnocení · {subj.name}</span>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()}><Printer size={16} /> Tisk / uložit jako PDF</Button>
      </div>

      <article className="print-sheet mx-auto max-w-[820px] rounded-2xl border border-line bg-surface px-10 py-10 shadow-sm">
        <header className="border-b-2 border-ink pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{school?.name} · Historie hodnocení</div>
          <h1 className="mt-2 text-[26px] font-bold">{fullName(st)}</h1>
          <div className="mt-1 text-[15px] text-ink-soft">Třída {cls?.name} · {subj.name} · {as.length} hodnocení</div>
        </header>

        {withData.length > 0 && (
          <section className="mt-5 break-inside-avoid">
            <h2 className="mb-2 text-[17px] font-bold">Vývoj dovedností</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-faint"><th className="py-1 pr-3">Dovednost</th><th className="py-1 pr-3">První</th><th className="py-1 pr-3">Poslední</th><th className="py-1">Vývoj</th></tr></thead>
              <tbody className="divide-y divide-line">
                {withData.map((c) => {
                  const s = criterionSeries(as, c.id)
                  const first = s[0].level, last = s.at(-1)!.level
                  return (
                    <tr key={c.id}>
                      <td className="py-1.5 pr-3 font-semibold">{c.name}</td>
                      <td className="py-1.5 pr-3">{levelLabel(first)}</td>
                      <td className="py-1.5 pr-3">{levelLabel(last)}</td>
                      <td className="py-1.5">{s.length > 1 ? trendWord(first, last) : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-ink-faint">Škála 1 = výborně … 5 = zatím nezvládá.</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold">Jednotlivá hodnocení</h2>
          {as.length === 0 ? <p className="text-sm text-ink-soft">Žádná hodnocení.</p> : (
            <ol className="flex flex-col gap-4">
              {[...as].reverse().map((a) => (
                <li key={a.id} className="break-inside-avoid border-t border-line pt-3">
                  <div className="font-bold">{a.topic || periodLabel(a.periodType, a.periodFrom, a.periodTo)} <span className="text-sm font-normal text-ink-soft">· {fmt(a.date)} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)}</span></div>
                  {Object.keys(a.scores).length > 0 && (
                    <div className="mt-1 text-sm">{Object.entries(a.scores).map(([cid, l]) => `${crits.find((c) => c.id === cid)?.name}: ${l}`).join(' · ')}</div>
                  )}
                  {a.goals.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {a.goals.map((g) => <li key={g.id}>{g.text} – <em>{g.status ? GOAL_STATUS_LABEL[g.status].toLowerCase() : 'neoznačeno'}</em></li>)}
                    </ul>
                  )}
                  {a.report?.text && <div className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{a.report.text}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>
        <p className="mt-8 text-xs text-ink-faint">Vyučující: {db.settings.teacherName}.</p>
      </article>
    </div>
  )
}
