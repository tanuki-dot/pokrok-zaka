import { useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpenCheck, Check, CheckCircle2, CircleAlert } from 'lucide-react'
import { checkSelfCode, submitSelfAssessment, useDB } from '../lib/store'
import { fmt } from '../lib/dates'
import {
  IMPROVE_NOTHING, Q_GOAL_MET, Q_IMPROVE, Q_UNDERSTANDING, Q_WENT_WELL, Q_WORK, QUESTIONS, type Option,
} from '../lib/questionnaire'
import type { SelfAnswers, SelfWording } from '../lib/types'
import { cx } from '../components/ui'

/*
 * Stránka pro žáka (odkaz / QR od učitele). Bez účtu, jen kód platný pro jedno hodnocení.
 * Žák vidí jen údaje o své hodině a své vlastní odpovědi.
 * Univerzální dotazník (dotaznik.docx): otázky 1, 2, 5 jedna odpověď; 3, 4 více odpovědí;
 * 6 nepovinný text. „Nic, dnešní cíl jsem zvládl/a“ nejde kombinovat s jinou volbou.
 */

type Draft = Partial<Omit<SelfAnswers, 'nextWish'>> & { nextWish: string }
type Key = 'understanding' | 'work' | 'wentWell' | 'improve' | 'goalMet'

const REQUIRED: Key[] = ['understanding', 'work', 'wentWell', 'improve', 'goalMet']

function Question({
  n, title, hint, required, error, children, id,
}: { n: number; title: string; hint?: string; required?: boolean; error?: boolean; children: ReactNode; id: string }) {
  return (
    <fieldset id={id} className={cx('scroll-mt-6 rounded-2xl border p-4 sm:p-5', error ? 'border-bad bg-bad-wash/40' : 'border-line')}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-start gap-2.5">
        <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sea-50 text-sm font-bold text-sea-700">{n}</span>
        <div className="min-w-0">
          <div className="text-[17px] font-bold leading-snug">
            {title} {required ? <span className="text-bad" aria-label="povinné">*</span> : <span className="text-sm font-semibold text-ink-faint">(nepovinné)</span>}
          </div>
          {hint && <div className="text-sm text-ink-faint">{hint}</div>}
        </div>
      </div>
      {children}
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-bad" role="alert">
          <CircleAlert size={15} /> Vyber prosím odpověď.
        </p>
      )}
    </fieldset>
  )
}

function Choice({ selected, multi, onClick, children }: { selected: boolean; multi?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] transition-colors',
        selected ? 'border-sea-500 bg-sea-50 font-semibold text-sea-700' : 'border-line bg-surface hover:border-ink-faint',
      )}
    >
      <span
        className={cx(
          'grid h-5 w-5 shrink-0 place-items-center border-2',
          multi ? 'rounded-md' : 'rounded-full',
          selected ? 'border-sea-500 bg-sea-500 text-white' : 'border-ink-faint',
        )}
        aria-hidden="true"
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

export default function SelfAssessmentPage() {
  const { code = '' } = useParams()
  const db = useDB()
  const [done, setDone] = useState<null | 'new' | 'fixed'>(null)
  const check = done ? null : checkSelfCode(code)
  const prev = check?.ok ? check.previous?.answers : undefined
  const [ans, setAns] = useState<Draft>(() => (prev ? { ...prev } : { nextWish: '', wentWell: [], improve: [] }))
  const [errors, setErrors] = useState<Key[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  const a = check?.ok ? check.assessment : undefined
  const subj = a ? db.subjects.find((s) => s.id === a.subjectId) : undefined
  const st = a ? db.students.find((s) => s.id === a.studentId) : undefined
  const cls = st ? db.classes.find((c) => c.id === st.classId) : undefined
  const w: SelfWording = cls?.selfWording ?? 'standard'

  const single = <K extends 'understanding' | 'work' | 'goalMet'>(k: K, v: NonNullable<Draft[K]>) => {
    setAns((s) => ({ ...s, [k]: v }))
    setErrors((e) => e.filter((x) => x !== k))
  }
  const multi = (k: 'wentWell' | 'improve', v: string) => {
    setAns((s) => {
      const cur = s[k] ?? []
      let next: string[]
      if (k === 'improve' && v === IMPROVE_NOTHING) {
        // „Nic, dnešní cíl jsem zvládl/a“ je samostatná volba – zruší ostatní.
        next = cur.includes(IMPROVE_NOTHING) ? [] : [IMPROVE_NOTHING]
      } else {
        const base = k === 'improve' ? cur.filter((x) => x !== IMPROVE_NOTHING) : cur
        next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v]
      }
      return { ...s, [k]: next }
    })
    setErrors((e) => e.filter((x) => x !== k))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const missing = REQUIRED.filter((k) => {
      const v = ans[k]
      return Array.isArray(v) ? v.length === 0 : v === undefined
    })
    setErrors(missing)
    if (missing.length) {
      document.getElementById(`otazka-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (submitSelfAssessment(code, ans as SelfAnswers)) {
      setDone(check?.ok && check.correction ? 'fixed' : 'new')
      window.scrollTo({ top: 0 })
    }
  }

  const header = (
    <div className="mb-6 flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white"><BookOpenCheck size={20} /></span>
      <span className="font-display text-lg font-bold">Sebehodnocení žáka</span>
    </div>
  )

  if (done)
    return (
      <div className="min-h-full bg-canvas px-4 py-8">
        <div className="mx-auto max-w-xl">
          {header}
          <div className="rounded-2xl border border-line bg-surface p-8 text-center" role="status">
            <CheckCircle2 size={48} className="mx-auto text-good" />
            <h1 className="mt-3 text-2xl font-bold">{done === 'fixed' ? 'Oprava uložena' : 'Odesláno, děkujeme'}</h1>
            <p className="mt-2 text-ink-soft">Tvoje odpovědi se úspěšně uložily. Učitel je uvidí vedle svého hodnocení a další cíl si stanovíte spolu.</p>
            <p className="mt-4 text-sm text-ink-faint">Tuto stránku můžeš zavřít.</p>
          </div>
        </div>
      </div>
    )

  if (!check?.ok)
    return (
      <div className="min-h-full bg-canvas px-4 py-8">
        <div className="mx-auto max-w-xl">
          {header}
          <div className="rounded-2xl border border-line bg-surface p-8">
            <h1 className="text-xl font-bold">
              {check?.reason === 'vyprsel' ? 'Odkaz vypršel' : check?.reason === 'odeslano' ? 'Už odesláno' : 'Kód neplatí'}
            </h1>
            <p className="mt-1 text-ink-soft">
              {check?.reason === 'vyprsel'
                ? 'Platnost odkazu skončila. Požádej učitele o nový.'
                : check?.reason === 'odeslano'
                  ? 'Sebehodnocení k této hodině už je odeslané. Pokud chceš něco opravit, požádej učitele o odkaz pro opravu.'
                  : `Kód „${code}“ neexistuje nebo už byl použit. Požádej učitele o nový odkaz.`}
            </p>
          </div>
        </div>
      </div>
    )

  const opts = <V extends string | number>(list: Option<V>[]) => list.map((o) => ({ value: o.value, label: o.label[w] }))

  return (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl">
        {header}
        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h1 className="text-2xl font-bold">Ahoj {st?.firstName}, jak ti to dnes šlo?</h1>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-faint">Žák</dt><dd className="font-semibold">{st?.firstName} {st?.lastName}</dd>
              <dt className="text-ink-faint">Třída</dt><dd>{cls?.name}</dd>
              <dt className="text-ink-faint">Předmět</dt><dd>{subj?.name}</dd>
              <dt className="text-ink-faint">Datum</dt><dd>{fmt(a!.date)}</dd>
              {a!.topic && (<><dt className="text-ink-faint">Téma</dt><dd>{a!.topic}</dd></>)}
              {a!.goal && (<><dt className="text-ink-faint">Cíl hodiny</dt><dd>{a!.goal}</dd></>)}
            </dl>
            {check.correction && <p className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">Opravuješ už odeslané odpovědi. Uloží se nová verze.</p>}
            <p className="mt-3 text-sm text-ink-faint">Otázky označené <span className="text-bad">*</span> jsou povinné. Zabere to asi 1–2 minuty.</p>
          </div>

          <Question id="otazka-understanding" n={1} title={QUESTIONS.understanding[w]} required error={errors.includes('understanding')}>
            <div className="flex flex-col gap-2" role="radiogroup">
              {opts(Q_UNDERSTANDING).map((o) => <Choice key={o.value} selected={ans.understanding === o.value} onClick={() => single('understanding', o.value)}>{o.label}</Choice>)}
            </div>
          </Question>

          <Question id="otazka-work" n={2} title={QUESTIONS.work[w]} required error={errors.includes('work')}>
            <div className="flex flex-col gap-2" role="radiogroup">
              {opts(Q_WORK).map((o) => <Choice key={o.value} selected={ans.work === o.value} onClick={() => single('work', o.value)}>{o.label}</Choice>)}
            </div>
          </Question>

          <Question id="otazka-wentWell" n={3} title={QUESTIONS.wentWell[w]} hint="Můžeš vybrat více možností." required error={errors.includes('wentWell')}>
            <div className="flex flex-col gap-2" role="group">
              {opts(Q_WENT_WELL).map((o) => <Choice key={o.value} multi selected={!!ans.wentWell?.includes(o.value)} onClick={() => multi('wentWell', o.value)}>{o.label}</Choice>)}
            </div>
          </Question>

          <Question id="otazka-improve" n={4} title={QUESTIONS.improve[w]} hint="Můžeš vybrat více možností. Poslední volba platí samostatně." required error={errors.includes('improve')}>
            <div className="flex flex-col gap-2" role="group">
              {opts(Q_IMPROVE).map((o) => (
                <div key={o.value} className={o.value === IMPROVE_NOTHING ? 'mt-1 border-t border-dashed border-line pt-3' : ''}>
                  <Choice multi selected={!!ans.improve?.includes(o.value)} onClick={() => multi('improve', o.value)}>{o.label}</Choice>
                </div>
              ))}
            </div>
          </Question>

          <Question id="otazka-goalMet" n={5} title={QUESTIONS.goalMet[w]} required error={errors.includes('goalMet')}>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {opts(Q_GOAL_MET).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={ans.goalMet === o.value}
                  onClick={() => single('goalMet', o.value)}
                  className={cx(
                    'min-h-12 rounded-xl border px-2 text-[15px] font-semibold',
                    ans.goalMet === o.value ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface hover:border-ink-faint',
                  )}
                >
                  {o.label.replace(/\.$/, '')}
                </button>
              ))}
            </div>
          </Question>

          <Question id="otazka-nextWish" n={6} title={QUESTIONS.nextWish[w]}>
            <textarea
              id="zak-nextWish"
              aria-label={QUESTIONS.nextWish[w]}
              rows={3}
              maxLength={500}
              value={ans.nextWish}
              onChange={(e) => setAns((s) => ({ ...s, nextWish: e.target.value }))}
              className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[15px] focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-100"
              placeholder="Napiš krátce, co chceš příště zvládnout lépe."
            />
          </Question>

          {errors.length > 0 && (
            <p className="rounded-xl bg-bad-wash px-4 py-3 text-sm font-semibold text-bad" role="alert">
              Ještě chybí odpověď u otázky {errors.map((k) => REQUIRED.indexOf(k) + 1).join(', ')}.
            </p>
          )}
          <button type="submit" className="min-h-13 w-full rounded-2xl bg-brand-500 px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-600">
            {check.correction ? 'Uložit opravu' : 'Odeslat učiteli'}
          </button>
          <p className="text-center text-xs text-ink-faint">Odpovědi vidí jen tvůj učitel. Nejde o známku – slouží k tomu, abys věděl/a, jak dál.</p>
        </form>
      </div>
    </div>
  )
}
