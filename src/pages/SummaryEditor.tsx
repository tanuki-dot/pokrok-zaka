import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, History, Pencil, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react'
import { approveSummary, deleteSummary, saveSummary, uid, useDB } from '../lib/store'
import { generateSummary } from '../lib/analysis'
import { fmt, fmtShort, KIND_LABEL } from '../lib/dates'
import type { DB, Summary, SummarySection } from '../lib/types'
import { Button, Card, Empty, PageHeader, Pill, Textarea } from '../components/ui'

/** Popisek zdroje věty: datum a téma hodnocení, cíl nebo sebehodnocení. */
function sourceLabel(db: DB, id: string): { label: string; to?: string } {
  const a = db.assessments.find((x) => x.id === id)
  if (a) return { label: `${fmtShort(a.date)} ${a.topic}`.trim(), to: `/hodnoceni/${a.id}` }
  const g = db.goals.find((x) => x.id === id)
  if (g) return { label: `cíl ${fmtShort(g.setOn)}`, to: g.assessmentId ? `/hodnoceni/${g.assessmentId}` : undefined }
  const s = db.selfAssessments.find((x) => x.id === id)
  if (s) return { label: 'sebehodnocení', to: `/hodnoceni/${s.assessmentId}` }
  return { label: 'záznam už neexistuje' }
}

export default function SummaryEditor() {
  const { id } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const sum = db.summaries.find((s) => s.id === id)
  const [draft, setDraft] = useState<Summary | null>(sum ? structuredClone(sum) : null)
  const [confirm, setConfirm] = useState<'' | 'regen' | 'delete'>('')
  const [note, setNote] = useState('')

  if (!sum || !draft) return <Empty title="Souhrn nenalezen" />
  const st = db.students.find((s) => s.id === sum.studentId)
  const subj = db.subjects.find((s) => s.id === sum.subjectId)
  const locked = draft.status === 'schvaleno'
  const dirty = JSON.stringify(draft) !== JSON.stringify(sum)

  const updateSection = (key: string, fn: (s: SummarySection) => SummarySection) =>
    setDraft((d) => d && { ...d, sections: d.sections.map((s) => (s.key === key ? fn(s) : s)) })

  function flash(t: string) {
    setNote(t)
    setTimeout(() => setNote(''), 2600)
  }

  function save() {
    saveSummary(draft!, false)
    flash('Změny uloženy.')
  }

  function approve() {
    saveSummary(draft!, false)
    approveSummary(draft!.id)
    setDraft((d) => d && { ...d, status: 'schvaleno', approvedAt: new Date().toISOString() })
    flash('Schváleno. Souhrn je připravený k tisku.')
  }

  function newVersion() {
    const next: Summary = {
      ...draft!,
      history: [...(draft!.history ?? []), { version: draft!.version, sections: draft!.sections, teacherNote: draft!.teacherNote, approvedAt: draft!.approvedAt }],
      version: draft!.version + 1,
      status: 'navrh',
      approvedAt: null,
    }
    saveSummary(next, false)
    setDraft(structuredClone(next))
  }

  function regenerate() {
    setDraft((d) => d && { ...d, sections: generateSummary(db, d.studentId, d.subjectId, d.kind, d.from, d.to) })
    setConfirm('')
    flash('Návrh znovu sestaven z aktuálních záznamů. Uložte, pokud ho chcete ponechat.')
  }

  return (
    <>
      <Link to="/souhrny" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft size={15} /> Souhrny</Link>
      <PageHeader
        title={`${KIND_LABEL[sum.kind]} souhrn – ${st ? `${st.firstName} ${st.lastName}` : ''}`}
        subtitle={`${subj?.name} · ${fmt(sum.from)} – ${fmt(sum.to)} · verze ${draft.version}`}
        actions={
          <>
            <Pill tone={locked ? 'good' : 'warn'} className="px-3 py-1 text-sm">{locked ? `schváleno ${draft.approvedAt ? fmt(draft.approvedAt.slice(0, 10)) : ''}` : 'návrh – čeká na kontrolu'}</Pill>
            {locked ? (
              <>
                <Button onClick={newVersion}><Pencil size={16} /> Upravit (nová verze)</Button>
                <a href={`#/tisk/${sum.id}`} target="_blank" rel="noreferrer"><Button variant="primary"><Printer size={16} /> Tisk / PDF</Button></a>
              </>
            ) : (
              <>
                <Button disabled={!dirty} onClick={save}>Uložit změny</Button>
                <Button variant="brand" onClick={approve}><Check size={17} /> Schválit</Button>
              </>
            )}
          </>
        }
      />
      {note && <p role="status" className="mb-4 rounded-xl bg-good-wash px-4 py-2.5 text-sm font-semibold text-good">{note}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {!locked && (
            <p className="rounded-xl border border-sea-100 bg-sea-50 px-4 py-3 text-sm text-sea-700">
              Návrh vznikl jen z uložených záznamů. U každé věty vidíte, ze kterého záznamu pochází. Věty upravte, smažte nebo doplňte vlastní, pak souhrn schvalte. Tisknout jde jen schválená verze.
            </p>
          )}
          {draft.sections.map((sec) => (
            <Card key={sec.key} title={sec.title}>
              <ul className="flex flex-col gap-3">
                {sec.sentences.map((s) => (
                  <li key={s.id} className="group">
                    {locked ? (
                      <p className="text-[15px] leading-relaxed">{s.text}</p>
                    ) : (
                      <div className="flex items-start gap-2">
                        <Textarea
                          id={`veta-${s.id}`}
                          aria-label={`Věta v sekci ${sec.title}`}
                          value={s.text}
                          rows={Math.max(1, Math.ceil(s.text.length / 90))}
                          onChange={(e) => updateSection(sec.key, (x) => ({ ...x, sentences: x.sentences.map((y) => (y.id === s.id ? { ...y, text: e.target.value } : y)) }))}
                        />
                        <button
                          className="mt-2 rounded-lg p-1.5 text-ink-faint hover:bg-bad-wash hover:text-bad"
                          aria-label="Odstranit větu"
                          onClick={() => updateSection(sec.key, (x) => ({ ...x, sentences: x.sentences.filter((y) => y.id !== s.id) }))}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.sources.length === 0 ? (
                        <span className="text-xs text-ink-faint">doplněno učitelem</span>
                      ) : (
                        s.sources.slice(0, 6).map((src) => {
                          const l = sourceLabel(db, src)
                          return l.to ? (
                            <Link key={src} to={l.to} className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] text-ink-faint hover:text-sea-600">↳ {l.label}</Link>
                          ) : (
                            <span key={src} className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] text-ink-faint">↳ {l.label}</span>
                          )
                        })
                      )}
                      {s.sources.length > 6 && <span className="text-[11px] text-ink-faint">+{s.sources.length - 6}</span>}
                    </div>
                  </li>
                ))}
              </ul>
              {!locked && (
                <button
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sea-600"
                  onClick={() => updateSection(sec.key, (x) => ({ ...x, sentences: [...x.sentences, { id: uid('v'), text: '', sources: [] }] }))}
                >
                  <Plus size={15} /> Přidat větu
                </button>
              )}
            </Card>
          ))}
          <Card title="Komentář učitele">
            {locked ? (
              <p className="text-[15px] leading-relaxed">{draft.teacherNote || <span className="text-ink-faint">Bez komentáře.</span>}</p>
            ) : (
              <Textarea id="komentar" rows={3} value={draft.teacherNote} placeholder="Doplňte vlastní komentář (nepovinné)." onChange={(e) => setDraft((d) => d && { ...d, teacherNote: e.target.value })} />
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card title="Jak souhrn vzniká">
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-ink-soft">
              <li>Aplikace vezme záznamy žáka za období.</li>
              <li>Z úrovní, zpětné vazby, cílů a sebehodnocení složí věty.</li>
              <li>Učitel věty zkontroluje, upraví a schválí.</li>
              <li>Vytisknout nebo uložit do PDF jde jen schválená verze.</li>
            </ol>
            <p className="mt-3 text-xs text-ink-faint">Aplikace nic nedomýšlí. Osobní okolnosti žáka do souhrnu patří jen tehdy, když je doplní učitel.</p>
          </Card>
          {!locked && (
            <Card>
              {confirm === 'regen' ? (
                <div className="flex flex-col gap-2 text-sm">
                  Vaše úpravy vět se přepíšou. Pokračovat?
                  <div className="flex gap-2"><Button variant="primary" onClick={regenerate}>Ano, sestavit znovu</Button><Button onClick={() => setConfirm('')}>Zpět</Button></div>
                </div>
              ) : confirm === 'delete' ? (
                <div className="flex flex-col gap-2 text-sm">
                  Smazat tento souhrn?
                  <div className="flex gap-2"><Button variant="danger" onClick={() => { deleteSummary(sum.id); nav('/souhrny') }}>Smazat</Button><Button onClick={() => setConfirm('')}>Zpět</Button></div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setConfirm('regen')}><RefreshCw size={16} /> Znovu sestavit z dat</Button>
                  <Button variant="danger" onClick={() => setConfirm('delete')}><Trash2 size={16} /> Smazat souhrn</Button>
                </div>
              )}
            </Card>
          )}
          {(draft.history?.length ?? 0) > 0 && (
            <Card title={<span className="inline-flex items-center gap-2"><History size={17} /> Předchozí verze</span>}>
              <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                {draft.history!.map((h) => (
                  <li key={h.version}>verze {h.version} · schváleno {h.approvedAt ? fmt(h.approvedAt.slice(0, 10)) : '–'}</li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
