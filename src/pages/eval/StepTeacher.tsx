import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquarePlus, Plus } from 'lucide-react'
import { addCriterion, criteriaFor, saveAssessment, useDB } from '../../lib/store'
import { criterionSeries, GOAL_STATUS_LABEL, studentAssessments } from '../../lib/analysis'
import { LEVELS, levelLabel, NOT_RATED } from '../../lib/levels'
import { periodLabel, teacherQuestions } from '../../lib/periods'
import type { AssessmentGoal, Level, LessonGoalStatus, TeacherAnswer, TeacherQKey } from '../../lib/types'
import { Button, Card, cx, Input, LevelBadge, Pill, Textarea } from '../../components/ui'
import { AttachmentList, AttachmentUpload } from '../../components/Attachments'
import type { StepProps } from './Wizard'

const GOAL_STATUSES: LessonGoalStatus[] = ['splneno', 'castecne', 'nesplneno']
/** Banka vět se nabízí u otázek, kam patří. */
const PHRASE_KIND: Partial<Record<TeacherQKey, 'good' | 'todo' | 'next'>> = { povedlo: 'good', procvicit: 'todo', dalsi: 'next' }
const GOAL_TONE: Record<LessonGoalStatus, string> = {
  splneno: 'bg-good-wash text-good border-good/40',
  castecne: 'bg-warn-wash text-warn border-warn/40',
  nesplneno: 'bg-bad-wash text-bad border-bad/40',
}

export default function StepTeacher({ a, setDirty, goTo }: StepProps) {
  const db = useDB()
  const asm = a!
  const criteria = useMemo(() => criteriaFor(db, asm.subjectId), [db, asm.subjectId])
  const [skills, setSkills] = useState<string[]>(() =>
    asm.skills.length ? asm.skills : (studentAssessments(db, asm.studentId, asm.subjectId).filter((x) => x.id !== asm.id).at(-1)?.skills ?? criteria.slice(0, 5).map((c) => c.id)),
  )
  const [scores, setScores] = useState<Record<string, Level>>(asm.scores)
  const [notes, setNotes] = useState<Record<string, string>>(asm.skillNotes)
  const [openNote, setOpenNote] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(asm.skillNotes).filter(([, v]) => v.trim()).map(([k]) => [k, true])))
  const [tq, setTq] = useState<Partial<Record<TeacherQKey, TeacherAnswer>>>(asm.teacherQ)
  const [goals, setGoals] = useState<AssessmentGoal[]>(asm.goals)
  const [newSkill, setNewSkill] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => setDirty(touched), [touched, setDirty])
  const touch = () => setTouched(true)

  const prev = studentAssessments(db, asm.studentId, asm.subjectId).filter((x) => x.id !== asm.id && x.date <= asm.date)
  const questions = teacherQuestions(asm.periodType, asm.periodFrom, asm.periodTo)
  const known = [...criteria, ...db.criteria.filter((c) => skills.includes(c.id) && !criteria.some((x) => x.id === c.id))]

  const toggleSkill = (id: string) => {
    setSkills((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
    if (skills.includes(id)) setScores((s) => { const n = { ...s }; delete n[id]; return n })
    touch()
  }
  const setScore = (id: string, l: Level) => {
    setScores((s) => { const n = { ...s }; if (n[id] === l) delete n[id]; else n[id] = l; return n })
    touch()
  }
  const setAns = (k: TeacherQKey, fn: (x: TeacherAnswer) => TeacherAnswer) => {
    setTq((q) => ({ ...q, [k]: fn(q[k] ?? { choices: [], note: '' }) }))
    touch()
  }

  function save() {
    saveAssessment({ ...asm, skills, scores, skillNotes: Object.fromEntries(Object.entries(notes).filter(([k, v]) => skills.includes(k) && v.trim())), teacherQ: tq, goals })
    goTo('zak')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="A. Hodnocené dovednosti" action={<Pill tone="sea">{Object.keys(scores).length} z {skills.length} ohodnoceno</Pill>}>
        <p className="mb-3 text-sm text-ink-soft">Vyberte dovednosti relevantní pro tuto hodinu či období. Nevybraná dovednost = nehodnoceno a nezapočítává se do souhrnů ani průměrů.</p>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Hodnocené dovednosti">
          {known.map((c) => {
            const on = skills.includes(c.id)
            return (
              <button
                key={c.id}
                aria-pressed={on}
                onClick={() => toggleSkill(c.id)}
                className={cx('inline-flex min-h-10 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface text-ink-faint hover:text-ink')}
              >
                {on && <Check size={14} />} {c.name}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input id="t-nova-dovednost" className="min-w-[200px] flex-1" placeholder="Vlastní dovednost (např. Práce s mapou)" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
          <Button disabled={!newSkill.trim()} onClick={() => { const c = addCriterion(asm.subjectId, newSkill, ''); setSkills((xs) => [...xs, c.id]); setNewSkill(''); touch() }}>
            <Plus size={15} /> Přidat dovednost
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-faint">Dovednosti, které pro předmět vůbec nedávají smysl, skryjete trvale v sekci <Link to="/kriteria" className="font-semibold text-sea-600">Dovednosti a věty</Link>.</p>

        {skills.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line">
            {known.filter((c) => skills.includes(c.id)).map((c) => {
              const cur = scores[c.id]
              const last = criterionSeries(prev, c.id).at(-1)
              return (
                <li key={c.id} className="py-3.5">
                  <div className="mb-2 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{c.name} {c.subjectId && <Pill tone="brand" className="ml-1 align-middle">vlastní</Pill>}</div>
                      {c.question && <div className="text-sm text-ink-faint">{c.question}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">Minule: {last?.level ?? '–'}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={c.name}>
                    {LEVELS.map(({ level, name, desc }) => (
                      <button
                        key={level}
                        role="radio"
                        aria-checked={cur === level}
                        title={`${level} – ${name}: ${desc}`}
                        onClick={() => setScore(c.id, level)}
                        className={cx('tabular h-12 rounded-full border text-[15px] font-bold transition-colors', cur === level ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-soft hover:border-ink-faint')}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className={cx('mt-2 text-sm', cur ? 'text-ink' : 'text-ink-faint')}>
                    {cur ? <><strong>{levelLabel(cur)}</strong> <span className="text-ink-soft">· {LEVELS[cur - 1].desc}</span></> : NOT_RATED}
                  </div>
                  {openNote[c.id] ? (
                    <Textarea
                      id={`t-komentar-${c.id}`}
                      aria-label={`Komentář k dovednosti ${c.name}`}
                      className="mt-2"
                      value={notes[c.id] ?? ''}
                      placeholder="Slovní komentář k dovednosti"
                      onChange={(e) => { setNotes((n) => ({ ...n, [c.id]: e.target.value })); touch() }}
                    />
                  ) : (
                    <button className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-sea-600" onClick={() => setOpenNote((o) => ({ ...o, [c.id]: true }))}>
                      <MessageSquarePlus size={15} /> Přidat komentář
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="B. Pětibodová slovní škála">
        <ul className="grid gap-2 sm:grid-cols-5">
          {LEVELS.map((l) => (
            <li key={l.level} className="flex items-start gap-2.5 rounded-xl border border-line p-3 text-sm sm:flex-col">
              <LevelBadge level={l.level} size="sm" />
              <span><strong>{l.name}</strong><span className="block text-ink-soft">{l.desc}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-faint">1 je nejlepší a 5 nejnižší úroveň zvládnutí. Nejde o školní známky.</p>
      </Card>

      <Card title={`C. Dotazník učitele – ${periodLabel(asm.periodType, asm.periodFrom, asm.periodTo)}`}>
        <div className="flex flex-col gap-5">
          {questions.map((q, i) => {
            const ans = tq[q.key] ?? { choices: [], note: '' }
            return (
              <fieldset key={q.key}>
                <legend className="mb-2 font-bold">{i + 1}. {q.title}</legend>
                <div className="mb-2 flex flex-wrap gap-1.5" role={q.multi ? 'group' : 'radiogroup'}>
                  {[...q.presets, ...db.phrases.filter((ph) => ph.kind === PHRASE_KIND[q.key]).map((ph) => ph.text)].filter((p, j, arr) => arr.indexOf(p) === j).map((p) => {
                    const on = ans.choices.includes(p)
                    return (
                      <button
                        key={p}
                        role={q.multi ? 'checkbox' : 'radio'}
                        aria-checked={on}
                        onClick={() => setAns(q.key, (x) => ({ ...x, choices: q.multi ? (on ? x.choices.filter((c) => c !== p) : [...x.choices, p]) : on ? [] : [p] }))}
                        className={cx('min-h-10 rounded-full border px-3 py-1.5 text-left text-sm', on ? 'border-sea-500 bg-sea-50 font-semibold text-sea-700' : 'border-line bg-surface text-ink-soft hover:text-ink')}
                      >
                        {on && <Check size={13} className="mr-1 inline" />}{p}
                      </button>
                    )
                  })}
                </div>
                <Textarea id={`t-q-${q.key}`} aria-label={`Vlastní komentář: ${q.title}`} placeholder="Vlastní komentář (nepovinné)" value={ans.note} onChange={(e) => setAns(q.key, (x) => ({ ...x, note: e.target.value }))} />
              </fieldset>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-ink-faint">Předpřipravené věty si upravíte v sekci Dovednosti a věty.</p>
      </Card>

      <Card title="D. Splnění vzdělávacích cílů">
        {goals.length === 0 ? (
          <p className="text-sm text-ink-faint">Cíl zatím není zadaný. Doplňte ho v kroku <button className="font-semibold text-sea-600" onClick={() => goTo('udaje')}>Údaje o žákovi</button>.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {goals.map((g, i) => (
              <li key={g.id}>
                <div className="mb-2 text-[15px]"><span className="font-bold text-ink-faint">{i + 1}.</span> {g.text}</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Splnění cíle ${i + 1}`}>
                  {GOAL_STATUSES.map((st) => (
                    <button
                      key={st}
                      role="radio"
                      aria-checked={g.status === st}
                      onClick={() => { setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, status: x.status === st ? null : st } : x))); touch() }}
                      className={cx('min-h-11 rounded-xl border px-2 text-sm font-semibold', g.status === st ? GOAL_TONE[st] : 'border-line bg-surface text-ink-soft hover:border-ink-faint')}
                    >
                      {GOAL_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
                {!g.status && <p className="mt-1 text-xs text-ink-faint">Zatím neoznačeno – ve zprávě se nebude uvádět jako splněné ani nesplněné.</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="E. Přílohy učitele">
        <AttachmentUpload assessmentId={asm.id} owner="ucitel" label="Nahrát fotografii práce, pracovní list, PDF, dokument nebo prezentaci" />
        <div className="mt-3">
          <AttachmentList items={db.attachments.filter((x) => x.assessmentId === asm.id && x.owner === 'ucitel')} canDelete />
        </div>
        <p className="mt-2 text-xs text-ink-faint">V testovacím provozu se soubory ukládají jen v tomto prohlížeči.</p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="brand" onClick={save}><Check size={17} /> Uložit hodnocení učitele</Button>
        {!Object.keys(scores).length && <span className="text-sm text-ink-faint">Zatím není ohodnocena žádná dovednost.</span>}
      </div>
    </div>
  )
}
