import { useState } from 'react'
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { addCriterion, addPhrase, removeCriterion, removePhrase, toggleDefault } from '../lib/store'
import type { Feedback } from '../lib/types'
import { Button, Card, cx, Empty, Field, Input, PageHeader, Pill, Select } from '../components/ui'

const KIND: Record<keyof Feedback, string> = { good: 'Co se povedlo', todo: 'Co procvičit', next: 'Další krok' }

export default function CriteriaPage() {
  const { db, subj } = useCtx()
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [phrase, setPhrase] = useState('')
  const [pkind, setPkind] = useState<keyof Feedback>('good')
  if (!subj) return <Empty title="Vyberte předmět" />

  const defaults = db.criteria.filter((c) => c.subjectId === null)
  const custom = db.criteria.filter((c) => c.subjectId === subj.id)

  return (
    <>
      <PageHeader
        icon={<SlidersHorizontal size={28} />}
        title="Kritéria a věty"
        subtitle={`Krok 2: co budete v předmětu ${subj.name.toLowerCase()} hodnotit. Základní oblasti platí pro všechny předměty, vlastní kritéria si přidáte podle potřeby.`}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Základní oblasti" action={<span className="text-sm text-ink-faint">vypnutím je skryjete jen v tomto předmětu</span>}>
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
                    <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title={`Vlastní kritéria · ${subj.name}`}>
          {custom.length === 0 ? (
            <p className="mb-4 text-sm text-ink-faint">Zatím žádné vlastní kritérium.</p>
          ) : (
            <ul className="mb-4 flex flex-col divide-y divide-line">
              {custom.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name} <Pill tone="brand" className="ml-1 align-middle">vlastní</Pill></div>
                    <div className="text-sm text-ink-faint">{c.question}</div>
                  </div>
                  <button className="p-1.5 text-ink-faint hover:text-[#a63a55]" aria-label={`Smazat ${c.name}`} onClick={() => removeCriterion(c.id)}><Trash2 size={15} /></button>
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
            <Field label="Název kritéria">
              <Input id="krit-nazev" value={name} placeholder="Např. Funkce v tabulce" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Co přesně sledujete">
              <Input id="krit-popis" value={question} placeholder="Žák vytvoří tabulku a použije funkci SUMA." onChange={(e) => setQuestion(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" disabled={!name.trim()} className="justify-self-start"><Plus size={16} /> Přidat kritérium</Button>
          </form>
        </Card>

        <Card title="Banka předpřipravených vět" className="xl:col-span-2">
          <p className="mb-4 text-sm text-ink-soft">Věty se nabízejí ve formuláři hodnocení u tří otázek zpětné vazby, abyste nemuseli vše pokaždé psát.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(KIND) as (keyof Feedback)[]).map((k) => (
              <div key={k}>
                <h3 className="mb-2 text-sm font-bold text-ink-soft">{KIND[k]}</h3>
                <ul className="flex flex-col gap-1.5">
                  {db.phrases.filter((p) => p.kind === k).map((p) => (
                    <li key={p.id} className="flex items-start gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                      <span className="flex-1">{p.text}</span>
                      <button className="text-ink-faint hover:text-[#a63a55]" aria-label="Smazat větu" onClick={() => removePhrase(p.id)}><Trash2 size={14} /></button>
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
