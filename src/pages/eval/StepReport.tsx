import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Printer, RefreshCw, RotateCcw, Wand2 } from 'lucide-react'
import { saveReport, useDB } from '../../lib/store'
import { GOAL_STATUS_LABEL, NO_OBSTACLES } from '../../lib/analysis'
import { aiAvailable, suggestDevelopment, suggestReport } from '../../lib/ai'
import { describeSelf } from '../../lib/questionnaire'
import { periodLabel } from '../../lib/periods'
import { fmt } from '../../lib/dates'
import { fullName } from '../../lib/util'
import type { Report, ReportLength, Swot } from '../../lib/types'
import { Button, Card, cx, Pill, Tabs } from '../../components/ui'
import { AttachmentList } from '../../components/Attachments'
import type { StepProps } from './Wizard'

export const DEV_FIELDS: { key: 's' | 'w' | 'o' | 't'; title: string; was: string; tone: string; box: string }[] = [
  { key: 's', title: 'Co žák zvládá', was: 'S – silné stránky', tone: 'text-good', box: 'border-good/40 bg-good-wash' },
  { key: 'w', title: 'Co potřebuje zlepšit', was: 'W – oblasti pro zlepšení', tone: 'text-orange', box: 'border-orange/40 bg-orange-wash' },
  { key: 'o', title: 'Možnosti dalšího rozvoje', was: 'O – příležitosti', tone: 'text-blue', box: 'border-blue/40 bg-blue-wash' },
  { key: 't', title: 'Překážky v učení', was: 'T – rizika', tone: 'text-bad', box: 'border-bad/40 bg-bad-wash' },
]

const LENGTH_HELP: Record<ReportLength, string> = {
  kratke: 'Několik vět: co žák zvládá, co potřebuje zlepšit a jeden konkrétní další krok.',
  stredni: 'Podrobnější shrnutí výsledků a pokroku, oblasti pro zlepšení a doporučení.',
  dlouhe: 'Komplexní hodnocení: dovednosti, porovnání s předchozími výsledky, sebehodnocení, cíle a doporučení.',
}

const emptyReport = (): Report => ({ length: 'stredni', text: '', original: '', source: 'sablona', approved: false, approvedAt: null, missing: [], attachments: [] })

export default function StepReport({ a, setDirty }: StepProps) {
  const db = useDB()
  const asm = a!
  const self = db.selfAssessments.find((s) => s.assessmentId === asm.id)
  const st = db.students.find((s) => s.id === asm.studentId)
  const subj = db.subjects.find((s) => s.id === asm.subjectId)
  const cls = db.classes.find((c) => c.id === st?.classId)
  const [rep, setRep] = useState<Report>(asm.report ?? emptyReport())
  const [dev, setDev] = useState<Swot>(asm.swot)
  const [busy, setBusy] = useState<'' | 'text' | 'dev'>('')
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => setDirty(touched), [touched, setDirty])
  const started = useRef(false)

  const units = asm.units.map((id) => db.units.find((u) => u.id === id)?.name).filter(Boolean) as string[]
  const attachments = db.attachments.filter((x) => x.assessmentId === asm.id)

  async function createText(length: ReportLength) {
    setBusy('text')
    const r = await suggestReport(db, asm, self, length)
    setRep((x) => ({ ...x, length, text: r.value.text, original: r.value.text, missing: r.value.missing, source: r.source, approved: false, approvedAt: null }))
    setNote(r.note ?? '')
    setBusy('')
    setTouched(true)
  }
  async function createDev() {
    setBusy('dev')
    const r = await suggestDevelopment(db, asm, self)
    setDev({ ...r.value, t: r.value.t.trim() || NO_OBSTACLES })
    setBusy('')
    setTouched(true)
  }

  // Při prvním otevření se návrh vytvoří automaticky (pokud ještě neexistuje).
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!asm.report?.text) void createText(rep.length)
    if (!asm.swot.s && !asm.swot.w && !asm.swot.o && !asm.swot.t) void createDev()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(approve: boolean) {
    saveReport(asm.id, rep, { ...dev, t: dev.t.trim() || NO_OBSTACLES }, approve)
    setTouched(false)
    setRep((x) => ({ ...x, approved: approve, approvedAt: approve ? new Date().toISOString() : null }))
    setFlash(approve ? 'Schváleno a uloženo. Hodnocení je dokončené.' : 'Uloženo jako rozpracované.')
    setTimeout(() => setFlash(''), 3000)
  }

  const plainText = () =>
    [
      `Formativní hodnocení – ${st ? fullName(st) : ''}, ${cls?.name ?? ''}, ${subj?.name ?? ''}`,
      `Období: ${periodLabel(asm.periodType, asm.periodFrom, asm.periodTo)} · Datum: ${fmt(asm.date)}`,
      '',
      rep.text,
      '',
      'Individuální rozvoj žáka',
      ...DEV_FIELDS.map((f) => `${f.title}:\n${dev[f.key] || '–'}`),
    ].join('\n')

  const edit = (fn: (r: Report) => Report) => { setRep((x) => fn({ ...x, approved: false, approvedAt: null })); setTouched(true) }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Zpráva pro žáka a rodiče">
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-faint">Žák</dt><dd className="font-semibold">{st ? fullName(st) : '–'}</dd>
          <dt className="text-ink-faint">Třída · předmět</dt><dd>{cls?.name} · {subj?.name}</dd>
          <dt className="text-ink-faint">Hodnocené období</dt><dd>{periodLabel(asm.periodType, asm.periodFrom, asm.periodTo)}</dd>
          <dt className="text-ink-faint">Datum</dt><dd>{fmt(asm.date)}</dd>
          <dt className="text-ink-faint">Tematické celky</dt><dd>{[...units, asm.topic].filter(Boolean).join(' · ') || '–'}</dd>
          <dt className="text-ink-faint">Vzdělávací cíle</dt>
          <dd>
            {asm.goals.length ? (
              <ul className="flex flex-col gap-1">
                {asm.goals.map((g) => (
                  <li key={g.id}>{g.text} <Pill tone={g.status === 'splneno' ? 'good' : g.status === 'castecne' ? 'warn' : g.status ? 'bad' : 'neutral'}>{g.status ? GOAL_STATUS_LABEL[g.status].toLowerCase() : 'neoznačeno'}</Pill></li>
                ))}
              </ul>
            ) : '–'}
          </dd>
          <dt className="text-ink-faint">Pohled žáka</dt>
          <dd>{self?.answers ? `${describeSelf(self).understanding} Cíle: ${describeSelf(self).goalMet.toLowerCase()}. (vlastní pohled žáka)` : self ? 'Starší podoba sebehodnocení.' : 'Sebehodnocení zatím chybí.'}</dd>
        </dl>
      </Card>

      <Card
        title="Slovní formativní hodnocení"
        action={rep.approved ? <Pill tone="good">schváleno {rep.approvedAt ? fmt(rep.approvedAt.slice(0, 10)) : ''}</Pill> : <Pill tone="warn">návrh</Pill>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Tabs<ReportLength>
            value={rep.length}
            onChange={(l) => edit((x) => ({ ...x, length: l }))}
            options={[{ value: 'kratke', label: 'Krátké' }, { value: 'stredni', label: 'Střední' }, { value: 'dlouhe', label: 'Dlouhé' }]}
          />
          <span className="text-sm text-ink-soft">{LENGTH_HELP[rep.length]}</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => createText(rep.length)} disabled={!!busy}>
            {busy === 'text' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Vytvořit návrh hodnocení
          </Button>
          <Button onClick={() => edit((x) => ({ ...x, text: x.original }))} disabled={!rep.original || rep.text === rep.original}>
            <RotateCcw size={15} /> Vrátit původní návrh
          </Button>
          <Button variant="brand" onClick={() => persist(true)} disabled={!rep.text.trim() || !!busy}><Check size={16} /> Schválit a uložit</Button>
          <Button variant="ghost" onClick={() => persist(false)} disabled={!!busy}>Uložit bez schválení</Button>
        </div>
        <p className="mb-2 text-xs text-ink-faint">
          Návrh: {rep.source === 'ai' ? 'AI' : 'šablona z uložených údajů'}{!aiAvailable && ' · AI zatím není připojena (připraveno pro server)'}. Vychází z hodnocení učitele, komentářů, sebehodnocení, cílů, předchozích hodnocení a doložených prací.
        </p>
        {note && <p className="mb-2 text-xs text-ink-faint">{note}</p>}
        {rep.missing.length > 0 && (
          <div className="mb-3 rounded-xl border border-warn/30 bg-warn-wash px-3 py-2 text-sm text-warn">
            <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> Hodnocení je vytvořené jen z dostupných podkladů. Chybí:</div>
            <ul className="mt-1 list-disc pl-5">{rep.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        <textarea
          id="zprava-text"
          aria-label="Text formativního hodnocení"
          rows={rep.length === 'dlouhe' ? 16 : rep.length === 'stredni' ? 11 : 6}
          value={rep.text}
          onChange={(e) => edit((x) => ({ ...x, text: e.target.value }))}
          className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] leading-relaxed focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-100"
        />
        {flash && <p role="status" className="mt-2 text-sm font-semibold text-good">{flash}</p>}
      </Card>

      <Card
        title="Individuální rozvoj žáka"
        action={<Button variant="ghost" className="text-sea-600" onClick={createDev} disabled={!!busy}>{busy === 'dev' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Vytvořit automaticky</Button>}
      >
        <p className="mb-3 text-sm text-ink-soft">Vychází z hodnocení učitele, sebehodnocení žáka a historie pokroku. Nevymýšlí osobní vlastnosti, diagnózy ani nepodložené obtíže. Každé pole můžete upravit.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {DEV_FIELDS.map((f) => (
            <label key={f.key} className={cx('flex flex-col gap-1.5 rounded-2xl border p-3', f.box)}>
              <span className={cx('font-bold', f.tone)}>{f.title} <span className="text-xs font-normal text-ink-faint">(dříve {f.was})</span></span>
              <textarea
                id={`rozvoj-${f.key}`}
                rows={5}
                value={dev[f.key]}
                onChange={(e) => { setDev((d) => ({ ...d, [f.key]: e.target.value, proposed: false })); setRep((x) => ({ ...x, approved: false })); setTouched(true) }}
                className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed focus:border-sea-500 focus:outline-none"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Přílohy výsledného hodnocení">
        <p className="mb-2 text-sm text-ink-soft">Zaškrtněte přílohy, které budou součástí výsledné zprávy a exportu.</p>
        <AttachmentList
          items={attachments}
          selectable
          selected={rep.attachments}
          onToggle={(id) => edit((x) => ({ ...x, attachments: x.attachments.includes(id) ? x.attachments.filter((y) => y !== id) : [...x.attachments, id] }))}
          empty="K hodnocení zatím nejsou připojené práce žáka ani dokumenty učitele."
        />
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => navigator.clipboard?.writeText(plainText()).then(() => { setFlash('Hodnocení zkopírováno do schránky.'); setTimeout(() => setFlash(''), 2500) }).catch(() => {})}>
          <Copy size={15} /> Kopírovat hodnocení
        </Button>
        <a href={`#/tisk/hodnoceni/${asm.id}`} target="_blank" rel="noreferrer">
          <Button variant="primary"><Printer size={15} /> Tisk / uložit jako PDF</Button>
        </a>
        {touched && <span className="text-sm text-warn">Neuložené změny – nezapomeňte uložit.</span>}
      </div>
    </div>
  )
}
