import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Pencil, Plus, QrCode, RefreshCw, RotateCcw, X } from 'lucide-react'
import { isExpired, issueSelfCode, revokeSelfCode, SELF_CODE_HOURS, setSelfForm, useDB } from '../../lib/store'
import { describeSelf, isLegacy, selfFormFor, teacherBand } from '../../lib/questionnaire'
import { GOAL_STATUS_LABEL } from '../../lib/analysis'
import { levelLabel, NOT_RATED } from '../../lib/levels'
import { periodLabel } from '../../lib/periods'
import { uid } from '../../lib/util'
import type { Assessment, SelfAssessment, SelfFormDef } from '../../lib/types'
import { Button, Card, Input, Pill } from '../../components/ui'
import { AttachmentList } from '../../components/Attachments'
import type { StepProps } from './Wizard'
import { remoteEnabled } from '../../lib/remote'
import { refresh } from '../../lib/session'

export default function StepSelf({ a, setDirty }: StepProps) {
  const db = useDB()
  const asm = a!
  const st = db.students.find((s) => s.id === asm.studentId)
  const cls = db.classes.find((c) => c.id === st?.classId)
  const base = selfFormFor(asm.periodType, asm.periodFrom, asm.periodTo, cls?.selfWording)
  const form = asm.selfForm ?? base
  const self = db.selfAssessments.find((s) => s.assessmentId === asm.id)
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <Card title="Přístup pro žáka" action={<Pill tone="sea">{periodLabel(asm.periodType, asm.periodFrom, asm.periodTo)}</Pill>}>
        <p className="mb-4 text-sm text-ink-soft">
          Žák vyplní dotazník na mobilu, tabletu nebo počítači přes QR kód nebo odkaz. Uvidí jen své jméno, třídu, předmět, období a vzdělávací cíle, žádná jiná hodnocení. Odpovídá jen na otázky pro hodnocené období.
        </p>
        {self ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm"><Pill tone="good">odesláno</Pill> {new Date(self.submittedAt).toLocaleString('cs-CZ')}{self.corrections ? ` · opraveno ${self.corrections}×` : ''}</p>
            {asm.selfCode && asm.selfCodeCorrection && !isExpired(asm.selfCodeExpires) ? (
              <SelfLink a={asm} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => issueSelfCode(asm.id, true)}><RefreshCw size={15} /> Povolit žákovi opravu odpovědí</Button>
                <span className="text-xs text-ink-faint">Vytvoří nový odkaz, přes který žák může odpovědi jednou upravit.</span>
              </div>
            )}
          </div>
        ) : (
          <SelfLink a={asm} />
        )}
      </Card>

      {self && (
        <Card title="Odpovědi žáka a hodnocení učitele">
          <SelfCompare self={self} a={asm} />
          <h3 className="mb-2 mt-5 text-sm font-bold">Přílohy žáka</h3>
          <AttachmentList items={db.attachments.filter((x) => x.assessmentId === asm.id && x.owner === 'zak')} canDelete empty="Žák nepřiložil žádné soubory." />
        </Card>
      )}

      <Card
        title="Dotazník pro žáka"
        action={
          !editing && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(true)}><Pencil size={15} /> Upravit dotazník</Button>
              {asm.selfForm && <Button variant="ghost" onClick={() => setSelfForm(asm.id, undefined)}><RotateCcw size={15} /> Původní znění</Button>}
            </div>
          )
        }
      >
        {asm.selfForm && !editing && <p className="mb-3 text-sm text-sea-700">Dotazník je upravený pro toto hodnocení.</p>}
        {editing ? (
          <FormEditor
            initial={form}
            onCancel={() => { setEditing(false); setDirty(false) }}
            onSave={(f) => { setSelfForm(asm.id, f); setEditing(false); setDirty(false) }}
            setDirty={setDirty}
          />
        ) : (
          <FormPreview form={form} />
        )}
        {self && editing && <p className="mt-3 text-xs text-ink-faint">Žák už odpověděl, jeho odpovědi zůstávají uložené s původním zněním.</p>}
      </Card>
    </div>
  )
}

function FormPreview({ form }: { form: SelfFormDef }) {
  const q = [
    { t: form.understanding.title, o: form.understanding.options.map((x) => x.label), k: 'jedna odpověď' },
    { t: form.work.title, o: form.work.options.map((x) => x.label), k: 'jedna odpověď' },
    { t: form.wentWell.title, o: form.wentWell.options.map((x) => x.label), k: 'více odpovědí' },
    { t: form.improve.title, o: form.improve.options.map((x) => x.label), k: 'více odpovědí' },
    { t: form.goalMet.title, o: ['Ano', 'Částečně', 'Zatím ne'], k: 'jedna odpověď' },
    { t: form.nextWish.title, o: [], k: 'vlastní nepovinná odpověď' },
  ]
  return (
    <ol className="flex flex-col gap-3">
      {q.map((x, i) => (
        <li key={i} className="rounded-xl border border-line p-3">
          <div className="font-semibold">{i + 1}. {x.t} <span className="text-xs font-normal text-ink-faint">({x.k})</span></div>
          {x.o.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{x.o.map((o) => <li key={o}>{o}</li>)}</ul>}
        </li>
      ))}
      <li className="text-xs text-ink-faint">U každé otázky může žák doplnit vlastní poznámku a přiložit práci (fotografii, úkol, PDF, dokument, prezentaci).</li>
    </ol>
  )
}

function FormEditor({ initial, onSave, onCancel, setDirty }: { initial: SelfFormDef; onSave: (f: SelfFormDef) => void; onCancel: () => void; setDirty: (d: boolean) => void }) {
  const [f, setF] = useState<SelfFormDef>(structuredClone(initial))
  const upd = (fn: (x: SelfFormDef) => void) => {
    setF((cur) => { const n = structuredClone(cur); fn(n); return n })
    setDirty(true)
  }
  const title = (label: string, value: string, onChange: (v: string) => void, id: string) => (
    <label className="block">
      <span className="text-xs font-semibold text-ink-faint">{label}</span>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
  const multi = (key: 'wentWell' | 'improve') => (
    <div className="mt-2 flex flex-col gap-1.5">
      {f[key].options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <Input id={`ed-${key}-${i}`} aria-label={`Možnost ${i + 1}`} value={o.label} onChange={(e) => upd((x) => { x[key].options[i].label = e.target.value })} />
          {key === 'improve' && f.improve.exclusive === o.id ? (
            <Pill className="shrink-0">samostatná volba</Pill>
          ) : (
            <button className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-bad" aria-label="Odebrat možnost" onClick={() => upd((x) => { x[key].options.splice(i, 1) })} disabled={f[key].options.length <= 2}>
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <button className="inline-flex items-center gap-1 self-start text-sm font-semibold text-sea-600" onClick={() => upd((x) => { x[key].options.splice(key === 'improve' && x.improve.exclusive ? x.improve.options.length - 1 : x[key].options.length, 0, { id: uid('o'), label: '' }) })}>
        <Plus size={15} /> Přidat možnost
      </button>
    </div>
  )
  const valid = [f.understanding, f.work].every((q) => q.title.trim() && q.options.every((o) => o.label.trim())) && [f.wentWell, f.improve].every((q) => q.title.trim() && q.options.every((o) => o.label.trim())) && f.goalMet.title.trim() && f.nextWish.title.trim()
  return (
    <div className="flex flex-col gap-4">
      {(['understanding', 'work'] as const).map((k, qi) => (
        <div key={k} className="rounded-xl border border-line p-3">
          {title(`Otázka ${qi + 1} (jedna odpověď)`, f[k].title, (v) => upd((x) => { x[k].title = v }), `ed-${k}`)}
          <div className="mt-2 flex flex-col gap-1.5">
            {f[k].options.map((o, i) => (
              <Input key={o.value} id={`ed-${k}-${i}`} aria-label={`Odpověď ${i + 1}`} value={o.label} onChange={(e) => upd((x) => { x[k].options[i].label = e.target.value })} />
            ))}
          </div>
        </div>
      ))}
      {(['wentWell', 'improve'] as const).map((k, qi) => (
        <div key={k} className="rounded-xl border border-line p-3">
          {title(`Otázka ${qi + 3} (více odpovědí)`, f[k].title, (v) => upd((x) => { x[k].title = v }), `ed-${k}`)}
          {multi(k)}
        </div>
      ))}
      <div className="rounded-xl border border-line p-3">{title('Otázka 5 (Ano / Částečně / Zatím ne)', f.goalMet.title, (v) => upd((x) => { x.goalMet.title = v }), 'ed-goal')}</div>
      <div className="rounded-xl border border-line p-3">{title('Otázka 6 (vlastní nepovinná odpověď)', f.nextWish.title, (v) => upd((x) => { x.nextWish.title = v }), 'ed-wish')}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => onSave(f)}>Uložit úpravy dotazníku</Button>
        <Button onClick={onCancel}>Zrušit</Button>
        {!valid && <span className="text-sm text-bad">Vyplňte všechny otázky a možnosti.</span>}
      </div>
    </div>
  )
}

function SelfLink({ a }: { a: Assessment }) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const code = a.selfCode && !isExpired(a.selfCodeExpires) ? a.selfCode : null
  const url = code ? `${location.origin}${location.pathname}#/sebehodnoceni/${code}` : ''
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#14282b', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [url])
  if (!code)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => issueSelfCode(a.id)}><QrCode size={17} /> Vytvořit QR kód a odkaz</Button>
        <span className="text-sm text-ink-soft">{a.selfCode ? 'Předchozí odkaz vypršel. ' : ''}Odkaz platí {SELF_CODE_HOURS} hodin a jde odeslat jen jednou. Žák nepotřebuje účet.</span>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-5">
      {qr && <img src={qr} alt="QR kód pro sebehodnocení žáka" className="h-40 w-40 rounded-xl border border-line" />}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-sm text-ink-soft">{a.selfCodeCorrection ? 'Kód pro opravu odpovědí' : 'Kód pro žáka'}</div>
        <div className="tabular font-display text-3xl font-bold tracking-[0.2em]">{code}</div>
        <div className="text-xs text-ink-faint">Platí do {new Date(a.selfCodeExpires!).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · jen pro toto hodnocení</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {}) }}>
            <Copy size={15} /> {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
          </Button>
          <a href={url} target="_blank" rel="noreferrer"><Button variant="ghost">Otevřít jako žák</Button></a>
          <Button variant="ghost" onClick={() => revokeSelfCode(a.id)}><X size={15} /> Zrušit odkaz</Button>
        </div>
        {remoteEnabled ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            Až žák odešle odpovědi, načtěte je:
            <Button variant="ghost" onClick={() => void refresh()}><RefreshCw size={14} /> Načíst odpovědi žáka</Button>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">V testovacím provozu se odpovědi ukládají v tomto prohlížeči, otevřete odkaz v nové kartě.</p>
        )}
      </div>
    </div>
  )
}

function Agree({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-ink-faint">–</span>
  return <Pill tone={ok ? 'good' : 'warn'}>{ok ? 'shoda' : 'liší se'}</Pill>
}

export function SelfCompare({ self, a }: { self: SelfAssessment; a: Assessment }) {
  if (isLegacy(self)) {
    return (
      <div>
        <p className="mb-2 text-sm text-ink-soft">Starší podoba sebehodnocení (volné odpovědi).</p>
        <dl className="grid gap-2 text-sm">
          {[['Co se povedlo', self.wentWell], ['Co ještě nejde', self.struggle], ['S čím potřebuji pomoc', self.needHelp], ['Co chci příště', self.nextWant]].map(([l, v]) => (
            <div key={l}><dt className="font-semibold">{l}</dt><dd>{v || '–'}</dd></div>
          ))}
        </dl>
      </div>
    )
  }
  const x = self.answers!
  const ds = describeSelf(self)
  const know = a.scores['k-znalosti']
  const indep = a.scores['k-samostatnost']
  const goalMap = { splneno: 'ano', castecne: 'castecne', nesplneno: 'zatimne' } as const
  const marked = a.goals.filter((g) => g.status)
  const teacherGoals = marked.length ? marked.map((g) => `${GOAL_STATUS_LABEL[g.status!]}`).join(', ') : 'neoznačeno'
  const goalAgree = marked.length ? marked.every((g) => goalMap[g.status!] === x.goalMet) : null
  const rows: [string, string, string, boolean | null, string | undefined][] = [
    ['Porozumění učivu', ds.understanding, know ? `Porozumění učivu: ${levelLabel(know)}` : NOT_RATED, know ? teacherBand(know) === x.understanding : null, ds.notes.understanding],
    ['Práce a samostatnost', ds.work, indep ? `Samostatnost: ${levelLabel(indep)}` : NOT_RATED, indep ? teacherBand(indep) === x.work : null, ds.notes.work],
    ['Splnění cílů', ds.goalMet, teacherGoals, goalAgree, ds.notes.goalMet],
    ['Co se povedlo', ds.wentWell.join(' ') || '–', a.feedback.good || '–', null, ds.notes.wentWell],
    ['Co zlepšit', ds.improve.join(' ') || '–', a.feedback.todo || '–', null, ds.notes.improve],
    ['Vlastní odpověď žáka', ds.nextWish || '–', a.feedback.next || '–', null, undefined],
  ]
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-3 font-semibold" />
              <th className="py-2 pr-3 font-semibold">Pohled žáka</th>
              <th className="py-2 pr-3 font-semibold">Hodnocení učitele</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([l, s, t, ok, note]) => (
              <tr key={l} className="align-top">
                <td className="py-2.5 pr-3 font-semibold">{l}</td>
                <td className="py-2.5 pr-3">{s}{note && <div className="mt-1 text-xs text-ink-soft">Poznámka žáka: „{note}“</div>}</td>
                <td className="py-2.5 pr-3">{t}</td>
                <td className="py-2.5 text-right"><Agree ok={ok} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-faint">Sebehodnocení je vlastní pohled žáka, ne objektivní hodnocení. Nepřevádí se na známku.</p>
    </div>
  )
}
