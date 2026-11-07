import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useDB } from '../lib/store'
import { fmt, KIND_LABEL } from '../lib/dates'
import { Button } from '../components/ui'

/** Tisková podoba schváleného souhrnu (Tisk → Uložit jako PDF). */
export default function PrintSummary() {
  const { id } = useParams()
  const db = useDB()
  const sum = db.summaries.find((s) => s.id === id)
  if (!sum) return <p className="p-10">Souhrn nenalezen.</p>
  if (sum.status !== 'schvaleno')
    return <p className="p-10">Tento souhrn ještě není schválený. Tisknout jde jen schválená verze.</p>

  const st = db.students.find((s) => s.id === sum.studentId)
  const subj = db.subjects.find((s) => s.id === sum.subjectId)
  const cls = db.classes.find((c) => c.id === st?.classId)
  const school = db.schools.find((s) => s.id === cls?.schoolId)

  return (
    <div className="min-h-full bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[800px] items-center justify-between px-4">
        <span className="text-sm text-ink-soft">Náhled tisku. V dialogu tisku zvolte „Uložit jako PDF“.</span>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Tisk / PDF</Button>
      </div>
      <article className="print-sheet mx-auto max-w-[800px] rounded-2xl border border-line bg-surface px-12 py-12 shadow-sm">
        <header className="border-b-2 border-ink pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{school?.name} · {KIND_LABEL[sum.kind]} slovní hodnocení</div>
          <h1 className="mt-2 text-[30px] font-bold">{st?.firstName} {st?.lastName}</h1>
          <div className="mt-1 text-[15px] text-ink-soft">
            Třída {cls?.name} · {subj?.name} · období {fmt(sum.from)} – {fmt(sum.to)}
          </div>
        </header>
        <div className="mt-6 flex flex-col gap-6">
          {sum.sections.map((sec) => (
            <section key={sec.key} className="break-inside-avoid">
              <h2 className="mb-2 text-[17px] font-bold">{sec.title}</h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-relaxed">
                {sec.sentences.filter((s) => s.text.trim()).map((s) => <li key={s.id}>{s.text}</li>)}
              </ul>
            </section>
          ))}
          {sum.teacherNote && (
            <section className="break-inside-avoid">
              <h2 className="mb-2 text-[17px] font-bold">Komentář učitele</h2>
              <p className="text-[15px] leading-relaxed">{sum.teacherNote}</p>
            </section>
          )}
        </div>
        <footer className="mt-10 grid grid-cols-2 gap-10 border-t border-line pt-6 text-sm text-ink-soft">
          <div>
            Schválil/a: {db.settings.teacherName}
            <br />
            Dne {sum.approvedAt ? fmt(sum.approvedAt.slice(0, 10)) : '–'} · verze {sum.version}
          </div>
          <div className="text-right">
            <div className="mt-8 border-t border-ink-faint pt-1">podpis</div>
          </div>
        </footer>
        <p className="mt-8 text-xs text-ink-faint">
          Úrovně 1–5 vyjadřují aktuální zvládnutí dovedností (1 = nejnižší, 5 = nejvyšší). Nejde o školní známky. Žák je porovnáván se svým dřívějším výkonem.
        </p>
      </article>
    </div>
  )
}
