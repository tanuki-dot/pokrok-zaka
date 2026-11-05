import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpenCheck, CheckCircle2 } from 'lucide-react'
import { submitSelfAssessment, useDB } from '../lib/store'
import { fmt } from '../lib/dates'
import { Button, Field, Textarea } from '../components/ui'

/** Stránka pro žáka (odkaz / QR od učitele). Bez účtu, jen jednorázový kód. */
const QUESTIONS = [
  ['learned', 'Co jsem se dnes naučil/a?'],
  ['wentWell', 'Co se mi povedlo?'],
  ['struggle', 'Co mi zatím nejde?'],
  ['needHelp', 'S čím potřebuji pomoc?'],
  ['nextWant', 'Co chci zvládnout příště?'],
] as const

type Answers = Record<(typeof QUESTIONS)[number][0], string>

export default function SelfAssessmentPage() {
  const { code = '' } = useParams()
  const db = useDB()
  const a = db.assessments.find((x) => x.selfCode === code.toUpperCase())
  const [ans, setAns] = useState<Answers>({ learned: '', wentWell: '', struggle: '', needHelp: '', nextWant: '' })
  const [done, setDone] = useState(false)
  const subj = a ? db.subjects.find((s) => s.id === a.subjectId) : undefined
  const st = a ? db.students.find((s) => s.id === a.studentId) : undefined

  return (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white"><BookOpenCheck size={20} /></span>
          <span className="font-display text-lg font-bold">Pokrok žáka · sebehodnocení</span>
        </div>
        {done ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <CheckCircle2 size={44} className="mx-auto text-lv1" />
            <h1 className="mt-3 text-2xl font-bold">Díky, odesláno</h1>
            <p className="mt-1 text-ink-soft">Učitel uvidí tvoje odpovědi vedle svého hodnocení. Další cíl si stanovíte spolu.</p>
          </div>
        ) : !a ? (
          <div className="rounded-2xl border border-line bg-white p-8">
            <h1 className="text-xl font-bold">Kód už neplatí</h1>
            <p className="mt-1 text-ink-soft">Kód „{code}“ neexistuje nebo už byl použit. Požádej učitele o nový odkaz.</p>
          </div>
        ) : (
          <form
            className="rounded-2xl border border-line bg-white p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault()
              if (submitSelfAssessment(a.selfCode!, ans)) setDone(true)
            }}
          >
            <p className="text-sm font-semibold text-ink-faint">{subj?.name} · {fmt(a.date)}</p>
            <h1 className="mt-1 text-2xl font-bold">Ahoj {st?.firstName}, jak ti to dnes šlo?</h1>
            {a.topic && <p className="mt-2 text-ink-soft"><strong className="text-ink">Téma:</strong> {a.topic}</p>}
            {a.goal && <p className="mt-1 text-ink-soft"><strong className="text-ink">Cíl hodiny:</strong> {a.goal}</p>}
            <div className="mt-6 flex flex-col gap-4">
              {QUESTIONS.map(([k, q]) => (
                <Field key={k} label={q}>
                  <Textarea id={`zak-${k}`} rows={2} value={ans[k]} onChange={(e) => setAns({ ...ans, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
            <Button type="submit" variant="brand" className="mt-6 w-full py-3 text-base" disabled={!Object.values(ans).some((v) => v.trim())}>
              Odeslat učiteli
            </Button>
            <p className="mt-3 text-center text-xs text-ink-faint">Odpovědi vidí jen tvůj učitel. Odkaz jde použít jen jednou.</p>
          </form>
        )}
      </div>
    </div>
  )
}
