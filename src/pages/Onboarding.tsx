import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Sparkles } from 'lucide-react'
import { addSchool, seedDemoRemote, useDB } from '../lib/store'
import { Button, Card, Field, Input, PageHeader, cx } from '../components/ui'

/** První přihlášení: založit školu, nebo nahrát ukázková (fiktivní) data. */
export default function Onboarding() {
  const db = useDB()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState<'ZS' | 'SS'>('ZS')

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={`Vítejte${db.settings.teacherName ? `, ${db.settings.teacherName}` : ''}`} subtitle="Zatím tu nemáte žádnou třídu. Začněte ukázkovými daty, nebo založte svou školu." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Sparkles size={18} /> Ukázková data</span>}>
          <p className="text-sm text-ink-soft">Fiktivní třídy 7.A (ZŠ) a ME1 (SŠ) se záznamy za posledních devět týdnů. Data budou jen vaše a můžete je libovolně měnit.</p>
          <Button variant="primary" className="mt-4" onClick={() => { seedDemoRemote(db.settings.teacherName); nav('/prehled') }}>
            Nahrát ukázková data
          </Button>
        </Card>
        <Card title={<span className="flex items-center gap-2"><School size={18} /> Vlastní škola</span>}>
          <div className="grid gap-3">
            <Field label="Název školy">
              <Input id="nazev-skoly" value={name} onChange={(e) => setName(e.target.value)} placeholder="např. ZŠ Pod Lipami" />
            </Field>
            <div className="inline-flex w-fit rounded-xl border border-line bg-canvas p-1" role="group" aria-label="Typ školy">
              {(['ZS', 'SS'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                  className={cx('rounded-lg px-3 py-1 text-sm font-bold', type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint')}>
                  {t === 'ZS' ? 'Základní' : 'Střední'}
                </button>
              ))}
            </div>
            <Button variant="primary" disabled={!name.trim()} onClick={() => { addSchool(name, type); nav('/tridy') }}>
              Založit školu
            </Button>
            <p className="text-xs text-ink-faint">Zatím zadávejte jen fiktivní žáky. Skutečné údaje až po dokončení ochrany osobních údajů (GDPR).</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
