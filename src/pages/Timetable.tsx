import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { setBells, setTimetableCell, useDB } from '../lib/store'
import { DAYS, DAYS_SHORT, DEFAULT_BELLS, dayIndex, lessonAt, toMin } from '../lib/timetable'
import { useNow } from '../lib/useLesson'
import type { Bell } from '../lib/types'
import { Button, Card, cx, Field, Input, PageHeader, Select } from '../components/ui'

type Cell = { day: number; period: number }

export default function Timetable() {
  const db = useDB()
  const now = useNow()
  const today = dayIndex(now)
  const current = lessonAt(db, now)
  const bells = [...db.settings.bells].sort((a, b) => a.period - b.period)
  const [sel, setSel] = useState<Cell | null>(null)
  const [mobileDay, setMobileDay] = useState(today > 4 ? 0 : today)
  const editorRef = useRef<HTMLDivElement>(null)

  const entryAt = (day: number, period: number) => db.timetable.find((x) => x.day === day && x.period === period)
  const label = (classId: string, subjectId: string) => ({
    cls: db.classes.find((c) => c.id === classId)?.name ?? '?',
    subj: db.subjects.find((p) => p.id === subjectId)?.name ?? '?',
  })

  function pick(cell: Cell) {
    setSel(cell)
    // Na telefonu je editor pod mřížkou – posunout k němu.
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1279px)').matches) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <>
      <PageHeader
        icon={<CalendarClock size={28} />}
        title="Rozvrh"
        subtitle="Během hodiny z rozvrhu aplikace sama vybere třídu a předmět. Výběr jde vždy změnit ručně a rozvrh není povinný."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="min-w-0" title="Týdenní rozvrh" action={<span className="text-sm text-ink-faint">Klepnutím na hodinu ji upravíte.</span>}>
          <div className="-mx-1 hidden overflow-x-auto px-1 sm:block">
            <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  <th className="w-[78px]" />
                  {DAYS_SHORT.map((d, i) => (
                    <th key={d} className={cx('rounded-lg py-1.5 text-center font-bold', i === today ? 'bg-brand-50 text-brand-700' : 'text-ink-soft')}>
                      <span className="sm:hidden">{d}</span>
                      <span className="hidden sm:inline">{DAYS[i]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bells.map((b) => (
                  <tr key={b.period}>
                    <th className="pr-1 text-left align-middle font-normal">
                      <div className="tabular font-bold">{b.period}.</div>
                      <div className="tabular text-[11px] text-ink-faint">{b.start}–{b.end}</div>
                    </th>
                    {DAYS.map((_, day) => {
                      const e = entryAt(day, b.period)
                      const isNow = current?.day === day && current.bell.period === b.period
                      const isSel = sel?.day === day && sel.period === b.period
                      const l = e && label(e.classId, e.subjectId)
                      return (
                        <td key={day} className="p-0">
                          <button
                            onClick={() => pick({ day, period: b.period })}
                            aria-label={`${DAYS[day]}, ${b.period}. hodina: ${l ? `${l.cls} ${l.subj}${e?.room ? `, učebna ${e.room}` : ''}` : 'volno'}`}
                            aria-pressed={isSel}
                            className={cx(
                              'flex h-[58px] w-full flex-col items-start justify-center rounded-xl border px-2.5 text-left transition-colors',
                              e ? 'border-sea-100 bg-sea-50 hover:border-sea-500' : 'border-dashed border-line text-ink-faint hover:border-ink-faint',
                              isNow && 'ring-2 ring-brand-500',
                              isSel && 'border-sea-500 ring-2 ring-sea-500',
                            )}
                          >
                            {l ? (
                              <>
                                <span className="flex w-full items-baseline justify-between gap-1">
                                  <span className="truncate font-bold text-sea-700">{l.cls}</span>
                                  {e.room && <span className="tabular shrink-0 text-[11px] font-semibold text-ink-faint">{e.room}</span>}
                                </span>
                                <span className="w-full truncate text-xs text-ink-soft">{l.subj}</span>
                              </>
                            ) : (
                              <Plus size={15} className="opacity-50" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Telefon: jeden den, záložky Po–Pá */}
          <div className="sm:hidden">
            <div className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-canvas p-1" role="tablist" aria-label="Den">
              {DAYS_SHORT.map((d, i) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={mobileDay === i}
                  onClick={() => setMobileDay(i)}
                  className={cx(
                    'rounded-lg py-1.5 text-sm font-bold',
                    mobileDay === i ? 'bg-surface text-ink shadow-sm' : i === today ? 'text-brand-600' : 'text-ink-faint',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {bells.map((b) => {
                const e = entryAt(mobileDay, b.period)
                const isNow = current?.day === mobileDay && current.bell.period === b.period
                const isSel = sel?.day === mobileDay && sel.period === b.period
                const l = e && label(e.classId, e.subjectId)
                return (
                  <li key={b.period}>
                    <button
                      onClick={() => pick({ day: mobileDay, period: b.period })}
                      aria-label={`${DAYS[mobileDay]}, ${b.period}. hodina: ${l ? `${l.cls} ${l.subj}${e?.room ? `, učebna ${e.room}` : ''}` : 'volno'}`}
                      aria-pressed={isSel}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left',
                        e ? 'border-sea-100 bg-sea-50' : 'border-dashed border-line',
                        isNow && 'ring-2 ring-brand-500',
                        isSel && 'border-sea-500 ring-2 ring-sea-500',
                      )}
                    >
                      <span className="w-[84px] shrink-0 whitespace-nowrap">
                        <span className="tabular block font-bold">{b.period}.</span>
                        <span className="tabular block text-[11px] text-ink-faint">{b.start}–{b.end}</span>
                      </span>
                      {l ? (
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-sea-700">{l.cls}</span>
                          <span className="block truncate text-sm text-ink-soft">{l.subj}{e.room && ` · učebna ${e.room}`}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-ink-faint">volno · klepnutím přidáte</span>
                      )}
                      {isNow && <span className="ml-auto shrink-0 text-xs font-semibold text-brand-700">teď</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-brand-500" /> aktuální hodina</span>
            <span>Dnešní den je zvýrazněný.</span>
          </p>
        </Card>

        <div ref={editorRef} className="grid min-w-0 scroll-mt-44 gap-4 md:grid-cols-2 md:items-start lg:scroll-mt-24 xl:flex xl:flex-col [&>*]:min-w-0">
          {sel ? <CellEditor key={`${sel.day}-${sel.period}`} cell={sel} bell={bells.find((b) => b.period === sel.period)} onClose={() => setSel(null)} /> : (
            <Card title="Úprava hodiny">
              <p className="text-sm text-ink-soft">Vyberte v rozvrhu hodinu a nastavte, kterou třídu a předmět v ní učíte.</p>
            </Card>
          )}
          <BellsEditor />
        </div>
      </div>
    </>
  )
}

function CellEditor({ cell, bell, onClose }: { cell: Cell; bell?: Bell; onClose: () => void }) {
  const db = useDB()
  const existing = db.timetable.find((x) => x.day === cell.day && x.period === cell.period)
  const [classId, setClassId] = useState(existing?.classId ?? db.classes[0]?.id ?? '')
  const subjects = db.subjects.filter((p) => p.classId === classId)
  const [subjectId, setSubjectId] = useState(existing?.subjectId ?? subjects[0]?.id ?? '')
  const [room, setRoom] = useState(existing?.room ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!subjects.some((p) => p.id === subjectId)) setSubjectId(subjects[0]?.id ?? '')
  }, [classId, subjects, subjectId])

  return (
    <Card
      title={`${DAYS[cell.day]} · ${cell.period}. hodina`}
      action={<button onClick={onClose} className="rounded-lg p-1 text-ink-faint hover:text-ink" aria-label="Zavřít úpravu"><X size={18} /></button>}
    >
      {bell && <p className="-mt-2 mb-4 text-sm text-ink-faint">{bell.start}–{bell.end}</p>}
      <div className="flex flex-col gap-3">
        <Field label="Třída">
          <Select id="rozvrh-trida" value={classId} onChange={(e) => { setClassId(e.target.value); setSaved(false) }}>
            {db.schools.map((s) => (
              <optgroup key={s.id} label={s.type === 'ZS' ? 'ZŠ' : 'SŠ'}>
                {db.classes.filter((c) => c.schoolId === s.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Předmět">
          <Select id="rozvrh-predmet" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setSaved(false) }} disabled={!subjects.length}>
            {!subjects.length && <option value="">Třída nemá předmět</option>}
            {subjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Učebna" hint="Nepovinné, např. 312.">
          <Input id="rozvrh-ucebna" value={room} maxLength={12} placeholder="Číslo učebny" onChange={(e) => { setRoom(e.target.value); setSaved(false) }} />
        </Field>
        {!subjects.length && (
          <p className="text-sm text-ink-soft">Předmět přidáte v sekci <Link to="/tridy" className="font-semibold text-sea-600">Třídy a žáci</Link>.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!classId || !subjectId} onClick={() => { setTimetableCell(cell.day, cell.period, { classId, subjectId, room }); setSaved(true) }}>
            Uložit
          </Button>
          {existing && (
            <Button variant="danger" onClick={() => { setTimetableCell(cell.day, cell.period, null); onClose() }}>
              <Trash2 size={15} /> Vyprázdnit
            </Button>
          )}
        </div>
        {saved && <p role="status" className="text-sm font-semibold text-good">Uloženo do rozvrhu.</p>}
      </div>
    </Card>
  )
}

function BellsEditor() {
  const db = useDB()
  const [draft, setDraft] = useState<Bell[]>(() => [...db.settings.bells].sort((a, b) => a.period - b.period))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify([...db.settings.bells].sort((a, b) => a.period - b.period))

  const update = (i: number, k: 'start' | 'end', v: string) => {
    setDraft((d) => d.map((b, j) => (j === i ? { ...b, [k]: v } : b)))
    setMsg(null)
  }

  /** „8:00“ → „08:00“, „0800“ → „08:00“; neplatné nechá být (zachytí validate). */
  const norm = (v: string) => {
    const m = v.trim().match(/^(\d{1,2})[:.]?(\d{2})$/)
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : v.trim()
  }

  function validate(list: Bell[]): string | null {
    for (let i = 0; i < list.length; i++) {
      const b = list[i]
      const valid = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
      if (!valid(b.start) || !valid(b.end)) return `${b.period}. hodina: zadejte čas ve tvaru 08:00.`
      if (toMin(b.start) >= toMin(b.end)) return `${b.period}. hodina: konec musí být po začátku.`
      if (i > 0 && toMin(b.start) < toMin(list[i - 1].end)) return `${b.period}. hodina začíná dřív, než skončí ${list[i - 1].period}. hodina.`
    }
    return null
  }

  function addAfter() {
    const last = draft[draft.length - 1]
    const s = last ? toMin(last.end) + 10 : 8 * 60
    const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    setDraft([...draft, { period: last ? last.period + 1 : 1, start: hhmm(s), end: hhmm(s + 45) }])
  }

  function addZero() {
    const first = draft[0]
    const e = first ? toMin(first.start) - 10 : 7 * 60 + 55
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    setDraft([{ period: 0, start: hhmm(e - 45), end: hhmm(e) }, ...draft])
  }

  return (
    <Card title="Zvonění">
      <p className="-mt-2 mb-3 text-sm text-ink-soft">Podle časů se pozná, která hodina právě probíhá – i bez vyplněného rozvrhu.</p>
      <ul className="flex flex-col gap-2">
        {draft.map((b, i) => (
          <li key={b.period} className="flex items-center gap-2">
            <span className="tabular w-7 shrink-0 text-right font-bold">{b.period}.</span>
            <Input id={`zvoneni-${b.period}-od`} aria-label={`${b.period}. hodina začátek`} type="text" inputMode="numeric" maxLength={5} size={5} placeholder="08:00" className="min-w-0 flex-1 px-2 text-center tabular" value={b.start} onChange={(e) => update(i, 'start', e.target.value)} />
            <span className="text-ink-faint">–</span>
            <Input id={`zvoneni-${b.period}-do`} aria-label={`${b.period}. hodina konec`} type="text" inputMode="numeric" maxLength={5} size={5} placeholder="08:45" className="min-w-0 flex-1 px-2 text-center tabular" value={b.end} onChange={(e) => update(i, 'end', e.target.value)} />
            <button
              className={cx('shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-bad', i !== 0 && i !== draft.length - 1 && 'invisible')}
              aria-label={`Odebrat ${b.period}. hodinu`}
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              disabled={draft.length <= 1}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <button className="inline-flex items-center gap-1 text-sm font-semibold text-sea-600" onClick={addAfter}><Plus size={15} /> Přidat hodinu</button>
        {!draft.some((b) => b.period === 0) && (
          <button className="inline-flex items-center gap-1 text-sm font-semibold text-sea-600" onClick={addZero}><Plus size={15} /> 0. hodina</button>
        )}
        <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft" onClick={() => { setDraft(DEFAULT_BELLS); setMsg(null) }}><RotateCcw size={14} /> Výchozí</button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={() => {
            const list = draft.map((b) => ({ ...b, start: norm(b.start), end: norm(b.end) }))
            const err = validate(list)
            if (err) return setMsg({ ok: false, text: err })
            const removed = db.timetable.filter((x) => !list.some((b) => b.period === x.period)).length
            setDraft(list)
            setBells(list)
            setMsg({ ok: true, text: removed ? `Uloženo. Z rozvrhu odebráno ${removed} hodin, které ve zvonění už nejsou.` : 'Zvonění uloženo.' })
          }}
        >
          Uložit zvonění
        </Button>
      </div>
      {msg && <p role="status" className={cx('mt-2 text-sm font-semibold', msg.ok ? 'text-good' : 'text-bad')}>{msg.text}</p>}
    </Card>
  )
}
