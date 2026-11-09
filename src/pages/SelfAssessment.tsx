import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpenCheck, Check, CheckCircle2, CircleAlert, Loader2, MessageSquarePlus, Paperclip } from 'lucide-react'
import { checkSelfCode, submitSelfAssessment, useDB } from '../lib/store'
import { remoteEnabled, selfFormForCode, submitSelf, uploadStudentFile } from '../lib/remote'
import { fmt } from '../lib/dates'
import { GOAL_MET_LABEL, selfFormFor } from '../lib/questionnaire'
import type { Assessment, PeriodType, SelfAnswers, SelfFormDef, SelfWording } from '../lib/types'
import { fmtSize } from '../lib/files'
import { AttachmentList, AttachmentUpload } from '../components/Attachments'
import { cx } from '../components/ui'

/*
 * Stránka pro žáka (QR / odkaz od učitele). Bez účtu – kód platí jen pro jedno hodnocení,
 * časově omezeně a jednorázově. Žák vidí jen údaje o své hodině či období a své odpovědi.
 * Otázky odpovídají hodnocenému období (případně je upravil učitel).
 */

type Key = 'understanding' | 'work' | 'wentWell' | 'improve' | 'goalMet'
type Draft = Partial<Omit<SelfAnswers, 'nextWish' | 'notes'>> & { nextWish: string; notes: Partial<Record<Key, string>> }
const REQUIRED: Key[] = ['understanding', 'work', 'wentWell', 'improve', 'goalMet']

function Question({ n, id, title, hint, required, error, note, onNote, children }: {
  n: number; id: string; title: string; hint?: string; required?: boolean; error?: boolean; note?: string; onNote?: (v: string) => void; children: ReactNode
}) {
  const [showNote, setShowNote] = useState(!!note)
  return (
    <fieldset id={id} className={cx('scroll-mt-6 rounded-2xl border bg-surface p-4 sm:p-5', error ? 'border-bad' : 'border-line')}>
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
      {error && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-bad" role="alert"><CircleAlert size={15} /> Vyber prosím odpověď.</p>}
      {onNote &&
        (showNote ? (
          <textarea
            id={`${id}-poznamka`}
            aria-label={`Poznámka k otázce ${n}`}
            rows={2}
            maxLength={300}
            value={note ?? ''}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Vlastní poznámka (nepovinné)"
            className="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[15px] focus:border-sea-500 focus:outline-none"
          />
        ) : (
          <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sea-600" onClick={() => setShowNote(true)}>
            <MessageSquarePlus size={15} /> Doplnit poznámku
          </button>
        ))}
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
      <span className={cx('grid h-5 w-5 shrink-0 place-items-center border-2', multi ? 'rounded-md' : 'rounded-full', selected ? 'border-sea-500 bg-sea-500 text-white' : 'border-ink-faint')} aria-hidden="true">
        {selected && <Check size={13} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

/** Co žák na stránce vidí – v demu z dat v prohlížeči, se serverem z RPC podle kódu. */
interface View {
  assessmentId: string
  date: string
  goals: { id: string; text: string }[]
  student: string
  className: string
  subject: string
  form: SelfFormDef
  correction: boolean
  previous?: SelfAnswers
  files: { id: string; name: string; size: number }[]
}
type Loaded = { view: View } | { error: 'neplatny' | 'vyprsel' | 'odeslano' } | null

function useLocalView(code: string): Loaded {
  const db = useDB()
  if (remoteEnabled) return null
  const check = checkSelfCode(code)
  if (!check.ok) return { error: check.reason }
  const a = check.assessment
  const st = db.students.find((s) => s.id === a.studentId)
  const cls = st ? db.classes.find((c) => c.id === st.classId) : undefined
  return {
    view: {
      assessmentId: a.id,
      date: a.date,
      goals: a.goals,
      student: st ? `${st.firstName} ${st.lastName}` : '',
      className: cls?.name ?? '',
      subject: db.subjects.find((s) => s.id === a.subjectId)?.name ?? '',
      form: a.selfForm ?? selfFormFor(a.periodType, a.periodFrom, a.periodTo, cls?.selfWording),
      correction: check.correction,
      previous: check.previous?.answers,
      files: [],
    },
  }
}

function useRemoteView(code: string): [Loaded, (f: { id: string; name: string; size: number }) => void, string] {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!remoteEnabled) return
    selfFormForCode(code)
      .then((r) => {
        if (r.error) return setLoaded({ error: r.error as 'neplatny' })
        const a = r.assessment as Pick<Assessment, 'id' | 'date' | 'goals' | 'selfForm'> & { periodType: PeriodType; periodFrom: string; periodTo: string }
        const st = r.student as { firstName: string; lastName: string }
        const cls = r.class as { name: string; selfWording?: SelfWording }
        setLoaded({
          view: {
            assessmentId: a.id,
            date: a.date,
            goals: a.goals ?? [],
            student: `${st.firstName} ${st.lastName}`,
            className: cls.name,
            subject: (r.subject as { name: string }).name,
            form: a.selfForm ?? selfFormFor(a.periodType, a.periodFrom, a.periodTo, cls.selfWording ?? undefined),
            correction: !!r.correction,
            previous: (r.previous as SelfAnswers | null) ?? undefined,
            files: (r.attachments as View['files']) ?? [],
          },
        })
      })
      .catch(() => setErr('Nepodařilo se spojit se serverem. Zkontroluj připojení a obnov stránku.'))
  }, [code])
  const addFile = (f: View['files'][number]) => setLoaded((l) => (l && 'view' in l ? { view: { ...l.view, files: [...l.view.files, f] } } : l))
  return [loaded, addFile, err]
}

/** Každý kód = nová stránka (stav se nepřenáší mezi odkazy). */
export default function SelfAssessmentPage() {
  const { code = '' } = useParams()
  return <SelfPage key={code} code={code} />
}

function SelfPage({ code }: { code: string }) {
  const local = useLocalView(code)
  const [remote, addFile, netErr] = useRemoteView(code)
  const [done, setDone] = useState<null | 'new' | 'fixed'>(null)
  const loaded = remoteEnabled ? remote : local
  const header = (
    <div className="mb-6 flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white"><BookOpenCheck size={20} /></span>
      <span className="font-display text-lg font-bold">Sebehodnocení žáka</span>
    </div>
  )
  const shell = (children: ReactNode) => (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl">
        {header}
        {children}
      </div>
    </div>
  )

  if (done)
    return shell(
      <div className="rounded-2xl border border-line bg-surface p-8 text-center" role="status">
        <CheckCircle2 size={48} className="mx-auto text-good" />
        <h1 className="mt-3 text-2xl font-bold">{done === 'fixed' ? 'Oprava uložena' : 'Sebehodnocení uloženo'}</h1>
        <p className="mt-2 text-ink-soft">Tvoje odpovědi se úspěšně uložily. Učitel je uvidí vedle svého hodnocení a další cíl si stanovíte spolu.</p>
        <p className="mt-4 text-sm text-ink-faint">Tuto stránku můžeš zavřít.</p>
      </div>,
    )

  if (netErr) return shell(<div className="rounded-2xl border border-line bg-surface p-8" role="alert">{netErr}</div>)
  if (!loaded)
    return shell(
      <div className="flex items-center gap-2 text-ink-faint" role="status"><Loader2 size={18} className="animate-spin" /> Načítám dotazník…</div>,
    )

  if ('error' in loaded)
    return shell(
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-bold">{loaded.error === 'vyprsel' ? 'Odkaz vypršel' : loaded.error === 'odeslano' ? 'Už odesláno' : 'Kód neplatí'}</h1>
        <p className="mt-1 text-ink-soft">
          {loaded.error === 'vyprsel'
            ? 'Platnost odkazu skončila. Požádej učitele o nový.'
            : loaded.error === 'odeslano'
              ? 'Sebehodnocení k tomuto hodnocení už je odeslané. Pokud chceš něco opravit, požádej učitele o odkaz pro opravu.'
              : `Kód „${code}“ neexistuje nebo už byl použit. Požádej učitele o nový odkaz.`}
        </p>
      </div>,
    )

  return (
    <SelfForm
      key={loaded.view.assessmentId}
      code={code}
      view={loaded.view}
      header={header}
      onFile={addFile}
      onDone={() => {
        setDone(loaded.view.correction ? 'fixed' : 'new')
        window.scrollTo({ top: 0 })
      }}
    />
  )
}

function SelfForm({ code, view, header, onFile, onDone }: {
  code: string
  view: View
  header: ReactNode
  onFile: (f: View['files'][number]) => void
  onDone: () => void
}) {
  const db = useDB()
  const prev = view.previous
  const [ans, setAns] = useState<Draft>(() => (prev ? { ...prev, notes: prev.notes ?? {} } : { nextWish: '', wentWell: [], improve: [], notes: {} }))
  const [errors, setErrors] = useState<Key[]>([])
  const [busy, setBusy] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const form = view.form

  const single = <K extends 'understanding' | 'work' | 'goalMet'>(k: K, v: NonNullable<Draft[K]>) => {
    setAns((s) => ({ ...s, [k]: v }))
    setErrors((e) => e.filter((x) => x !== k))
  }
  const multi = (k: 'wentWell' | 'improve', v: string) => {
    const excl = form?.improve.exclusive
    setAns((s) => {
      const cur = s[k] ?? []
      let next: string[]
      if (k === 'improve' && excl && v === excl) next = cur.includes(excl) ? [] : [excl]
      else {
        const base = k === 'improve' && excl ? cur.filter((x) => x !== excl) : cur
        next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v]
      }
      return { ...s, [k]: next }
    })
    setErrors((e) => e.filter((x) => x !== k))
  }
  const setNote = (k: Key) => (v: string) => setAns((s) => ({ ...s, notes: { ...s.notes, [k]: v } }))

  async function submit(e: React.FormEvent) {
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
    const notes = Object.fromEntries(Object.entries(ans.notes).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v!.trim().slice(0, 300)]))
    const answers = { ...(ans as SelfAnswers), notes }
    setSendErr('')
    setBusy(true)
    try {
      const ok = remoteEnabled ? await submitSelf(code, answers, form) : submitSelfAssessment(code, answers, form)
      if (ok) onDone()
      else setSendErr('Odpovědi se nepodařilo uložit – odkaz už možná neplatí. Požádej učitele o nový.')
    } catch {
      setSendErr('Nepodařilo se spojit se serverem. Zkus to prosím znovu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto max-w-xl">
        {header}
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h1 className="text-2xl font-bold">Ahoj, jak se ti dařilo?</h1>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-faint">Žák</dt><dd className="font-semibold">{view.student}</dd>
              <dt className="text-ink-faint">Třída</dt><dd>{view.className}</dd>
              <dt className="text-ink-faint">Předmět</dt><dd>{view.subject}</dd>
              <dt className="text-ink-faint">Období</dt><dd>{form.rangeLabel ?? fmt(view.date)}</dd>
              {view.goals.length > 0 && (
                <>
                  <dt className="text-ink-faint">{view.goals.length > 1 ? 'Cíle' : 'Cíl'}</dt>
                  <dd><ul className="flex flex-col gap-0.5">{view.goals.map((g) => <li key={g.id}>{g.text}</li>)}</ul></dd>
                </>
              )}
            </dl>
            {view.correction && <p className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">Opravuješ už odeslané odpovědi. Uloží se nová verze.</p>}
            <p className="mt-3 text-sm text-ink-faint">Otázky označené <span className="text-bad">*</span> jsou povinné. Zabere to asi 1–2 minuty.</p>
          </div>

          <Question id="otazka-understanding" n={1} title={form.understanding.title} required error={errors.includes('understanding')} note={ans.notes.understanding} onNote={setNote('understanding')}>
            <div className="flex flex-col gap-2" role="radiogroup">
              {form.understanding.options.map((o) => <Choice key={o.value} selected={ans.understanding === o.value} onClick={() => single('understanding', o.value)}>{o.label}</Choice>)}
            </div>
          </Question>
          <Question id="otazka-work" n={2} title={form.work.title} required error={errors.includes('work')} note={ans.notes.work} onNote={setNote('work')}>
            <div className="flex flex-col gap-2" role="radiogroup">
              {form.work.options.map((o) => <Choice key={o.value} selected={ans.work === o.value} onClick={() => single('work', o.value)}>{o.label}</Choice>)}
            </div>
          </Question>
          <Question id="otazka-wentWell" n={3} title={form.wentWell.title} hint="Můžeš vybrat více možností." required error={errors.includes('wentWell')} note={ans.notes.wentWell} onNote={setNote('wentWell')}>
            <div className="flex flex-col gap-2" role="group">
              {form.wentWell.options.map((o) => <Choice key={o.id} multi selected={!!ans.wentWell?.includes(o.id)} onClick={() => multi('wentWell', o.id)}>{o.label}</Choice>)}
            </div>
          </Question>
          <Question id="otazka-improve" n={4} title={form.improve.title} hint={form.improve.exclusive ? 'Můžeš vybrat více možností. Poslední volba platí samostatně.' : 'Můžeš vybrat více možností.'} required error={errors.includes('improve')} note={ans.notes.improve} onNote={setNote('improve')}>
            <div className="flex flex-col gap-2" role="group">
              {form.improve.options.map((o) => (
                <div key={o.id} className={o.id === form.improve.exclusive ? 'mt-1 border-t border-dashed border-line pt-3' : ''}>
                  <Choice multi selected={!!ans.improve?.includes(o.id)} onClick={() => multi('improve', o.id)}>{o.label}</Choice>
                </div>
              ))}
            </div>
          </Question>
          <Question id="otazka-goalMet" n={5} title={form.goalMet.title} required error={errors.includes('goalMet')} note={ans.notes.goalMet} onNote={setNote('goalMet')}>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {(['ano', 'castecne', 'zatimne'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={ans.goalMet === v}
                  onClick={() => single('goalMet', v)}
                  className={cx('min-h-12 rounded-xl border px-2 text-[15px] font-semibold', ans.goalMet === v ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface hover:border-ink-faint')}
                >
                  {GOAL_MET_LABEL[v]}
                </button>
              ))}
            </div>
          </Question>
          <Question id="otazka-nextWish" n={6} title={form.nextWish.title}>
            <textarea
              id="zak-nextWish"
              aria-label={form.nextWish.title}
              rows={3}
              maxLength={500}
              value={ans.nextWish}
              onChange={(e) => setAns((s) => ({ ...s, nextWish: e.target.value }))}
              className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[15px] focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-100"
              placeholder="Vlastní odpověď"
            />
          </Question>

          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="mb-2 font-bold">Přílohy <span className="text-sm font-semibold text-ink-faint">(nepovinné)</span></div>
            <AttachmentUpload
              assessmentId={view.assessmentId}
              owner="zak"
              label="Přiložit fotografii práce, úkol, PDF, dokument nebo prezentaci"
              onUpload={remoteEnabled ? async (f) => onFile(await uploadStudentFile(code, f)) : undefined}
            />
            <div className="mt-2">
              {remoteEnabled ? (
                <ul className="flex flex-col divide-y divide-line">
                  {view.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
                      <Paperclip size={15} className="shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                      <span className="text-xs text-ink-faint">{fmtSize(f.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <AttachmentList items={db.attachments.filter((x) => x.assessmentId === view.assessmentId && x.owner === 'zak')} canDelete empty="" />
              )}
            </div>
          </div>

          {sendErr && <p className="rounded-xl bg-bad-wash px-4 py-3 text-sm font-semibold text-bad" role="alert">{sendErr}</p>}
          {errors.length > 0 && (
            <p className="rounded-xl bg-bad-wash px-4 py-3 text-sm font-semibold text-bad" role="alert">
              Ještě chybí odpověď u otázky {errors.map((k) => REQUIRED.indexOf(k) + 1).join(', ')}.
            </p>
          )}
          <button type="submit" disabled={busy} className="min-h-13 w-full rounded-2xl bg-brand-500 px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {busy ? 'Ukládám…' : view.correction ? 'Uložit opravu' : 'Uložit sebehodnocení'}
          </button>
          <p className="text-center text-xs text-ink-faint">Odpovědi vidí jen tvůj učitel. Nejde o známku – slouží k tomu, abys věděl/a, jak dál.</p>
        </form>
      </div>
    </div>
  )
}
