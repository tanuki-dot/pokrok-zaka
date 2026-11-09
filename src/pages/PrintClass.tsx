import { useState } from 'react'
import { Printer } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { studentAssessments } from '../lib/analysis'
import { GOAL_STATUS_LABEL } from '../lib/analysis'
import { levelLabel } from '../lib/levels'
import { periodLabel } from '../lib/periods'
import { allCriteriaFor, fullName } from '../lib/util'
import { fmt } from '../lib/dates'
import { Button } from '../components/ui'

/** #11: Hromadný tisk / PDF formativního hodnocení celé třídy (jedno hodnocení na žáka). */
export default function PrintClass() {
  const { db, cls, subj, students } = useCtx()
  const [onlyApproved, setOnlyApproved] = useState(false)
  const school = db.schools.find((s) => s.id === cls?.schoolId)
  const crits = subj ? allCriteriaFor(db, subj.id) : []

  if (!subj || !cls) return <p className="p-10">Vyberte třídu a předmět v přehledu aplikace.</p>

  const rows = students
    .map((st) => {
      const as = studentAssessments(db, st.id, subj.id)
      const approved = as.filter((a) => a.report?.approved)
      const pick = onlyApproved ? approved.at(-1) : (approved.at(-1) ?? as.at(-1))
      return { st, a: pick }
    })
    .filter((r) => r.a)

  return (
    <div className="min-h-full bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-3 px-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={onlyApproved} onChange={(e) => setOnlyApproved(e.target.checked)} /> Jen schválená hodnocení</label>
        <span className="text-sm text-ink-faint">{rows.length} žáků</span>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()}><Printer size={16} /> Tisk / uložit jako PDF</Button>
      </div>

      <article className="print-sheet mx-auto max-w-[820px] rounded-2xl border border-line bg-surface px-10 py-10 shadow-sm">
        <header className="border-b-2 border-ink pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{school?.name} · Formativní hodnocení třídy</div>
          <h1 className="mt-2 text-[26px] font-bold">Třída {cls.name} · {subj.name}</h1>
          <div className="mt-1 text-[15px] text-ink-soft">{rows.length} žáků · vytištěno {fmt(new Date().toISOString().slice(0, 10))}</div>
        </header>

        {rows.length === 0 ? (
          <p className="mt-6 text-ink-soft">Ve vybraném předmětu zatím nejsou {onlyApproved ? 'schválená' : 'žádná'} hodnocení.</p>
        ) : (
          rows.map(({ st, a }) => (
            <section key={st.id} className="mt-6 break-inside-avoid border-t border-line pt-5">
              <h2 className="text-[19px] font-bold">{fullName(st)}</h2>
              <div className="mb-2 text-sm text-ink-soft">{periodLabel(a!.periodType, a!.periodFrom, a!.periodTo)} · {fmt(a!.date)}{a!.report?.approved ? ' · schváleno' : ' · návrh'}</div>
              {Object.keys(a!.scores).length > 0 && (
                <ul className="mb-2 grid gap-0.5 text-sm sm:grid-cols-2">
                  {Object.entries(a!.scores).map(([cid, l]) => (
                    <li key={cid}><strong>{crits.find((c) => c.id === cid)?.name}:</strong> {levelLabel(l)}</li>
                  ))}
                </ul>
              )}
              {a!.goals.length > 0 && (
                <ul className="mb-2 list-disc pl-5 text-sm">
                  {a!.goals.map((g) => <li key={g.id}>{g.text} – <em>{g.status ? GOAL_STATUS_LABEL[g.status].toLowerCase() : 'neoznačeno'}</em></li>)}
                </ul>
              )}
              {a!.report?.text && <div className="whitespace-pre-line text-[15px] leading-relaxed">{a!.report.text}</div>}
            </section>
          ))
        )}
        <p className="mt-8 text-xs text-ink-faint">Škála 1 = výborně … 5 = zatím nezvládá. Vyučující: {db.settings.teacherName}.</p>
      </article>
    </div>
  )
}
