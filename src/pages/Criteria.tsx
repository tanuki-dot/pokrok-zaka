import { useState } from 'react'
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { addCriterion, addPhrase, addUnit, removeCriterion, removePhrase, removeUnit, toggleDefault } from '../lib/store'
import { unitsFor } from '../lib/catalog'
import type { Feedback } from '../lib/types'
import { Button, Card, cx, Empty, Field, Input, PageHeader, Pill, Select } from '../components/ui'

const KIND: Record<keyof Feedback, string> = { good: 'Co se povedlo', todo: 'Co procvičit', next: 'Další krok' }

export default function CriteriaPage() {
  const { db, subj } = useCtx()
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [phrase, setPhrase] = useState('')
  const [pkind, setPkind] = useState<keyof Feedback>('good')
  const [unitName, setUnitName] = useState('')
  if (!subj) return <Empty title="Vyberte předmět" />

  const defaults = db.criteria.filter((c) => c.subjectId === null && !c.archived)
  const custom = db.criteria.filter((c) => c.subjectId === subj.id && !c.archived)
  const archived = db.criteria.filter((c) => c.archived)
  const cls = db.classes.find((c) => c.id === subj.classId)
  const school = db.schools.find((s) => s.id === cls?.schoolId)
  const units = unitsFor(db.units, subj.name, cls?.grade, school?.type)

  return (
    <>
      <PageHeader
        icon={<SlidersHorizontal size={28} />}
        title="Dovednosti a věty"
        subtitle={`Co budete v předmětu ${subj.name.toLowerCase()} hodnotit. Společné dovednosti platí pro všechny předměty – nerelevantní vypněte, vlastní přidejte.`}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Společné dovednosti" action={<span className="text-sm text-ink-faint">vypnutím je skryjete jen v tomto předmětu</span>}>
          <ul className="flex flex-col divide-y divide-line">
            {defaults.map((c) => {
              const on = !subj.hiddenDefaults.includes(c.id)
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className={cx('font-semibold', !on && 'text-ink-faint line-through')}>{c.name}</div>
                    <div className="text-sm text-ink-faint">{c.question}</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`Sledovat ${c.name}`}
                    onClick={() => toggleDefault(subj.id, c.id)}
                    className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-sea-500' : 'bg-line')}
                  >
                    <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title={`Vlastní dovednosti · ${subj.name}`}>
          {custom.length === 0 ? (
            <p className="mb-4 text-sm text-ink-faint">Zatím žádná vlastní dovednost.</p>
          ) : (
            <ul className="mb-4 flex flex-col divide-y divide-line">
              {custom.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name} <Pill tone="brand" className="ml-1 align-middle">vlastní</Pill></div>
                    <div className="text-sm text-ink-faint">{c.question}</div>
                  </div>
                  <button className="p-1.5 text-ink-faint hover:text-bad" aria-label={`Smazat ${c.name}`} onClick={() => removeCriterion(c.id)}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="grid gap-3 rounded-xl bg-canvas p-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              addCriterion(subj.id, name, question)
              setName('')
              setQuestion('')
            }}
          >
            <Field label="Název dovednosti">
              <Input id="krit-nazev" value={name} placeholder="Např. Funkce v tabulce" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Co přesně sledujete">
              <Input id="krit-popis" value={question} placeholder="Žák vytvoří tabulku a použije funkci SUMA." onChange={(e) => setQuestion(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" disabled={!name.trim()} className="justify-self-start"><Plus size={16} /> Přidat dovednost</Button>
          </form>
        </Card>

        <Card title={`Tematické celky ŠVP · ${subj.name}`} className="xl:col-span-2">
          <p className="mb-3 text-sm text-ink-soft">Ukázkový katalog podle předmětu{cls?.grade ? ` a ${cls.grade}. ročníku` : ''}. Doplňte vlastní celky podle ŠVP školy.</p>
          {units.length === 0 ? <p className="mb-3 text-sm text-ink-faint">Pro předmět zatím nejsou žádné celky.</p> : (
            <ul className="mb-3 grid gap-2 md:grid-cols-2">
              {units.map((u) => (
                <li key={u.id} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{u.name} {u.custom && <Pill tone="brand" className="ml-1">vlastní</Pill>}</div>
                    {u.goals.length > 0 && <div className="text-xs text-ink-faint">{u.goals.length} připravených cílů</div>}
                  </div>
                  {u.custom && <button className="text-ink-faint hover:text-bad" aria-label={`Smazat ${u.name}`} onClick={() => removeUnit(u.id)}><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (unitName.trim()) { addUnit(subj.name, unitName, cls?.grade); setUnitName('') } }}>
            <Input id="celek-nazev" className="min-w-[220px] flex-1" placeholder="Vlastní tematický celek" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!unitName.trim()}><Plus size={16} /> Přidat celek</Button>
          </form>
        </Card>

        {archived.length > 0 && (
          <Card title="Starší dovednosti" className="xl:col-span-2">
            <p className="text-sm text-ink-soft">Dovednosti z dřívějších verzí aplikace. Zůstávají v historii a grafech, pro nová hodnocení se nenabízí: {archived.map((c) => c.name.replace(' (starší)', '')).join(', ')}.</p>
          </Card>
        )}

        <Card title="Banka předpřipravených vět" className="xl:col-span-2">
          <p className="mb-4 text-sm text-ink-soft">Věty se nabízejí jako inspirace ke komentářům v dotazníku učitele, abyste nemuseli vše pokaždé psát.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(KIND) as (keyof Feedback)[]).map((k) => (
              <div key={k}>
                <h3 className="mb-2 text-sm font-bold text-ink-soft">{KIND[k]}</h3>
                <ul className="flex flex-col gap-1.5">
                  {db.phrases.filter((p) => p.kind === k).map((p) => (
                    <li key={p.id} className="flex items-start gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                      <span className="flex-1">{p.text}</span>
                      <button className="text-ink-faint hover:text-bad" aria-label="Smazat větu" onClick={() => removePhrase(p.id)}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!phrase.trim()) return
              addPhrase(pkind, phrase)
              setPhrase('')
            }}
          >
            <Select id="veta-typ" aria-label="Typ věty" className="w-auto" value={pkind} onChange={(e) => setPkind(e.target.value as keyof Feedback)}>
              {(Object.keys(KIND) as (keyof Feedback)[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
            </Select>
            <Input id="veta-text" className="min-w-[220px] flex-1" placeholder="Nová věta" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!phrase.trim()}><Plus size={16} /> Přidat</Button>
          </form>
        </Card>
      </div>
    </>
  )
}
