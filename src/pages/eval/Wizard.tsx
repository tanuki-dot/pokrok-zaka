import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ClipboardPen, History, Trash2 } from 'lucide-react'
import { deleteAssessment, useDB } from '../../lib/store'
import { periodLabel } from '../../lib/periods'
import { fullName } from '../../lib/util'
import { fmt } from '../../lib/dates'
import type { Assessment } from '../../lib/types'
import { Button, cx, PageHeader, Pill } from '../../components/ui'
import StepStudent from './StepStudent'
import StepTeacher from './StepTeacher'
import StepSelf from './StepSelf'
import StepReport from './StepReport'

/*
 * Průvodce hodnocením (pokrokveskole.docx, snímky 2–5):
 * Údaje o žákovi → Hodnocení učitele → Sebehodnocení žáka → Formativní hodnocení → Historie.
 * Všechny kroky pracují se stejným žákem, předmětem a obdobím (jeden záznam hodnocení).
 */

export type StepKey = 'udaje' | 'ucitel' | 'zak' | 'zprava'
export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'udaje', label: 'Údaje o žákovi' },
  { key: 'ucitel', label: 'Hodnocení učitele' },
  { key: 'zak', label: 'Sebehodnocení žáka' },
  { key: 'zprava', label: 'Formativní hodnocení' },
]

export interface StepProps {
  a?: Assessment
  /** Krok ohlásí neuložené změny (kvůli upozornění při odchodu). */
  setDirty: (dirty: boolean) => void
  /** Po uložení: přejít na další krok. */
  goTo: (step: StepKey, id?: string) => void
}

function done(db: ReturnType<typeof useDB>, a: Assessment | undefined, step: StepKey) {
  if (!a) return false
  if (step === 'udaje') return true
  if (step === 'ucitel') return Object.keys(a.scores).length > 0
  if (step === 'zak') return db.selfAssessments.some((s) => s.assessmentId === a.id)
  return !!a.report?.approved
}

export default function Wizard() {
  const { id, step: stepParam } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const a = id ? db.assessments.find((x) => x.id === id) : undefined
  // Bez zadaného kroku: otevřít první nedokončený krok (u dokončeného hodnocení zprávu).
  const step: StepKey = STEPS.some((s) => s.key === stepParam)
    ? (stepParam as StepKey)
    : a
      ? (['ucitel', 'zak', 'zprava'] as StepKey[]).find((k) => !done(db, a, k)) ?? 'zprava'
      : 'udaje'
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Zabránit nechtěné ztrátě údajů při zavření stránky.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const goTo = useCallback(
    (s: StepKey, newId?: string) => {
      const target = newId ?? a?.id
      setDirty(false)
      nav(target ? `/hodnoceni/${target}/${s}` : '/hodnoceni/nove')
      window.scrollTo({ top: 0 })
    },
    [a?.id, nav],
  )

  const guarded = (s: StepKey) => {
    if (s === step) return
    if (dirty && !window.confirm('Máte neuložené změny. Opravdu chcete odejít bez uložení?')) return
    goTo(s)
  }

  if (id && !a) {
    return (
      <>
        <PageHeader title="Hodnocení nenalezeno" icon={<ClipboardPen size={28} />} />
        <Link to="/historie" className="font-semibold text-sea-600">Zpět na historii hodnocení</Link>
      </>
    )
  }

  const st = a ? db.students.find((s) => s.id === a.studentId) : undefined
  const subj = a ? db.subjects.find((s) => s.id === a.subjectId) : undefined
  const cls = st ? db.classes.find((c) => c.id === st.classId) : undefined
  const idx = STEPS.findIndex((s) => s.key === step)

  const props: StepProps = { a, setDirty, goTo }

  return (
    <>
      <PageHeader
        icon={<ClipboardPen size={28} />}
        title={a ? 'Hodnocení žáka' : 'Nové hodnocení'}
        subtitle={a ? `Vytvořeno ${fmt(a.createdAt.slice(0, 10))} · naposledy upraveno ${new Date(a.updatedAt).toLocaleString('cs-CZ')}` : 'Vyplňte údaje o žákovi, hodnocení učitele, získejte sebehodnocení žáka a nechte vytvořit formativní hodnocení.'}
        actions={
          a &&
          (confirmDelete ? (
            <div className="flex items-center gap-2 text-sm">
              Smazat celé hodnocení?
              <Button variant="danger" onClick={() => { deleteAssessment(a.id); nav('/historie') }}>Smazat</Button>
              <Button onClick={() => setConfirmDelete(false)}>Ponechat</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Smazat hodnocení</Button>
          ))
        }
      />

      {/* Aktuálně vybraný žák, předmět a období */}
      {a && st && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sea-100 bg-sea-50 px-4 py-3 text-sm">
          <span className="font-bold text-sea-700">{fullName(st)}</span>
          <span className="text-ink-soft">· {cls?.name} · {subj?.name} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)}</span>
          <Pill tone={a.status === 'dokoncene' ? 'good' : 'warn'} className="ml-auto">{a.status === 'dokoncene' ? 'dokončeno' : 'rozpracováno'}</Pill>
        </div>
      )}

      {/* Navigace mezi snímky */}
      <nav aria-label="Kroky hodnocení" className="mb-5 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((s, i) => {
            const enabled = i === 0 || !!a
            const isDone = done(db, a, s.key)
            return (
              <li key={s.key}>
                <button
                  disabled={!enabled}
                  onClick={() => guarded(s.key)}
                  aria-current={step === s.key ? 'step' : undefined}
                  className={cx(
                    'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                    step === s.key ? 'border-sea-500 bg-sea-500 text-white' : enabled ? 'border-line bg-surface text-ink-soft hover:border-sea-500' : 'border-line bg-canvas text-ink-faint',
                  )}
                >
                  <span className={cx('tabular grid h-6 w-6 place-items-center rounded-full text-xs', step === s.key ? 'bg-white/20' : isDone ? 'bg-good-wash text-good' : 'bg-muted')}>
                    {isDone && step !== s.key ? <Check size={13} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
          {a && (
            <li>
              <Link to={`/zaci/${a.studentId}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft hover:border-sea-500">
                <History size={15} /> Historie pokroku
              </Link>
            </li>
          )}
        </ol>
      </nav>

      {step === 'udaje' && <StepStudent key={a?.id ?? 'nove'} {...props} />}
      {step === 'ucitel' && a && <StepTeacher key={a.id} {...props} />}
      {step === 'zak' && a && <StepSelf key={a.id} {...props} />}
      {step === 'zprava' && a && <StepReport key={a.id} {...props} />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {idx > 0 ? (
          <Button onClick={() => guarded(STEPS[idx - 1].key)}><ArrowLeft size={16} /> {STEPS[idx - 1].label}</Button>
        ) : (
          <span />
        )}
        {a && idx < STEPS.length - 1 && (
          <Button onClick={() => guarded(STEPS[idx + 1].key)}>{STEPS[idx + 1].label} <ArrowRight size={16} /></Button>
        )}
      </div>
    </>
  )
}
