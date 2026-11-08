import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Lightbulb, Loader2, Plus, X } from 'lucide-react'
import { addStudent, addUnit, saveAssessment, useDB } from '../../lib/store'
import { useSelectionRaw, setSelection } from '../../lib/selection'
import { setSchoolType } from '../../lib/store'
import { MONTHS, PERIOD_LABEL, periodLabel, rangeFor, schoolYearLabel, schoolYearOf } from '../../lib/periods'
import { unitsFor } from '../../lib/catalog'
import { suggestGoals } from '../../lib/ai'
import { fmt, today } from '../../lib/dates'
import { uid } from '../../lib/util'
import type { AssessmentGoal, PeriodType } from '../../lib/types'
import { Button, Card, cx, Field, Input, Pill, Select } from '../../components/ui'
import type { StepProps } from './Wizard'

const PERIODS: PeriodType[] = ['hodina', 'tyden', 'mesic', 'pololeti', 'rok', 'vlastni']

export default function StepStudent({ a, setDirty, goTo }: StepProps) {
  const db = useDB()
  const sel = useSelectionRaw()
  const [params] = useSearchParams()
  const presetStudent = a ? db.students.find((s) => s.id === a.studentId) : db.students.find((s) => s.id === params.get('zak'))

  const [classId, setClassId] = useState(presetStudent?.classId ?? (db.classes.some((c) => c.id === sel.classId) ? sel.classId : db.classes[0]?.id ?? ''))
  const subjectsOf = (cid: string) => db.subjects.filter((p) => p.classId === cid)
  const [subjectId, setSubjectId] = useState(a?.subjectId ?? (subjectsOf(classId).some((p) => p.id === sel.subjectId) ? sel.subjectId : subjectsOf(classId)[0]?.id ?? ''))
  // „Nový žák“ (?novy=1) začíná prázdným formulářem, jinak první žák třídy.
  const [studentId, setStudentId] = useState<string>(
    presetStudent?.id ??
      (params.get('novy') ? '' : db.students.filter((x) => x.classId === classId).sort((x, y) => x.lastName.localeCompare(y.lastName, 'cs'))[0]?.id ?? ''),
  )
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [date, setDate] = useState(a?.date ?? today())
  const [ptype, setPtype] = useState<PeriodType>(a?.periodType ?? 'hodina')
  const [anchor, setAnchor] = useState(a?.periodFrom ?? today())
  const [month, setMonth] = useState(a ? new Date(a.periodFrom).getMonth() : new Date().getMonth())
  const [year, setYear] = useState(a ? new Date(a.periodFrom).getFullYear() : new Date().getFullYear())
  const [half, setHalf] = useState<1 | 2>(a && a.periodType === 'pololeti' && a.periodFrom.slice(5, 7) === '02' ? 2 : new Date().getMonth() >= 1 && new Date().getMonth() <= 7 ? 2 : 1)
  const [schoolYear, setSchoolYear] = useState(a ? schoolYearOf(a.periodFrom) : schoolYearOf(today()))
  const [customFrom, setCustomFrom] = useState(a?.periodType === 'vlastni' ? a.periodFrom : today())
  const [customTo, setCustomTo] = useState(a?.periodType === 'vlastni' ? a.periodTo : today())
  const [units, setUnits] = useState<string[]>(a?.units ?? [])
  const [topic, setTopic] = useState(a?.topic ?? '')
  const [goals, setGoals] = useState<AssessmentGoal[]>(a?.goals.length ? a.goals : [{ id: uid('c'), text: '', status: null }])
  const [newUnit, setNewUnit] = useState('')
  const [sugg, setSugg] = useState<{ items: string[]; note?: string; source: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [touched, setTouched] = useState(false)

  useEffect(() => setDirty(touched), [touched, setDirty])
  const touch = () => setTouched(true)

  const cls = db.classes.find((c) => c.id === classId)
  const school = db.schools.find((s) => s.id === cls?.schoolId)
  const subj = db.subjects.find((p) => p.id === subjectId)
  const students = db.students.filter((s) => s.classId === classId).sort((x, y) => x.lastName.localeCompare(y.lastName, 'cs'))

  const range = useMemo(() => {
    if (ptype === 'hodina') return rangeFor('hodina', date)
    if (ptype === 'tyden') return rangeFor('tyden', anchor)
    if (ptype === 'mesic') return rangeFor('mesic', today(), { month, year })
    if (ptype === 'pololeti') return rangeFor('pololeti', today(), { half, year: schoolYear })
    if (ptype === 'rok') return rangeFor('rok', today(), { year: schoolYear })
    return { type: 'vlastni' as const, from: customFrom, to: customTo }
  }, [ptype, date, anchor, month, year, half, schoolYear, customFrom, customTo])

  const available = subj ? unitsFor(db.units, subj.name, cls?.grade, school?.type) : []
  const preparedGoals = [...new Set(available.filter((u) => units.includes(u.id)).flatMap((u) => u.goals))].filter((g) => !goals.some((x) => x.text === g))
  const thisYear = schoolYearOf(today())
  const years = [thisYear - 1, thisYear, thisYear + 1]

  const setGoal = (id: string, text: string) => { setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, text } : g))); touch() }
  const addGoal = (text = '') => {
    setGoals((gs) => {
      const empty = gs.find((g) => !g.text.trim())
      return text && empty ? gs.map((g) => (g.id === empty.id ? { ...g, text } : g)) : [...gs, { id: uid('c'), text, status: null }]
    })
    touch()
  }

  async function suggest() {
    setBusy(true)
    const r = await suggestGoals(db, {
      id: a?.id ?? '', studentId: studentId || '', subjectId, units, topic, periodType: ptype, periodFrom: range.from, periodTo: range.to, date,
      scores: a?.scores ?? {}, skillNotes: a?.skillNotes ?? {}, feedback: a?.feedback ?? { good: '', todo: '', next: '' }, teacherQ: a?.teacherQ ?? {}, goals,
    })
    setSugg({ items: r.value, note: r.note, source: r.source })
    setBusy(false)
  }

  function save() {
    const errs: string[] = []
    if (!classId) errs.push('Vyberte třídu.')
    if (!subjectId) errs.push('Vyberte vyučovací předmět.')
    if (!studentId && (!newFirst.trim() || !newLast.trim())) errs.push('Vyberte žáka, nebo vyplňte jméno a příjmení nového žáka.')
    if (!date) errs.push('Vyplňte datum hodnocení.')
    if (ptype === 'vlastni' && (!customFrom || !customTo || customFrom > customTo)) errs.push('U vlastního období zadejte platné datum od–do.')
    setErrors(errs)
    if (errs.length) return
    let sid = studentId
    if (!sid) sid = addStudent(classId, newFirst, newLast).id
    const periodChanged = a && (a.periodType !== ptype || a.periodFrom !== range.from || a.periodTo !== range.to)
    const saved = saveAssessment({
      ...(a ?? {}),
      id: a?.id,
      studentId: sid,
      subjectId,
      date,
      periodType: ptype,
      periodFrom: range.from,
      periodTo: range.to,
      units,
      topic: topic.trim(),
      goals: goals.filter((g) => g.text.trim()).map((g) => ({ ...g, text: g.text.trim() })),
      skills: a?.skills ?? [],
      scores: a?.scores ?? {},
      skillNotes: a?.skillNotes ?? {},
      teacherQ: a?.teacherQ ?? {},
      swot: a?.swot ?? { s: '', w: '', o: '', t: '', proposed: true },
      nextGoal: a?.nextGoal ?? '',
      // Upravený dotazník platí jen pro původní období.
      selfForm: periodChanged ? undefined : a?.selfForm,
    })
    if (school && school.type !== db.settings.schoolType) setSchoolType(school.type)
    setSelection({ classId, subjectId })
    goTo('ucitel', saved.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Základní údaje">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Třída *">
            <Select id="u-trida" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(subjectsOf(e.target.value)[0]?.id ?? ''); setStudentId(''); setUnits([]); touch() }} disabled={!!a}>
              {db.schools.map((s) => (
                <optgroup key={s.id} label={s.type === 'ZS' ? 'ZŠ' : 'SŠ'}>
                  {db.classes.filter((c) => c.schoolId === s.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Vyučovací předmět *">
            <Select id="u-predmet" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnits([]); touch() }} disabled={!!a}>
              {subjectsOf(classId).length === 0 && <option value="">Třída nemá předmět</option>}
              {subjectsOf(classId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Datum hodnocení *">
            <Input id="u-datum" type="date" value={date} onChange={(e) => { setDate(e.target.value); touch() }} />
          </Field>
          <Field label="Žák *" className="sm:col-span-2 lg:col-span-1">
            <Select id="u-zak" value={studentId} onChange={(e) => { setStudentId(e.target.value); touch() }} disabled={!!a}>
              <option value="">+ Nový žák</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
            </Select>
          </Field>
          {!studentId && (
            <>
              <Field label="Jméno žáka *">
                <Input id="u-jmeno" value={newFirst} placeholder="Jen fiktivní údaje" onChange={(e) => { setNewFirst(e.target.value); touch() }} />
              </Field>
              <Field label="Příjmení žáka *">
                <Input id="u-prijmeni" value={newLast} onChange={(e) => { setNewLast(e.target.value); touch() }} />
              </Field>
            </>
          )}
        </div>
        {!studentId && <p className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">Demonstrační aplikace: zadávejte pouze fiktivní údaje.</p>}
      </Card>

      <Card title="Hodnocené období *">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Hodnocené období">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={ptype === p}
              onClick={() => { setPtype(p); touch() }}
              className={cx('min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold', ptype === p ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface text-ink-soft hover:border-ink-faint')}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ptype === 'hodina' && <p className="text-sm text-ink-soft sm:col-span-3">Hodnocení konkrétní vyučovací hodiny dne <strong>{fmt(date)}</strong> (podle data hodnocení).</p>}
          {ptype === 'tyden' && (
            <Field label="Den v hodnoceném týdnu">
              <Input id="u-tyden" type="date" value={anchor} onChange={(e) => { setAnchor(e.target.value); touch() }} />
            </Field>
          )}
          {ptype === 'mesic' && (
            <>
              <Field label="Měsíc">
                <Select id="u-mesic" value={month} onChange={(e) => { setMonth(+e.target.value); touch() }}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </Select>
              </Field>
              <Field label="Rok">
                <Select id="u-rok" value={year} onChange={(e) => { setYear(+e.target.value); touch() }}>
                  {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
              </Field>
            </>
          )}
          {ptype === 'pololeti' && (
            <Field label="Pololetí">
              <Select id="u-pololeti" value={half} onChange={(e) => { setHalf(+e.target.value as 1 | 2); touch() }}>
                <option value={1}>1. pololetí</option>
                <option value={2}>2. pololetí</option>
              </Select>
            </Field>
          )}
          {(ptype === 'pololeti' || ptype === 'rok') && (
            <Field label="Školní rok">
              <Select id="u-skolni-rok" value={schoolYear} onChange={(e) => { setSchoolYear(+e.target.value); touch() }}>
                {years.map((y) => <option key={y} value={y}>{schoolYearLabel(y)}</option>)}
              </Select>
            </Field>
          )}
          {ptype === 'vlastni' && (
            <>
              <Field label="Od"><Input id="u-od" type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); touch() }} /></Field>
              <Field label="Do"><Input id="u-do" type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); touch() }} /></Field>
            </>
          )}
        </div>
        {ptype !== 'hodina' && (
          <p className="mt-3 text-sm text-ink-soft">
            Období: <strong>{periodLabel(ptype, range.from, range.to)}</strong> ({fmt(range.from)} – {fmt(range.to)}). Podle období se přizpůsobí otázky učitele, dotazník pro žáka i výsledná zpráva.
          </p>
        )}
      </Card>

      <Card title="Tematický celek podle ŠVP" action={<span className="text-xs text-ink-faint">{subj?.name} · {cls?.grade ? `${cls.grade}. ročník` : 'ročník neuveden'}{cls?.field ? ` · ${cls.field}` : ''}</span>}>
        {available.length === 0 ? (
          <p className="mb-3 text-sm text-ink-faint">Pro tento předmět a ročník nejsou v katalogu žádné celky. Přidejte vlastní.</p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Tematické celky">
            {available.map((u) => {
              const on = units.includes(u.id)
              return (
                <button
                  key={u.id}
                  aria-pressed={on}
                  onClick={() => { setUnits((xs) => (on ? xs.filter((x) => x !== u.id) : [...xs, u.id])); touch() }}
                  className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line bg-surface text-ink-soft hover:text-ink')}
                >
                  {on && <Check size={14} />} {u.name} {u.custom && <Pill tone="brand">vlastní</Pill>}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Input id="u-novy-celek" className="min-w-[220px] flex-1" placeholder="Vlastní tematický celek" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
          <Button disabled={!newUnit.trim() || !subj} onClick={() => { const u = addUnit(subj!.name, newUnit, cls?.grade); setUnits((xs) => [...xs, u.id]); setNewUnit(''); touch() }}>
            <Plus size={15} /> Přidat celek
          </Button>
        </div>
        <Field label="Téma výuky (vlastní zadání)" className="mt-4">
          <Input id="u-tema" value={topic} placeholder="Např. Funkce PRŮMĚR v praxi" onChange={(e) => { setTopic(e.target.value); touch() }} />
        </Field>
        <p className="mt-2 text-xs text-ink-faint">Katalog je ukázkový – škola si ho doplní podle svého ŠVP. U delších období můžete vybrat více celků.</p>
      </Card>

      <Card title="Vzdělávací cíle">
        <ul className="flex flex-col gap-2">
          {goals.map((g, i) => (
            <li key={g.id} className="flex items-start gap-2">
              <span className="tabular mt-2.5 w-5 shrink-0 text-sm font-bold text-ink-faint">{i + 1}.</span>
              <textarea
                id={`u-cil-${i}`}
                aria-label={`Vzdělávací cíl ${i + 1}`}
                rows={2}
                value={g.text}
                placeholder="Žák vytvoří tabulku a použije funkce SUMA a PRŮMĚR."
                onChange={(e) => setGoal(g.id, e.target.value)}
                className="min-w-0 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[15px] focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-100"
              />
              {goals.length > 1 && (
                <button className="mt-2 rounded-lg p-1.5 text-ink-faint hover:text-bad" aria-label={`Odebrat cíl ${i + 1}`} onClick={() => { setGoals((gs) => gs.filter((x) => x.id !== g.id)); touch() }}>
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => addGoal()}><Plus size={15} /> Přidat cíl</Button>
          {preparedGoals.length > 0 && (
            <Select id="u-pripraveny-cil" aria-label="Vybrat připravený cíl" className="w-auto max-w-full" value="" onChange={(e) => e.target.value && addGoal(e.target.value)}>
              <option value="">Vybrat připravený cíl…</option>
              {preparedGoals.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          )}
          <Button variant="primary" onClick={suggest} disabled={busy || !subjectId}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Lightbulb size={15} />} Navrhnout vzdělávací cíl pomocí AI
          </Button>
        </div>
        {sugg && (
          <div className="mt-3 rounded-xl bg-canvas p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
              Návrhy cílů <Pill tone={sugg.source === 'ai' ? 'sea' : 'neutral'}>{sugg.source === 'ai' ? 'AI' : 'šablona'}</Pill>
            </div>
            {sugg.note && <p className="mb-2 text-xs text-ink-faint">{sugg.note}</p>}
            {sugg.items.length === 0 ? (
              <p className="text-sm text-ink-faint">Zatím není z čeho navrhnout – vyberte tematický celek nebo zadejte téma.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sugg.items.map((g) => (
                  <li key={g} className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm">{g}</span>
                    <Button className="shrink-0" onClick={() => addGoal(g)} disabled={goals.some((x) => x.text === g)}>
                      {goals.some((x) => x.text === g) ? <Check size={15} /> : <Plus size={15} />} Přidat
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-faint">Přidaný návrh můžete v poli cíle upravit.</p>
          </div>
        )}
      </Card>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl bg-bad-wash px-4 py-3 text-sm text-bad">
          {errors.map((e) => <div key={e}>{e}</div>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="brand" onClick={save}><Check size={17} /> Uložit údaje</Button>
        <span className="text-sm text-ink-faint">Pole označená * jsou povinná. Hodnocení se uloží jako rozpracované.</span>
      </div>
    </div>
  )
}
