import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Wand2 } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { saveSummary, uid } from '../lib/store'
import { generateSummary } from '../lib/analysis'
import { fmt, fmtShort, inRange, KIND_LABEL, periodFor, today } from '../lib/dates'
import type { Summary, SummaryKind } from '../lib/types'
import { fullName } from '../lib/util'
import { Button, Card, Empty, Field, Input, PageHeader, Pill, Select, Tabs } from '../components/ui'

const KIND_HELP: Record<SummaryKind, string> = {
  tyden: 'Co žák zvládl, v čem se posunul, co procvičit a co udělat příště.',
  mesic: 'Vývoj dovedností po týdnech, hlavní změny a plnění cílů.',
  pololeti: 'Co se naučil, v čem se nejvíc zlepšil, co zvládá samostatně, kde potřebuje podporu a cíle do dalšího pololetí.',
}

export default function Summaries() {
  const { db, cls, subj, students } = useCtx()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [kind, setKind] = useState<SummaryKind>('tyden')
  const [anchor, setAnchor] = useState(today())
  const [who, setWho] = useState(params.get('zak') ?? 'vsichni')
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState<'vse' | 'navrh' | 'schvaleno'>('vse')

  if (!subj) return <Empty title="Vyberte předmět" />
  const per = periodFor(kind, anchor)
  const targets = who === 'vsichni' ? students : students.filter((s) => s.id === who)
  const withData = targets.filter((s) =>
    db.assessments.some((a) => a.studentId === s.id && a.subjectId === subj.id && inRange(a.date, per.from, per.to)),
  )

  function create() {
    const created: Summary[] = []
    let skipped = 0
    for (const s of withData) {
      const exists = db.summaries.find((x) => x.studentId === s.id && x.subjectId === subj!.id && x.kind === kind && x.from === per.from)
      if (exists) {
        skipped++
        if (withData.length === 1) return nav(`/souhrny/${exists.id}`)
        continue
      }
      const sum: Summary = {
        id: uid('sum'),
        studentId: s.id,
        subjectId: subj!.id,
        kind,
        from: per.from,
        to: per.to,
        sections: generateSummary(db, s.id, subj!.id, kind, per.from, per.to),
        teacherNote: '',
        status: 'navrh',
        version: 1,
        createdAt: new Date().toISOString(),
        approvedAt: null,
      }
      saveSummary(sum, true)
      created.push(sum)
    }
    if (created.length === 1 && withData.length === 1) return nav(`/souhrny/${created[0].id}`)
    setMsg(`Vytvořeno ${created.length} návrhů${skipped ? `, ${skipped} už existovalo` : ''}. Najdete je v seznamu níže.`)
    setFilter('navrh')
  }

  const list = db.summaries
    .filter((s) => s.subjectId === subj.id && (filter === 'vse' || s.status === filter))
    .sort((a, b) => b.from.localeCompare(a.from) || a.studentId.localeCompare(b.studentId))

  return (
    <>
      <PageHeader
        icon={<FileText size={28} />}
        title="Souhrny"
        subtitle="Týdenní, měsíční a pololetní přehledy vznikají jen z uložených záznamů. Aplikace navrhne slovní hodnocení, vy ho upravíte, schválíte a vytisknete."
      />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card title="Vytvořit návrh" className="xl:self-start">
          <div className="flex flex-col gap-4">
            <Tabs<SummaryKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'tyden', label: 'Týdenní' },
                { value: 'mesic', label: 'Měsíční' },
                { value: 'pololeti', label: 'Pololetní' },
              ]}
            />
            <p className="text-sm text-ink-soft">{KIND_HELP[kind]}</p>
            <Field label="Období" hint={`${per.label} (${fmt(per.from)} – ${fmt(per.to)})`}>
              <Input id="souhrn-datum" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
            </Field>
            <Field label="Žák">
              <Select id="souhrn-zak" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="vsichni">Celá třída {cls?.name} ({students.length} žáků)</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
              </Select>
            </Field>
            <Button variant="brand" disabled={withData.length === 0} onClick={create}>
              <Wand2 size={17} /> Sestavit {withData.length > 1 ? `${withData.length} návrhů` : 'návrh'}
            </Button>
            {withData.length === 0 && <p className="text-sm text-ink-faint">V tomto období nejsou pro výběr žádné záznamy.</p>}
            {withData.length > 0 && withData.length < targets.length && (
              <p className="text-xs text-ink-faint">Bez záznamu v období: {targets.filter((t) => !withData.includes(t)).map(fullName).join(', ')}.</p>
            )}
            {msg && <p role="status" className="rounded-xl bg-good-wash px-3 py-2 text-sm text-good">{msg}</p>}
          </div>
        </Card>

        <Card
          title={`Souhrny · ${subj.name}`}
          action={
            <Tabs
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'vse', label: 'Vše' },
                { value: 'navrh', label: 'Návrhy' },
                { value: 'schvaleno', label: 'Schválené' },
              ]}
            />
          }
        >
          {list.length === 0 ? (
            <Empty title="Žádné souhrny">Vytvořte první návrh vlevo.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-semibold">Žák</th>
                    <th className="py-2 pr-3 font-semibold">Typ</th>
                    <th className="py-2 pr-3 font-semibold">Období</th>
                    <th className="py-2 pr-3 font-semibold">Stav</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((s) => {
                    const st = db.students.find((x) => x.id === s.studentId)
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-3 font-semibold">{st ? `${st.lastName} ${st.firstName}` : '–'}</td>
                        <td className="py-2.5 pr-3">{KIND_LABEL[s.kind]}</td>
                        <td className="tabular py-2.5 pr-3 text-ink-soft">{fmtShort(s.from)}–{fmt(s.to)}</td>
                        <td className="py-2.5 pr-3">
                          <Pill tone={s.status === 'schvaleno' ? 'good' : 'warn'}>{s.status === 'schvaleno' ? 'schváleno' : 'návrh'} · v{s.version}</Pill>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link to={`/souhrny/${s.id}`} className="font-semibold text-sea-600">{s.status === 'schvaleno' ? 'Otevřít' : 'Zkontrolovat'}</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
