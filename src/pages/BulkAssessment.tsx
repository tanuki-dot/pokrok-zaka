import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Check, CopyPlus } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { saveBulkAssessments, type AssessmentDraft } from '../lib/store'
import { studentAssessments } from '../lib/analysis'
import { criteriaFor } from '../lib/util'
import { rangeFor, periodLabel } from '../lib/periods'
import { fmtShort, today } from '../lib/dates'
import { LEVELS } from '../lib/levels'
import type { AssessmentGoal, Level, PeriodType } from '../lib/types'
import { Button, Card, cx, Empty, PageHeader, Select } from '../components/ui'

const gid = () => 'ag' + Math.random().toString(36).slice(2, 10)

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: 'hodina', label: 'Hodina' },
  { type: 'tyden', label: 'Týden' },
  { type: 'mesic', label: 'Měsíc' },
  { type: 'pololeti', label: 'Pololetí' },
  { type: 'rok', label: 'Školní rok' },
]

export default function BulkAssessment() {
  const { db, subj } = useCtx()
  const nav = useNavigate()
  const [ptype, setPtype] = useState<PeriodType>('tyden')
  const [scores, setScores] = useState<Record<string, Record<string, Level>>>({})
  const available = useMemo(() => (subj ? criteriaFor(db, subj.id) : []), [db, subj])
  const [picked, setPicked] = useState<string[]>(() => available.slice(0, 4).map((c) => c.id))
  const [saved, setSaved] = useState(0)
  const [copiedGoals, setCopiedGoals] = useState<Record<string, AssessmentGoal[]>>({})
  const [copyNote, setCopyNote] = useState('')

  if (!subj) return <Empty title="Vyberte předmět">Hromadné hodnocení probíhá pro vybranou třídu a předmět.</Empty>

  const students = db.students.filter((s) => s.classId === subj.classId)
  const skills = available.filter((c) => picked.includes(c.id))
  const range = rangeFor(ptype, today())

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  // #3b: převzít dovednosti, úrovně i cíle z posledního hodnocení každého žáka.
  const copyPrevious = () => {
    const nextScores: Record<string, Record<string, Level>> = {}
    const nextGoals: Record<string, AssessmentGoal[]> = {}
    const availIds = new Set(available.map((c) => c.id))
    const usedSkills = new Set<string>(picked)
    let fromCount = 0
    let newest = ''
    for (const st of students) {
      const prev = studentAssessments(db, st.id, subj.id).at(-1)
      if (!prev) continue
      fromCount++
      if (prev.date > newest) newest = prev.date
      const sc: Record<string, Level> = {}
      for (const [cid, lvl] of Object.entries(prev.scores)) {
        if (!availIds.has(cid)) continue
        sc[cid] = lvl
        usedSkills.add(cid)
      }
      if (Object.keys(sc).length) nextScores[st.id] = sc
      if (prev.goals.length) nextGoals[st.id] = prev.goals.map((g) => ({ id: gid(), text: g.text, status: null }))
    }
    setPicked(available.filter((c) => usedSkills.has(c.id)).map((c) => c.id))
    setScores(nextScores)
    setCopiedGoals(nextGoals)
    setCopyNote(fromCount ? `Převzato z posledních hodnocení (${fromCount} ${fromCount === 1 ? 'žáka' : 'žáků'}, naposledy ${fmtShort(newest)}). Úrovně i cíle můžete před uložením upravit.` : 'Žádný žák zatím nemá předchozí hodnocení k převzetí.')
  }
  const setCell = (studentId: string, skillId: string, level: Level) =>
    setScores((s) => {
      const row = { ...(s[studentId] ?? {}) }
      if (row[skillId] === level) delete row[skillId]
      else row[skillId] = level
      return { ...s, [studentId]: row }
    })

  const filled = students.filter((st) => Object.keys(scores[st.id] ?? {}).length > 0 || (copiedGoals[st.id]?.length ?? 0) > 0)

  const save = () => {
    const drafts: AssessmentDraft[] = filled.map((st) => ({
      studentId: st.id,
      subjectId: subj.id,
      date: today(),
      periodType: ptype,
      periodFrom: range.from,
      periodTo: range.to,
      units: [],
      topic: '',
      goals: copiedGoals[st.id] ?? [],
      skills: picked,
      scores: scores[st.id] ?? {},
      skillNotes: {},
      teacherQ: {},
      swot: { s: '', w: '', o: '', t: '', proposed: true },
      nextGoal: '',
    }))
    const n = saveBulkAssessments(drafts)
    setSaved(n)
    setScores({})
    setCopiedGoals({})
    setTimeout(() => nav('/historie'), 1200)
  }

  return (
    <>
      <PageHeader
        icon={<Layers size={28} />}
        title="Hromadné hodnocení"
        subtitle={`Ohodnoťte celou třídu ${db.classes.find((c) => c.id === subj.classId)?.name ?? ''} v jedné tabulce. Vyberte období a dovednosti, u každého žáka zvolte úroveň a uložte vše najednou.`}
      />

      <div className="flex flex-col gap-4">
        <Card title="Období a dovednosti">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
              Období
              <Select value={ptype} onChange={(e) => setPtype(e.target.value as PeriodType)} className="w-auto">
                {PERIODS.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}
              </Select>
            </label>
            <div className="text-sm text-ink-soft">{periodLabel(ptype, range.from, range.to)}</div>
            <Button className="ml-auto" onClick={copyPrevious} title="Předvyplní tabulku dovednostmi, úrovněmi a cíli z posledního hodnocení každého žáka">
              <CopyPlus size={16} /> Převzít z minulého hodnocení
            </Button>
          </div>
          {copyNote && <p className="mt-2 text-sm text-sea-700">{copyNote}</p>}
          <div className="mt-3 flex flex-col gap-1 text-xs font-semibold text-ink-faint">
            Hodnocené dovednosti
            <div className="flex flex-wrap gap-2">
              {available.map((c) => (
                <button
                  key={c.id}
                  onClick={() => togglePick(c.id)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-sm font-semibold',
                    picked.includes(c.id) ? 'border-sea-500 bg-sea-50 text-sea-700' : 'border-line text-ink-soft hover:text-ink',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {students.length === 0 ? (
          <Empty title="Žádní žáci">Přidejte žáky do třídy v sekci Třídy a žáci.</Empty>
        ) : skills.length === 0 ? (
          <Empty title="Vyberte dovednosti">Nahoře zaškrtněte aspoň jednu dovednost k hodnocení.</Empty>
        ) : (
          <Card title={`Žáci (${students.length})`} className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="sticky left-0 bg-surface py-2 pr-3 font-semibold">Žák</th>
                  {skills.map((c) => <th key={c.id} className="px-2 py-2 text-center font-semibold" title={c.name}>{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.id} className="border-b border-line/60">
                    <td className="sticky left-0 bg-surface py-2 pr-3 font-semibold whitespace-nowrap">
                      {st.firstName} {st.lastName}
                      {(copiedGoals[st.id]?.length ?? 0) > 0 && (
                        <span className="ml-1.5 align-middle text-xs font-semibold text-sea-700" title="Převzaté cíle se uloží k hodnocení">+{copiedGoals[st.id].length} {copiedGoals[st.id].length === 1 ? 'cíl' : 'cíle'}</span>
                      )}
                    </td>
                    {skills.map((c) => {
                      const cur = scores[st.id]?.[c.id]
                      return (
                        <td key={c.id} className="px-2 py-1.5">
                          <div className="flex justify-center gap-1" role="radiogroup" aria-label={`${st.firstName} – ${c.name}`}>
                            {LEVELS.map(({ level, name }) => (
                              <button
                                key={level}
                                role="radio"
                                aria-checked={cur === level}
                                title={`${level} – ${name}`}
                                onClick={() => setCell(st.id, c.id, level)}
                                className={cx('tabular h-7 w-7 rounded-md border text-xs font-bold transition-colors', cur === level ? 'border-transparent text-white' : 'border-line bg-surface text-ink-soft hover:border-ink-faint')}
                                style={cur === level ? { background: `var(--color-lv${level})` } : undefined}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" disabled={filled.length === 0} onClick={save}>
            <Check size={16} /> Uložit vše ({filled.length} {filled.length === 1 ? 'žák' : filled.length >= 2 && filled.length <= 4 ? 'žáci' : 'žáků'})
          </Button>
          {saved > 0 && <span role="status" className="text-sm font-semibold text-good">Uloženo {saved} hodnocení.</span>}
          <span className="text-sm text-ink-faint">Uloží se jako rozpracovaná hodnocení, dopracovat je můžete v Historii. Úroveň 1 = výborně … 5 = zatím nezvládá.</span>
        </div>
      </div>
    </>
  )
}
