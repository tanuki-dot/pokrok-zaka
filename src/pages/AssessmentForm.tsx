import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Check, ClipboardPen, Copy, Lightbulb, QrCode, RefreshCw, Trash2, X } from 'lucide-react'
import {
  criteriaFor, deleteAssessment, isExpired, issueSelfCode, revokeSelfCode, saveAssessment, SELF_CODE_HOURS, type AssessmentDraft,
} from '../lib/store'
import { useCtx } from '../lib/useCtx'
import { setSelection } from '../lib/selection'
import { formativeText, GOAL_STATUS_LABEL, goalSuggestions, proposeSwot, studentAssessments } from '../lib/analysis'
import { LEVELS, levelLabel, NOT_RATED } from '../lib/levels'
import { describe, isLegacy, teacherBand } from '../lib/questionnaire'
import { fmt, today } from '../lib/dates'
import { fullName } from '../lib/util'
import type { Assessment, Feedback, LessonGoalStatus, Level, SelfAssessment, Swot } from '../lib/types'
import { Button, Card, cx, Field, Input, LevelBadge, PageHeader, Pill, Select, Textarea } from '../components/ui'

const emptySwot: Swot = { s: '', w: '', o: '', t: '', rec: '', proposed: true }

const empty = (studentId: string, subjectId: string): AssessmentDraft => ({
  studentId,
  subjectId,
  date: today(),
  topic: '',
  goal: '',
  goalStatus: null,
  skills: [],
  scores: {},
  feedback: { good: '', todo: '', next: '' },
  swot: emptySwot,
  formative: '',
  formativeProposed: true,
  nextGoal: '',
})

const swotEmpty = (s: Swot) => !s.s && !s.w && !s.o && !s.t && !s.rec

function Step({ n, title, children, aside, optional }: { n: number; title: string; children: ReactNode; aside?: ReactNode; optional?: boolean }) {
  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="tabular grid h-7 w-7 place-items-center rounded-lg bg-sea-50 text-sm font-bold text-sea-700">{n}</span>
        <h2 className="text-[17px] font-bold">{title}</h2>
        {optional && <Pill>nepovinné</Pill>}
        {aside && <div className="ml-auto">{aside}</div>}
      </header>
      {children}
    </Card>
  )
}

const GOAL_STATUSES: LessonGoalStatus[] = ['splneno', 'castecne', 'nesplneno']
const GOAL_TONE: Record<LessonGoalStatus, string> = {
  splneno: 'bg-good-wash text-good border-good/40',
  castecne: 'bg-warn-wash text-warn border-warn/40',
  nesplneno: 'bg-bad-wash text-bad border-bad/40',
}

export default function AssessmentForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { db, cls, subj, students } = useCtx()
  const existing = id ? db.assessments.find((a) => a.id === id) : undefined

  const loc = useLocation()
  const carry = (loc.state as { carry?: Partial<AssessmentDraft> } | null)?.carry
  const [draft, setDraft] = useState<AssessmentDraft>(() => {
    if (existing) {
      return {
        ...existing,
        skills: existing.skills ?? Object.keys(existing.scores),
        swot: { ...existing.swot, rec: existing.swot.rec ?? '' },
        formative: existing.formative ?? '',
        formativeProposed: existing.formativeProposed ?? !existing.formative,
      }
    }
    const subjectId = subj?.id ?? ''
    // Dovednosti pro hodinu: jako minule ve třídě, jinak všechny aktivní.
    const lastClass = db.assessments
      .filter((a) => a.subjectId === subjectId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0]
    const skills = lastClass?.skills?.length ? lastClass.skills : criteriaFor(db, subjectId).map((c) => c.id)
    return { ...empty(params.get('zak') ?? students[0]?.id ?? '', subjectId), skills, ...carry }
  })
  const [saved, setSaved] = useState<boolean>(!!(loc.state as { saved?: boolean } | null)?.saved)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2600)
    return () => clearTimeout(t)
  }, [saved])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)

  // Při úpravě existujícího záznamu přepni horní výběr na jeho třídu a předmět.
  useEffect(() => {
    if (existing) {
      const st = db.students.find((s) => s.id === existing.studentId)
      if (st) setSelection({ classId: st.classId, subjectId: existing.subjectId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  // Nový záznam sleduje předmět vybraný nahoře.
  useEffect(() => {
    if (!existing && subj && draft.subjectId !== subj.id) {
      setDraft((d) => ({
        ...d,
        subjectId: subj.id,
        scores: {},
        skills: criteriaFor(db, subj.id).map((c) => c.id),
        studentId: students.some((s) => s.id === d.studentId) ? d.studentId : students[0]?.id ?? '',
      }))
    }
  }, [subj?.id, existing, draft.subjectId, students, db])

  const criteria = useMemo(() => criteriaFor(db, draft.subjectId), [db, draft.subjectId])
  const skills = (draft.skills ?? []).filter((s) => criteria.some((c) => c.id === s))
  const student = db.students.find((s) => s.id === draft.studentId)
  const history = student ? studentAssessments(db, student.id, draft.subjectId).filter((a) => a.id !== existing?.id) : []
  const lastOwn = history.filter((a) => a.date <= draft.date).at(-1) ?? history.at(-1)
  const lastInClass = db.assessments
    .filter((a) => a.subjectId === draft.subjectId && a.topic && a.id !== existing?.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const self = existing ? db.selfAssessments.find((s) => s.assessmentId === existing.id) : undefined
  const live = existing ? db.assessments.find((a) => a.id === existing.id) : undefined

  // SWOT, doporučení a formativní hodnocení se vytváří automaticky z hodnocení,
  // zpětné vazby a sebehodnocení – dokud je učitel neupraví ručně.
  useEffect(() => {
    setDraft((d) => {
      const ref = { ...d, id: existing?.id ?? '' }
      let next = d
      if (d.swot.proposed || swotEmpty(d.swot)) {
        const sw = Object.keys(d.scores).length || d.feedback.good || d.feedback.todo || self ? proposeSwot(db, ref, self) : emptySwot
        if (JSON.stringify(sw) !== JSON.stringify(d.swot)) next = { ...next, swot: sw }
      }
      if (d.formativeProposed || !d.formative) {
        const f = Object.keys(d.scores).length || d.goalStatus || self ? formativeText(db, ref, self) : ''
        if (f !== d.formative) next = { ...next, formative: f, formativeProposed: true }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.scores, draft.feedback, draft.goalStatus, draft.studentId, self?.submittedAt])

  const set = <K extends keyof AssessmentDraft>(k: K, v: AssessmentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setFb = (k: keyof Feedback, v: string) => setDraft((d) => ({ ...d, feedback: { ...d.feedback, [k]: v } }))
  const setSwot = (k: keyof Omit<Swot, 'proposed'>, v: string) => setDraft((d) => ({ ...d, swot: { ...d.swot, [k]: v, proposed: false } }))
  const setScore = (cid: string, l: Level) =>
    setDraft((d) => {
      const scores = { ...d.scores }
      if (scores[cid] === l) delete scores[cid]
      else scores[cid] = l
      return { ...d, scores }
    })
  const toggleSkill = (cid: string) =>
    setDraft((d) => {
      const cur = d.skills ?? []
      if (cur.includes(cid)) {
        const scores = { ...d.scores }
        delete scores[cid]
        return { ...d, skills: cur.filter((x) => x !== cid), scores }
      }
      return { ...d, skills: [...cur, cid] }
    })
  const regenerate = () =>
    setDraft((d) => {
      const ref = { ...d, id: existing?.id ?? '' }
      return { ...d, swot: proposeSwot(db, ref, self), formative: formativeText(db, ref, self), formativeProposed: true }
    })

  const rated = Object.keys(draft.scores).length
  const canSave = !!draft.studentId && !!draft.subjectId && rated > 0

  function save(andNext: boolean) {
    const a = saveAssessment({ ...draft, skills })
    if (andNext) {
      const done = new Set(db.assessments.filter((x) => x.date === draft.date && x.subjectId === draft.subjectId).map((x) => x.studentId))
      done.add(draft.studentId)
      const idx = students.findIndex((s) => s.id === draft.studentId)
      const next = [...students.slice(idx + 1), ...students.slice(0, idx)].find((s) => !done.has(s.id))
      nav('/hodnoceni/nove' + (next ? `?zak=${next.id}` : ''), {
        state: { carry: { date: draft.date, topic: draft.topic, goal: draft.goal, skills }, saved: true },
      })
      window.scrollTo({ top: 0 })
    } else {
      nav(`/hodnoceni/${a.id}`, { replace: true, state: { saved: true } })
      setSaved(true)
    }
  }

  if (!subj || !cls) {
    return (
      <>
        <PageHeader title="Nové hodnocení" icon={<ClipboardPen size={28} />} />
        <Card>Nejdřív založte třídu a předmět v sekci <Link className="font-semibold text-sea-600" to="/tridy">Třídy a žáci</Link>.</Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={<ClipboardPen size={28} />}
        title={existing ? 'Úprava hodnocení' : 'Nové hodnocení'}
        subtitle={
          existing
            ? `Záznam z ${fmt(existing.date)} · naposledy upraveno ${new Date(existing.updatedAt).toLocaleString('cs-CZ')}`
            : 'Vyberu žáka → stanovím vzdělávací cíl → ohodnotím vybrané dovednosti 1–5 → uložím.'
        }
        actions={
          existing &&
          (confirmDelete ? (
            <div className="flex items-center gap-2 text-sm">
              Opravdu smazat záznam?
              <Button variant="danger" onClick={() => { deleteAssessment(existing.id); nav(`/zaci/${existing.studentId}`) }}>Smazat</Button>
              <Button onClick={() => setConfirmDelete(false)}>Ponechat</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Smazat záznam</Button>
          ))
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Step n={1} title="Výběr žáka a předmětu">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
              <Field label="Třída a předmět">
                <div className="flex h-[42px] items-center rounded-xl border border-line bg-canvas px-3 text-[15px]">{cls.name} · {subj.name}</div>
              </Field>
              <Field label="Žák">
                <Select id="zak" value={draft.studentId} onChange={(e) => set('studentId', e.target.value)} disabled={!!existing}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Datum">
                <Input id="datum" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
            </div>
          </Step>

          <Step
            n={2}
            title="Vzdělávací cíl"
            aside={
              !existing &&
              lastInClass && (
                <Button
                  variant="ghost"
                  className="text-sea-600"
                  onClick={() => setDraft((d) => ({ ...d, topic: lastInClass.topic, goal: lastInClass.goal }))}
                >
                  Převzít z hodiny {fmt(lastInClass.date)}
                </Button>
              )
            }
          >
            <div className="grid gap-4">
              <Field label="Téma">
                <Input id="tema" value={draft.topic} placeholder="Např. Práce v Excelu" onChange={(e) => set('topic', e.target.value)} />
              </Field>
              <Field label="Vzdělávací cíl">
                <Textarea id="cil" value={draft.goal} placeholder="Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX." onChange={(e) => set('goal', e.target.value)} />
              </Field>
              <div className="-mt-1 flex flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-sea-600"
                  onClick={() => setSuggestions(goalSuggestions(db, draft.studentId, draft.subjectId, draft.topic))}
                >
                  <Lightbulb size={15} /> Navrhnout cíl z předchozích záznamů
                </button>
                {suggestions && (
                  <div className="rounded-xl bg-canvas p-3">
                    {suggestions.length === 0 ? (
                      <p className="text-sm text-ink-faint">Pro tohoto žáka zatím nejsou záznamy, ze kterých by šel cíl navrhnout.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {suggestions.map((g) => (
                          <li key={g}>
                            <button
                              type="button"
                              onClick={() => { set('goal', g); setSuggestions(null) }}
                              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-sea-500"
                            >
                              {g}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" className="mt-2 text-xs font-semibold text-ink-faint" onClick={() => setSuggestions(null)}>Zavřít návrhy</button>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-ink-soft">Splnění vzdělávacího cíle</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Splnění vzdělávacího cíle">
                  {GOAL_STATUSES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={draft.goalStatus === g}
                      onClick={() => set('goalStatus', draft.goalStatus === g ? null : g)}
                      className={cx(
                        'min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors',
                        draft.goalStatus === g ? GOAL_TONE[g] : 'border-line bg-surface text-ink-soft hover:border-ink-faint',
                      )}
                    >
                      {GOAL_STATUS_LABEL[g]}
                    </button>
                  ))}
                </div>
                {!draft.goalStatus && <p className="mt-1.5 text-xs text-ink-faint">Zatím neoznačeno.</p>}
              </div>
            </div>
          </Step>

          <Step n={3} title="Hodnocení znalostí a dovedností žáka" aside={<Pill tone="sea">{rated} z {skills.length} ohodnoceno</Pill>}>
            <p className="mb-3 text-sm text-ink-soft">
              1 je nejnižší a 5 nejvyšší úroveň zvládnutí. Nejdřív vyberte, které dovednosti v této hodině hodnotíte.
            </p>
            <div className="mb-4 rounded-xl bg-canvas p-3">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-ink-soft">
                Dovednosti v této hodině
                <button type="button" className="text-sea-600" onClick={() => set('skills', criteria.map((c) => c.id))}>Vybrat vše</button>
                {lastOwn?.skills?.length ? (
                  <button type="button" className="text-sea-600" onClick={() => set('skills', lastOwn.skills!.filter((s) => criteria.some((c) => c.id === s)))}>Jako minule</button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dovednosti v této hodině">
                {criteria.map((c) => {
                  const on = skills.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSkill(c.id)}
                      className={cx(
                        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold',
                        on ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface text-ink-faint hover:text-ink',
                      )}
                    >
                      {on && <Check size={14} />} {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            {skills.length === 0 ? (
              <p className="text-sm text-ink-faint">Vyberte aspoň jednu dovednost.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {criteria.filter((c) => skills.includes(c.id)).map((c) => {
                  const cur = draft.scores[c.id]
                  const prev = lastOwn?.scores[c.id]
                  return (
                    <li key={c.id} className="py-3.5">
                      <div className="mb-2 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">
                            {c.name} {c.subjectId && <Pill tone="brand" className="ml-1 align-middle">vlastní</Pill>}
                          </div>
                          <div className="text-sm text-ink-faint">{c.question}</div>
                        </div>
                        <span className="shrink-0 text-xs text-ink-faint">Minule: {prev ?? '–'}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={c.name}>
                        {LEVELS.map(({ level, name, desc }) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={cur === level}
                            title={`${level} – ${name}: ${desc}`}
                            onClick={() => setScore(c.id, level)}
                            className={cx(
                              'tabular h-11 rounded-full border text-[15px] font-bold transition-colors',
                              cur === level ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-soft hover:border-ink-faint',
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <div className={cx('mt-2 text-sm', cur ? 'text-ink' : 'text-ink-faint')}>
                        {cur ? <><strong>{levelLabel(cur)}</strong> <span className="text-ink-soft">· {LEVELS[cur - 1].desc}</span></> : NOT_RATED}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">
              <strong>Důležité:</strong> čísla vyjadřují aktuální zvládnutí dovednosti (1 = nejnižší, 5 = nejvyšší). Nejde o školní známky.
            </p>
          </Step>

          <Step n={4} title="Slovní zpětná vazba" optional>
            <div className="grid gap-4">
              {(
                [
                  ['good', 'Co se povedlo?', 'Správně vytvořil tabulku a použil funkci SUMA.'],
                  ['todo', 'Co je potřeba procvičit?', 'Potřebuje pomoc s funkcí PRŮMĚR.'],
                  ['next', 'Co bude další krok?', 'Samostatně vypočítá průměr pěti čísel.'],
                ] as const
              ).map(([k, label, ph]) => (
                <Field key={k} label={label}>
                  <Textarea id={`fb-${k}`} value={draft.feedback[k]} placeholder={ph} onChange={(e) => setFb(k, e.target.value)} />
                  <div className="flex flex-wrap gap-1.5">
                    {db.phrases.filter((p) => p.kind === k).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFb(k, draft.feedback[k] ? `${draft.feedback[k].trim()} ${p.text}` : p.text)
                        }}
                        className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-soft hover:border-sea-500 hover:text-sea-700"
                      >
                        + {p.text}
                      </button>
                    ))}
                  </div>
                </Field>
              ))}
            </div>
          </Step>

          <Step n={5} title="Sebehodnocení žáka">
            {!existing || !live ? (
              <p className="text-sm text-ink-soft">
                Po uložení záznamu vytvoříte odkaz nebo QR kód. Žák vyplní krátký dotazník (6 otázek, asi 1–2 minuty) a odpovědi se připojí k tomuto hodnocení.
              </p>
            ) : self ? (
              <>
                <SelfCompare self={self} a={{ ...live, ...draft } as Assessment} criteriaNames={Object.fromEntries(criteria.map((c) => [c.id, c.name]))} />
                <div className="mt-4 border-t border-line pt-4">
                  {live.selfCode && live.selfCodeCorrection && !isExpired(live.selfCodeExpires) ? (
                    <SelfLink a={live} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={() => issueSelfCode(live.id, true)}><RefreshCw size={15} /> Povolit žákovi opravu odpovědí</Button>
                      <span className="text-xs text-ink-faint">Vytvoří nový odkaz, přes který žák může své odpovědi jednou upravit.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <SelfLink a={live} />
            )}
          </Step>

          <Step
            n={6}
            title="SWOT analýza a formativní hodnocení"
            aside={
              <Button variant="ghost" className="text-sea-600" onClick={regenerate} disabled={!rated && !self}>
                <RefreshCw size={15} /> Znovu vytvořit z dat
              </Button>
            }
          >
            <p className="mb-3 rounded-xl bg-sea-50 px-3 py-2 text-sm text-sea-700">
              {draft.swot.proposed
                ? 'Vytváří se automaticky z hodnocení dovedností, splnění cíle, slovní zpětné vazby a sebehodnocení žáka. Všechny části můžete upravit.'
                : 'SWOT jste upravili ručně, automaticky se už nepřepisuje. Tlačítkem „Znovu vytvořit z dat“ ho obnovíte.'}{' '}
              Překážky vycházejí jen z uložených údajů, ne z domněnek o osobní situaci žáka.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="S – Silné stránky" hint="Co žák umí a co mu jde.">
                <Textarea id="swot-s" rows={3} value={draft.swot.s} onChange={(e) => setSwot('s', e.target.value)} />
              </Field>
              <Field label="W – Oblasti ke zlepšení" hint="Jaké dovednosti ještě rozvíjí.">
                <Textarea id="swot-w" rows={3} value={draft.swot.w} onChange={(e) => setSwot('w', e.target.value)} />
              </Field>
              <Field label="O – Příležitosti" hint="Na co navázat, co může pomoci.">
                <Textarea id="swot-o" rows={3} value={draft.swot.o} onChange={(e) => setSwot('o', e.target.value)} />
              </Field>
              <Field label="T – Překážky" hint="Rizika podle záznamů (stagnace, nesoulad hodnocení, nesplněné cíle).">
                <Textarea id="swot-t" rows={3} value={draft.swot.t} onChange={(e) => setSwot('t', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="Doporučení pro další rozvoj žáka">
                <Textarea id="doporuceni" rows={3} value={draft.swot.rec ?? ''} onChange={(e) => setSwot('rec', e.target.value)} />
              </Field>
              <Field
                label="Formativní hodnocení žáka"
                hint={draft.formativeProposed ? 'Automatický návrh – upravte podle potřeby.' : 'Upraveno učitelem.'}
              >
                <Textarea
                  id="formativni"
                  rows={5}
                  value={draft.formative ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, formative: e.target.value, formativeProposed: false }))}
                />
              </Field>
            </div>
          </Step>

          <Step n={7} title="Další cíl a uložení">
            <Field label="Další cíl do příštího období" hint="Uloží se mezi cíle žáka; jeho splnění označíte v detailu žáka.">
              <Input id="dalsi-cil" value={draft.nextGoal} placeholder={draft.feedback.next || 'Např. samostatně vypočítat průměr pěti čísel'} onChange={(e) => set('nextGoal', e.target.value)} />
            </Field>
            {!draft.nextGoal && draft.feedback.next && (
              <button className="mt-2 text-sm font-semibold text-sea-600" onClick={() => set('nextGoal', draft.feedback.next)}>
                Použít „další krok“ jako cíl
              </button>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="brand" disabled={!canSave} onClick={() => save(false)}><Check size={17} /> Uložit hodnocení</Button>
              {!existing && <Button disabled={!canSave} onClick={() => save(true)}>Uložit a další žák</Button>}
              {!canSave && <span className="text-sm text-ink-faint">Pro uložení ohodnoťte aspoň jednu dovednost.</span>}
              {saved && <span role="status" className="text-sm font-semibold text-good">Uloženo{existing ? '' : ' – pokračujte dalším žákem'}.</span>}
            </div>
          </Step>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          {student && <LastAssessment a={lastOwn} studentId={student.id} name={fullName(student)} criteriaNames={Object.fromEntries(criteria.map((c) => [c.id, c.name]))} />}
          <Card title="Škála 1–5">
            <ul className="flex flex-col gap-2 text-sm">
              {[...LEVELS].reverse().map((l) => (
                <li key={l.level} className="flex items-start gap-2.5">
                  <LevelBadge level={l.level} size="sm" />
                  <span className="pt-0.5"><strong>{l.name}:</strong> <span className="text-ink-soft">{l.desc}</span></span>
                </li>
              ))}
              <li className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-dashed border-line text-xs text-ink-faint">–</span>
                <span className="pt-0.5 text-ink-soft">Nevybraná dovednost = nehodnoceno.</span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  )
}

function LastAssessment({ a, studentId, name, criteriaNames }: { a?: Assessment; studentId: string; name: string; criteriaNames: Record<string, string> }) {
  return (
    <Card title="Poslední hodnocení" action={<Link to={`/zaci/${studentId}`} className="text-sm font-semibold text-sea-600">{name}</Link>}>
      {!a ? (
        <p className="text-sm text-ink-faint">První záznam v tomto předmětu.</p>
      ) : (
        <div className="flex flex-col gap-2.5 text-sm">
          <div className="text-ink-faint">{fmt(a.date)} · <span className="font-semibold text-ink">{a.topic || 'bez tématu'}</span></div>
          {a.goal && (
            <div>
              <span className="text-ink-faint">Cíl:</span> {a.goal}
              {a.goalStatus && <Pill className="ml-1.5 align-middle" tone={a.goalStatus === 'splneno' ? 'good' : a.goalStatus === 'castecne' ? 'warn' : 'bad'}>{GOAL_STATUS_LABEL[a.goalStatus].toLowerCase()}</Pill>}
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {Object.entries(a.scores).map(([cid, l]) => (
              <li key={cid} className="flex items-center gap-2"><LevelBadge level={l} size="sm" /> {criteriaNames[cid] ?? 'dovednost'}</li>
            ))}
          </ul>
          {a.feedback.next && <div><span className="text-ink-faint">Další krok:</span> {a.feedback.next}</div>}
          <Link to={`/hodnoceni/${a.id}`} className="text-xs font-semibold text-sea-600">Otevřít celé hodnocení</Link>
        </div>
      )}
    </Card>
  )
}

function SelfLink({ a }: { a: Assessment }) {
  const [qr, setQr] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const code = a.selfCode && !isExpired(a.selfCodeExpires) ? a.selfCode : null
  const url = code ? `${location.origin}${location.pathname}#/sebehodnoceni/${code}` : ''
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#16213a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [url])
  if (!code)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => issueSelfCode(a.id)}><QrCode size={17} /> Vytvořit odkaz pro žáka</Button>
        <span className="text-sm text-ink-soft">
          {a.selfCode ? 'Předchozí odkaz vypršel. ' : ''}Odkaz platí {SELF_CODE_HOURS} hodin a jde odeslat jen jednou. Žák nepotřebuje účet.
        </span>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-5">
      {qr && <img src={qr} alt="QR kód pro sebehodnocení žáka" className="h-36 w-36 rounded-xl border border-line" />}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-sm text-ink-soft">{a.selfCodeCorrection ? 'Kód pro opravu odpovědí' : 'Kód pro žáka'}</div>
        <div className="tabular font-display text-3xl font-bold tracking-[0.2em]">{code}</div>
        <div className="text-xs text-ink-faint">Platí do {new Date(a.selfCodeExpires!).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · jen pro toto hodnocení</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {}) }}>
            <Copy size={15} /> {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
          </Button>
          <a href={url} target="_blank" rel="noreferrer"><Button variant="ghost">Otevřít jako žák</Button></a>
          <Button variant="ghost" onClick={() => revokeSelfCode(a.id)}><X size={15} /> Zrušit odkaz</Button>
        </div>
        <p className="text-xs text-ink-faint">V demu se odpovědi ukládají v tomto prohlížeči – otevřete odkaz v nové kartě.</p>
      </div>
    </div>
  )
}

function Agree({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-ink-faint">–</span>
  return <Pill tone={ok ? 'good' : 'warn'}>{ok ? 'shoda' : 'liší se'}</Pill>
}

function SelfCompare({ self, a, criteriaNames }: { self: SelfAssessment; a: Assessment; criteriaNames: Record<string, string> }) {
  const when = `Odesláno ${new Date(self.submittedAt).toLocaleString('cs-CZ')}${self.corrections ? ` · opraveno ${self.corrections}×` : ''}.`
  if (isLegacy(self)) {
    const rows: [string, string | undefined, string][] = [
      ['Co se povedlo', self.wentWell, a.feedback.good],
      ['Co ještě nejde', self.struggle, a.feedback.todo],
      ['Co dál', self.nextWant, a.feedback.next],
    ]
    return (
      <div>
        <div className="mb-3 text-sm text-ink-soft">{when} Starší podoba sebehodnocení (volné odpovědi).</div>
        <CompareTable rows={rows.map(([l, s, t]) => [l, s || '–', t || '–', null])} />
      </div>
    )
  }
  const x = self.answers!
  const know = a.scores['k-znalosti']
  const indep = a.scores['k-samostatnost']
  const goalMap = { splneno: 'ano', castecne: 'castecne', nesplneno: 'zatimne' } as const
  const rows: [string, string, string, boolean | null][] = [
    ['Porozumění učivu', describe.understanding(x.understanding), know ? `${criteriaNames['k-znalosti'] ?? 'Znalosti'}: ${levelLabel(know)}` : NOT_RATED, know ? teacherBand(know) === x.understanding : null],
    ['Jak se pracovalo', describe.work(x.work), indep ? `${criteriaNames['k-samostatnost'] ?? 'Samostatnost'}: ${levelLabel(indep)}` : NOT_RATED, indep ? teacherBand(indep) === x.work : null],
    ['Splnění cíle hodiny', describe.goalMet(x.goalMet), a.goalStatus ? GOAL_STATUS_LABEL[a.goalStatus] : 'neoznačeno', a.goalStatus ? goalMap[a.goalStatus] === x.goalMet : null],
    ['Co se povedlo', describe.wentWell(x.wentWell).join(' ') || '–', a.feedback.good || '–', null],
    ['Co zlepšit', describe.improve(x.improve).join(' ') || '–', a.feedback.todo || '–', null],
    ['Příště chce zvládnout lépe', x.nextWish || '–', a.feedback.next || '–', null],
  ]
  return (
    <div>
      <div className="mb-3 text-sm text-ink-soft">{when} Porovnejte odpovědi se svým hodnocením a společně se žákem stanovte další cíl.</div>
      <CompareTable rows={rows} />
      <p className="mt-2 text-xs text-ink-faint">Sebehodnocení je subjektivní pohled žáka. Nepřevádí se na známku.</p>
    </div>
  )
}

function CompareTable({ rows }: { rows: [string, string, string, boolean | null][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-semibold" />
            <th className="py-2 pr-3 font-semibold">Žák</th>
            <th className="py-2 pr-3 font-semibold">Učitel</th>
            <th className="py-2 font-semibold" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([l, s, t, ok]) => (
            <tr key={l} className="align-top">
              <td className="py-2.5 pr-3 font-semibold">{l}</td>
              <td className="py-2.5 pr-3">{s}</td>
              <td className="py-2.5 pr-3">{t}</td>
              <td className="py-2.5 text-right"><Agree ok={ok} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
