import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Check, ClipboardPen, Copy, QrCode, Sparkles, Trash2 } from 'lucide-react'
import { criteriaFor, deleteAssessment, issueSelfCode, saveAssessment, type AssessmentDraft } from '../lib/store'
import { useCtx } from '../lib/useCtx'
import { setSelection } from '../lib/selection'
import { LEVELS, proposeSwot, studentAssessments } from '../lib/analysis'
import { fmt, today } from '../lib/dates'
import { fullName } from '../lib/util'
import type { Feedback, Level, Swot } from '../lib/types'
import { Button, Card, cx, Field, Input, LevelBadge, PageHeader, Pill, Select, Textarea } from '../components/ui'

const empty = (studentId: string, subjectId: string): AssessmentDraft => ({
  studentId,
  subjectId,
  date: today(),
  topic: '',
  goal: '',
  successCriterion: '',
  scores: {},
  feedback: { good: '', todo: '', next: '' },
  swot: { s: '', w: '', o: '', t: '', proposed: false },
  nextGoal: '',
})

function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="tabular grid h-7 w-7 place-items-center rounded-lg bg-sea-50 text-sm font-bold text-sea-700">{n}</span>
        <h2 className="text-[17px] font-bold">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </header>
      {children}
    </Card>
  )
}

export default function AssessmentForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { db, cls, subj, students } = useCtx()
  const existing = id ? db.assessments.find((a) => a.id === id) : undefined

  const loc = useLocation()
  const carry = (loc.state as { carry?: Partial<AssessmentDraft> } | null)?.carry
  const [draft, setDraft] = useState<AssessmentDraft>(() =>
    existing ? { ...existing } : { ...empty(params.get('zak') ?? students[0]?.id ?? '', subj?.id ?? ''), ...carry },
  )
  const [saved, setSaved] = useState<boolean>(!!(loc.state as { saved?: boolean } | null)?.saved)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2600)
    return () => clearTimeout(t)
  }, [saved])
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Při úpravě existujícího záznamu přepni horní výběr na jeho třídu a předmět.
  useEffect(() => {
    if (existing) {
      const st = db.students.find((s) => s.id === existing.studentId)
      if (st) setSelection({ classId: st.classId, subjectId: existing.subjectId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  // Nový záznam sleduje předmět vybraný nahoře.
  useEffect(() => {
    if (!existing && subj && draft.subjectId !== subj.id) {
      setDraft((d) => ({ ...d, subjectId: subj.id, scores: {}, studentId: students.some((s) => s.id === d.studentId) ? d.studentId : students[0]?.id ?? '' }))
    }
  }, [subj?.id, existing, draft.subjectId, students])

  const criteria = useMemo(() => criteriaFor(db, draft.subjectId), [db, draft.subjectId])
  const student = db.students.find((s) => s.id === draft.studentId)
  const history = student ? studentAssessments(db, student.id, draft.subjectId).filter((a) => a.id !== existing?.id) : []
  const lastOwn = history.at(-1)
  const lastInClass = db.assessments
    .filter((a) => a.subjectId === draft.subjectId && a.topic && a.id !== existing?.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const self = existing ? db.selfAssessments.find((s) => s.assessmentId === existing.id) : undefined
  const liveCode = existing ? db.assessments.find((a) => a.id === existing.id)?.selfCode : null

  const set = <K extends keyof AssessmentDraft>(k: K, v: AssessmentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setFb = (k: keyof Feedback, v: string) => setDraft((d) => ({ ...d, feedback: { ...d.feedback, [k]: v } }))
  const setSwot = (k: keyof Omit<Swot, 'proposed'>, v: string) => setDraft((d) => ({ ...d, swot: { ...d.swot, [k]: v, proposed: false } }))
  const setScore = (cid: string, l: Level) =>
    setDraft((d) => {
      const scores = { ...d.scores }
      if (scores[cid] === l) delete scores[cid]
      else scores[cid] = l
      return { ...d, scores }
    })

  const canSave = !!draft.studentId && !!draft.subjectId && Object.keys(draft.scores).length > 0

  function save(andNext: boolean) {
    const a = saveAssessment(draft)
    if (andNext) {
      const done = new Set(db.assessments.filter((x) => x.date === draft.date && x.subjectId === draft.subjectId).map((x) => x.studentId))
      done.add(draft.studentId)
      const idx = students.findIndex((s) => s.id === draft.studentId)
      const next = [...students.slice(idx + 1), ...students.slice(0, idx)].find((s) => !done.has(s.id))
      nav('/hodnoceni/nove' + (next ? `?zak=${next.id}` : ''), {
        state: {
          carry: { date: draft.date, topic: draft.topic, goal: draft.goal, successCriterion: draft.successCriterion },
          saved: true,
        },
      })
      window.scrollTo({ top: 0 })
    } else {
      nav(`/hodnoceni/${a.id}`, { replace: true, state: { saved: true } })
      setSaved(true)
    }
  }

  if (!subj || !cls) {
    return (
      <>
        <PageHeader title="Nové hodnocení" icon={<ClipboardPen size={28} />} />
        <Card>Nejdřív založte třídu a předmět v sekci <Link className="font-semibold text-sea-600" to="/tridy">Třídy a žáci</Link>.</Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={<ClipboardPen size={28} />}
        title={existing ? 'Úprava hodnocení' : 'Nové hodnocení'}
        subtitle={
          existing
            ? `Záznam z ${fmt(existing.date)} · naposledy upraveno ${new Date(existing.updatedAt).toLocaleString('cs-CZ')}`
            : 'Vyberu žáka → stanovím cíl → označím úroveň 1–5 → napíšu, co se povedlo a co dál → uložím.'
        }
        actions={
          existing && (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                Opravdu smazat záznam?
                <Button variant="danger" onClick={() => { deleteAssessment(existing.id); nav(`/zaci/${existing.studentId}`) }}>Smazat</Button>
                <Button onClick={() => setConfirmDelete(false)}>Ponechat</Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Smazat záznam</Button>
            )
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Step n={1} title="Vyberu žáka">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
              <Field label="Třída a předmět">
                <div className="flex h-[42px] items-center rounded-xl border border-line bg-canvas px-3 text-[15px]">{cls.name} · {subj.name}</div>
              </Field>
              <Field label="Žák">
                <Select id="zak" value={draft.studentId} onChange={(e) => set('studentId', e.target.value)} disabled={!!existing}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Datum">
                <Input id="datum" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
            </div>
          </Step>

          <Step
            n={2}
            title="Stanovím cíl učení"
            aside={
              !existing && lastInClass && (
                <Button
                  variant="ghost"
                  className="text-sea-600"
                  onClick={() => setDraft((d) => ({ ...d, topic: lastInClass.topic, goal: lastInClass.goal, successCriterion: lastInClass.successCriterion }))}
                >
                  Převzít z hodiny {fmt(lastInClass.date)}
                </Button>
              )
            }
          >
            <div className="grid gap-4">
              <Field label="Téma">
                <Input id="tema" value={draft.topic} placeholder="Např. Práce v Excelu" onChange={(e) => set('topic', e.target.value)} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cíl">
                  <Textarea id="cil" value={draft.goal} placeholder="Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX." onChange={(e) => set('goal', e.target.value)} />
                </Field>
                <Field label="Kritérium úspěchu">
                  <Textarea id="kriterium-uspechu" value={draft.successCriterion} placeholder="Samostatně vytvoří tabulku a správně vypočítá výsledky." onChange={(e) => set('successCriterion', e.target.value)} />
                </Field>
              </div>
            </div>
          </Step>

          <Step n={3} title="Ohodnotím konkrétní dovednosti" aside={<Pill tone="sea">{Object.keys(draft.scores).length} z {criteria.length} vybráno</Pill>}>
            <p className="mb-4 text-sm text-ink-soft">
              Klikněte na úroveň, která nejlépe vystihuje aktuální zvládnutí. Hodnoťte jen dovednosti, které jste v hodině sledovali; druhé kliknutí volbu zruší.
            </p>
            <ul className="flex flex-col divide-y divide-line">
              {criteria.map((c) => {
                const cur = draft.scores[c.id]
                const prev = lastOwn?.scores[c.id]
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-[180px] flex-1">
                      <div className="font-semibold">
                        {c.name} {c.subjectId && <Pill tone="brand" className="ml-1 align-middle">vlastní</Pill>}
                      </div>
                      <div className="text-sm text-ink-faint">{c.question}</div>
                      {cur && <div className="mt-1 text-sm" style={{ color: `var(--color-lv${cur})` }}>{LEVELS[cur - 1].text}</div>}
                    </div>
                    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={c.name}>
                      {LEVELS.map(({ level, text }) => (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={cur === level}
                          title={text}
                          onClick={() => setScore(c.id, level)}
                          className={cx(
                            'tabular h-10 w-10 rounded-xl border text-[15px] font-bold transition-all',
                            cur === level ? 'border-transparent text-white shadow-md' : 'border-line bg-surface text-ink-soft hover:border-ink-faint',
                          )}
                          style={cur === level ? { background: `var(--color-lv${level})` } : undefined}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <div className="w-20 text-right text-xs text-ink-faint">{prev ? <>minule <LevelBadge level={prev} size="sm" /></> : null}</div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">
              <strong>Důležité:</strong> čísla vyjadřují aktuální zvládnutí dovednosti (1 = nejvyšší). Nejde automaticky o školní známky.
            </p>
          </Step>

          <Step n={4} title="Napíšu krátkou zpětnou vazbu">
            <div className="grid gap-4">
              {(
                [
                  ['good', 'Co se povedlo?', 'Správně vytvořil tabulku a použil funkci SUMA.'],
                  ['todo', 'Co je potřeba procvičit?', 'Potřebuje pomoc s funkcí PRŮMĚR.'],
                  ['next', 'Co bude další krok?', 'Samostatně vypočítá průměr pěti čísel.'],
                ] as const
              ).map(([k, label, ph]) => (
                <Field key={k} label={label}>
                  <Textarea id={`fb-${k}`} value={draft.feedback[k]} placeholder={ph} onChange={(e) => setFb(k, e.target.value)} />
                  <div className="flex flex-wrap gap-1.5">
                    {db.phrases.filter((p) => p.kind === k).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFb(k, draft.feedback[k] ? `${draft.feedback[k].trim()} ${p.text}` : p.text)
                        }}
                        className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-soft hover:border-sea-500 hover:text-sea-700"
                      >
                        + {p.text}
                      </button>
                    ))}
                  </div>
                </Field>
              ))}
            </div>
          </Step>

          <Step n={5} title="Žák ohodnotí sám sebe">
            {!existing ? (
              <p className="text-sm text-ink-soft">Po uložení záznamu vytvoříte odkaz nebo QR kód. Žák na něm odpoví na pět otázek a odpovědi se připojí k tomuto hodnocení.</p>
            ) : self ? (
              <SelfCompare self={self} feedback={draft.feedback} />
            ) : (
              <SelfLink assessmentId={existing.id} code={liveCode ?? null} />
            )}
          </Step>

          <Step
            n={6}
            title="Doplním SWOT pohled"
            aside={
              <Button
                variant="ghost"
                className="text-sea-600"
                disabled={!Object.keys(draft.scores).length && !draft.feedback.good}
                onClick={() => setDraft((d) => ({ ...d, swot: proposeSwot(db, { ...d, id: existing?.id ?? '' }) }))}
              >
                <Sparkles size={16} /> Navrhnout z hodnocení
              </Button>
            }
          >
            {draft.swot.proposed && (
              <p className="mb-3 rounded-xl bg-sea-50 px-3 py-2 text-sm text-sea-700">
                Návrh vznikl jen z úrovní a zpětné vazby výše. Zkontrolujte ho a upravte. Překážky aplikace nevyplňuje – patří sem jen ověřené skutečnosti.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="S – Silné stránky" hint="Co žák umí a co mu jde.">
                <Textarea id="swot-s" value={draft.swot.s} onChange={(e) => setSwot('s', e.target.value)} />
              </Field>
              <Field label="W – Oblasti ke zlepšení" hint="Jaké dovednosti ještě rozvíjí.">
                <Textarea id="swot-w" value={draft.swot.w} onChange={(e) => setSwot('w', e.target.value)} />
              </Field>
              <Field label="O – Příležitosti" hint="Jaká podpora, úkoly nebo pomůcky mohou pomoci.">
                <Textarea id="swot-o" value={draft.swot.o} onChange={(e) => setSwot('o', e.target.value)} />
              </Field>
              <Field label="T – Překážky" hint="Jen ověřené skutečnosti. Nedomýšlejte osobní problémy žáka.">
                <Textarea id="swot-t" value={draft.swot.t} onChange={(e) => setSwot('t', e.target.value)} />
              </Field>
            </div>
          </Step>

          <Step n={7} title="Uložím záznam">
            <Field label="Další cíl do příštího období" hint="Uloží se mezi cíle žáka; jeho splnění pak označíte v detailu žáka.">
              <Input id="dalsi-cil" value={draft.nextGoal} placeholder={draft.feedback.next || 'Např. samostatně vypočítat průměr pěti čísel'} onChange={(e) => set('nextGoal', e.target.value)} />
            </Field>
            {!draft.nextGoal && draft.feedback.next && (
              <button className="mt-2 text-sm font-semibold text-sea-600" onClick={() => set('nextGoal', draft.feedback.next)}>
                Použít „další krok“ jako cíl
              </button>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="brand" disabled={!canSave} onClick={() => save(false)}><Check size={17} /> Uložit hodnocení</Button>
              {!existing && <Button disabled={!canSave} onClick={() => save(true)}>Uložit a další žák</Button>}
              {!canSave && <span className="text-sm text-ink-faint">Pro uložení označte aspoň jednu dovednost.</span>}
              {saved && <span role="status" className="text-sm font-semibold text-good">Uloženo{existing ? '' : ' – pokračujte dalším žákem'}.</span>}
            </div>
          </Step>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card title="Úrovně 1–5">
            <ul className="flex flex-col gap-2 text-sm">
              {LEVELS.map((l) => (
                <li key={l.level} className="flex items-start gap-2.5"><LevelBadge level={l.level} size="sm" /> <span className="pt-0.5">{l.text}</span></li>
              ))}
            </ul>
          </Card>
          {student && (
            <Card title={fullName(student)} action={<Link to={`/zaci/${student.id}`} className="text-sm font-semibold text-sea-600">Detail</Link>}>
              {lastOwn ? (
                <div className="flex flex-col gap-2 text-sm">
                  <div className="text-ink-faint">Minulý záznam · {fmt(lastOwn.date)}</div>
                  <div className="font-semibold">{lastOwn.topic}</div>
                  {lastOwn.feedback.next && <div><span className="text-ink-faint">Další krok:</span> {lastOwn.feedback.next}</div>}
                  {(() => {
                    const g = db.goals.filter((x) => x.studentId === student.id && x.subjectId === draft.subjectId && x.status === 'rozpracovany')
                    return g.length ? <div><span className="text-ink-faint">Rozpracované cíle:</span> {g.map((x) => x.text).join(' · ')}</div> : null
                  })()}
                </div>
              ) : (
                <p className="text-sm text-ink-faint">První záznam v tomto předmětu.</p>
              )}
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}

function SelfLink({ assessmentId, code }: { assessmentId: string; code: string | null }) {
  const [qr, setQr] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const url = code ? `${location.origin}${location.pathname}#/sebehodnoceni/${code}` : ''
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#16213a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [url])
  if (!code)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => issueSelfCode(assessmentId)}><QrCode size={17} /> Vytvořit odkaz pro žáka</Button>
        <span className="text-sm text-ink-soft">Jednorázový kód – po odevzdání přestane platit. Žák nepotřebuje účet.</span>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-5">
      {qr && <img src={qr} alt="QR kód pro sebehodnocení žáka" className="h-36 w-36 rounded-xl border border-line" />}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-sm text-ink-soft">Kód pro žáka</div>
        <div className="tabular font-display text-3xl font-bold tracking-[0.2em]">{code}</div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
            }}
          >
            <Copy size={15} /> {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
          </Button>
          <a href={url} target="_blank" rel="noreferrer"><Button variant="ghost">Otevřít jako žák</Button></a>
        </div>
        <p className="text-xs text-ink-faint">V demu se odpovědi ukládají v tomto prohlížeči – otevřete odkaz v nové kartě.</p>
      </div>
    </div>
  )
}

function SelfCompare({ self, feedback }: { self: { learned: string; wentWell: string; struggle: string; needHelp: string; nextWant: string; submittedAt: string }; feedback: Feedback }) {
  const rows: [string, string, string][] = [
    ['Co se povedlo', self.wentWell, feedback.good],
    ['Co ještě nejde', self.struggle, feedback.todo],
    ['Co dál', self.nextWant, feedback.next],
  ]
  return (
    <div>
      <div className="mb-3 text-sm text-ink-soft">Odevzdáno {new Date(self.submittedAt).toLocaleString('cs-CZ')}. Porovnejte odpovědi se svým hodnocením a společně se žákem stanovte další cíl.</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-3 font-semibold" />
              <th className="py-2 pr-3 font-semibold">Žák</th>
              <th className="py-2 font-semibold">Učitel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([l, s, t]) => (
              <tr key={l} className="align-top">
                <td className="py-2.5 pr-3 font-semibold">{l}</td>
                <td className="py-2.5 pr-3">{s || <span className="text-ink-faint">–</span>}</td>
                <td className="py-2.5">{t || <span className="text-ink-faint">–</span>}</td>
              </tr>
            ))}
            <tr className="align-top"><td className="py-2.5 pr-3 font-semibold">Co jsem se naučil/a</td><td className="py-2.5 pr-3" colSpan={2}>{self.learned || '–'}</td></tr>
            <tr className="align-top"><td className="py-2.5 pr-3 font-semibold">S čím potřebuji pomoc</td><td className="py-2.5 pr-3" colSpan={2}>{self.needHelp || '–'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
