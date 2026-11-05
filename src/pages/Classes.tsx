import { useState } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeftRight, FileSpreadsheet, Plus, Trash2, Upload, Users } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { addClass, addStudents, addSubject, removeStudent, removeSubject } from '../lib/store'
import { setSelection } from '../lib/selection'
import { Button, Card, Empty, Field, Input, PageHeader, Pill, Textarea } from '../components/ui'

type Person = { firstName: string; lastName: string }

const SUBJECT_SUGGESTIONS = ['Informatika', 'Matematika', 'Český jazyk', 'Anglický jazyk', 'Fyzika', 'Dějepis', 'Odborný výcvik']

function parseRows(rows: unknown[][]): Person[] {
  const clean = rows.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean))
  if (!clean.length) return []
  const head = clean[0].map((h) => h.toLowerCase())
  const iLast = head.findIndex((h) => h.startsWith('příjmení') || h.startsWith('prijmeni'))
  const iFirst = head.findIndex((h) => h === 'jméno' || h === 'jmeno' || h.startsWith('křestní'))
  const iFull = head.findIndex((h) => h.includes('jméno a příjmení') || h === 'žák' || h === 'zak')
  const hasHeader = iLast >= 0 || iFirst >= 0 || iFull >= 0
  const body = hasHeader ? clean.slice(1) : clean
  return body
    .map((r) => {
      if (iFirst >= 0 && iLast >= 0) return { firstName: r[iFirst] ?? '', lastName: r[iLast] ?? '' }
      const full = iFull >= 0 ? r[iFull] : r.filter(Boolean).length === 1 ? r.find(Boolean)! : null
      if (full) {
        const parts = full.split(/\s+/)
        return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
      }
      return { firstName: r[0] ?? '', lastName: r[1] ?? '' }
    })
    .filter((p) => p.firstName || p.lastName)
}

export default function Classes() {
  const { db, type, classes, cls, subjects, students } = useCtx()
  const [newClass, setNewClass] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [manual, setManual] = useState('')
  const [preview, setPreview] = useState<Person[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState('')
  const school = db.schools.find((s) => s.type === type)

  async function onFile(f: File) {
    setErr('')
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })
      const people = parseRows(rows)
      if (!people.length) setErr('V prvním listu jsme nenašli žádná jména. Použijte sloupce „Jméno“ a „Příjmení“.')
      setPreview(people)
      setFileName(f.name)
    } catch {
      setErr('Soubor se nepodařilo přečíst. Nahrajte .xlsx, .xls nebo .csv.')
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Jméno', 'Příjmení'], ['Adam', 'Novák'], ['Bára', 'Dvořáková']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Žáci')
    XLSX.writeFile(wb, 'vzor-seznam-zaku.xlsx')
  }

  return (
    <>
      <PageHeader
        icon={<Users size={28} />}
        title="Třídy a žáci"
        subtitle={`Krok 1: založte třídu, vyberte předmět a přidejte žáky ručně nebo z Excelu. Škola: ${school?.name ?? '–'} (${type === 'ZS' ? 'ZŠ' : 'SŠ'}).`}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card title="Třídy" className="lg:self-start">
          <ul className="mb-4 flex flex-col gap-1">
            {classes.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelection({ classId: c.id, subjectId: db.subjects.find((p) => p.classId === c.id)?.id ?? '' })}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-semibold ${c.id === cls?.id ? 'bg-sea-50 text-sea-700' : 'hover:bg-canvas'}`}
                >
                  {c.name}
                  <span className="text-xs font-normal text-ink-faint">{db.students.filter((s) => s.classId === c.id).length} žáků</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newClass.trim() || !school) return
              const c = addClass(school.id, newClass)
              setSelection({ classId: c.id, subjectId: '' })
              setNewClass('')
            }}
          >
            <Input id="nova-trida" placeholder="Např. ME1" value={newClass} onChange={(e) => setNewClass(e.target.value)} aria-label="Název nové třídy" />
            <Button type="submit" variant="primary" disabled={!newClass.trim()} aria-label="Založit třídu"><Plus size={17} /></Button>
          </form>
        </Card>

        {!cls ? (
          <Empty title="Založte první třídu" />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <Card title={`Předměty ve třídě ${cls.name}`}>
              <div className="mb-4 flex flex-wrap gap-2">
                {subjects.length === 0 && <span className="text-sm text-ink-faint">Zatím žádný předmět.</span>}
                {subjects.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-3 pr-1 text-sm font-semibold">
                    {p.name}
                    {confirmDel === p.id ? (
                      <>
                        <button className="text-xs text-bad" onClick={() => { removeSubject(p.id); setConfirmDel('') }}>smazat</button>
                        <button className="pr-2 text-xs text-ink-faint" onClick={() => setConfirmDel('')}>zpět</button>
                      </>
                    ) : (
                      <button className="rounded-full p-1 text-ink-faint hover:text-bad" aria-label={`Odebrat ${p.name}`} onClick={() => setConfirmDel(p.id)}><Trash2 size={14} /></button>
                    )}
                  </span>
                ))}
              </div>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newSubject.trim()) return
                  const p = addSubject(cls.id, newSubject)
                  setSelection({ subjectId: p.id })
                  setNewSubject('')
                }}
              >
                <Input id="novy-predmet" list="predmety" className="max-w-xs" placeholder="Např. informatika" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} aria-label="Nový předmět" />
                <datalist id="predmety">{SUBJECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
                <Button type="submit" variant="primary" disabled={!newSubject.trim()}><Plus size={16} /> Přidat předmět</Button>
              </form>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Přidat žáky ručně">
                <Field label="Jeden žák na řádek: Jméno Příjmení">
                  <Textarea id="zaci-rucne" rows={5} value={manual} placeholder={'Adam Novák\nBára Dvořáková'} onChange={(e) => setManual(e.target.value)} />
                </Field>
                <Button
                  className="mt-3"
                  variant="primary"
                  disabled={!manual.trim()}
                  onClick={() => {
                    addStudents(cls.id, parseRows(manual.split('\n').map((l) => [l])))
                    setManual('')
                  }}
                >
                  <Plus size={16} /> Přidat
                </Button>
              </Card>

              <Card title="Nahrát seznam z Excelu" action={<Button variant="ghost" className="text-sea-600" onClick={downloadTemplate}><FileSpreadsheet size={16} /> Stáhnout vzor</Button>}>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft hover:border-sea-500">
                  <Upload size={22} className="text-sea-500" />
                  <span><strong className="text-ink">Vyberte soubor</strong> .xlsx, .xls nebo .csv</span>
                  <span className="text-xs text-ink-faint">Sloupce „Jméno“ a „Příjmení“ nebo jeden sloupec s celým jménem.</span>
                  <input id="import-excel" type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </label>
                {err && <p className="mt-3 text-sm text-bad">{err}</p>}
                {preview && preview.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <strong>{fileName}</strong> · {preview.length} žáků
                      <Button variant="ghost" className="ml-auto" onClick={() => setPreview(preview.map((p) => ({ firstName: p.lastName, lastName: p.firstName })))}>
                        <ArrowLeftRight size={15} /> Prohodit jméno a příjmení
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-auto rounded-xl border border-line">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-canvas text-left text-xs text-ink-faint"><tr><th className="px-3 py-1.5">Jméno</th><th className="px-3 py-1.5">Příjmení</th></tr></thead>
                        <tbody className="divide-y divide-line">
                          {preview.map((p, i) => <tr key={i}><td className="px-3 py-1.5">{p.firstName}</td><td className="px-3 py-1.5">{p.lastName}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="primary" onClick={() => { addStudents(cls.id, preview, true); setPreview(null) }}>Importovat do {cls.name}</Button>
                      <Button onClick={() => setPreview(null)}>Zrušit</Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card title={`Žáci ve třídě ${cls.name}`} action={<Pill>{students.length}</Pill>}>
              {students.length === 0 ? (
                <Empty title="Zatím žádní žáci">Přidejte je ručně nebo z Excelu.</Empty>
              ) : (
                <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                  {students.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 border-b border-line py-2 text-[15px]">
                      <span className="min-w-0 flex-1 truncate">{s.lastName} {s.firstName}</span>
                      {confirmDel === s.id ? (
                        <span className="flex gap-2 text-xs">
                          <button className="font-semibold text-bad" onClick={() => { removeStudent(s.id); setConfirmDel('') }}>smazat i záznamy</button>
                          <button className="text-ink-faint" onClick={() => setConfirmDel('')}>zpět</button>
                        </span>
                      ) : (
                        <button className="p-1 text-ink-faint hover:text-bad" aria-label={`Odebrat ${s.firstName} ${s.lastName}`} onClick={() => setConfirmDel(s.id)}><Trash2 size={14} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
