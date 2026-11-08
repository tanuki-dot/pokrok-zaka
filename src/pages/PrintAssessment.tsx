import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useDB } from '../lib/store'
import { criterionSeries, GOAL_STATUS_LABEL, studentAssessments } from '../lib/analysis'
import { levelLabel } from '../lib/levels'
import { describeSelf } from '../lib/questionnaire'
import { periodLabel } from '../lib/periods'
import { fileKind, getFile } from '../lib/files'
import { allCriteriaFor, fullName } from '../lib/util'
import { fmt } from '../lib/dates'
import { Button, cx } from '../components/ui'
import { ProgressChart } from '../components/ProgressChart'
import { DEV_FIELDS } from './eval/StepReport'

/** Tisková zpráva jednoho hodnocení pro žáka a rodiče (Tisk → Uložit jako PDF). */
export default function PrintAssessment() {
  const { id } = useParams()
  const db = useDB()
  const a = db.assessments.find((x) => x.id === id)
  const [charts, setCharts] = useState(false)
  const [withFiles, setWithFiles] = useState(true)
  const [images, setImages] = useState<Record<string, string>>({})

  const chosen = a ? db.attachments.filter((x) => a.report?.attachments.includes(x.id)) : []
  useEffect(() => {
    const urls: string[] = []
    let alive = true
    Promise.all(
      chosen.filter((f) => f.type.startsWith('image/')).map(async (f) => {
        const b = await getFile(f.id).catch(() => undefined)
        if (!b) return null
        const u = URL.createObjectURL(b)
        urls.push(u)
        return [f.id, u] as const
      }),
    ).then((pairs) => alive && setImages(Object.fromEntries(pairs.filter(Boolean) as [string, string][])))
    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, chosen.map((c) => c.id).join()])

  if (!a) return <p className="p-10">Hodnocení nenalezeno.</p>
  const st = db.students.find((s) => s.id === a.studentId)
  const subj = db.subjects.find((s) => s.id === a.subjectId)
  const cls = db.classes.find((c) => c.id === st?.classId)
  const school = db.schools.find((s) => s.id === cls?.schoolId)
  const self = db.selfAssessments.find((s) => s.assessmentId === a.id)
  const units = a.units.map((u) => db.units.find((x) => x.id === u)?.name).filter(Boolean) as string[]
  const crits = allCriteriaFor(db, a.subjectId)
  const history = studentAssessments(db, a.studentId, a.subjectId).filter((x) => x.date <= a.date)

  return (
    <div className="min-h-full bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-3 px-4">
        <label className="flex items-center gap-2 text-sm"><input id="tisk-grafy" type="checkbox" className="h-4 w-4" checked={charts} onChange={(e) => setCharts(e.target.checked)} /> Zahrnout grafy</label>
        <label className="flex items-center gap-2 text-sm"><input id="tisk-prilohy" type="checkbox" className="h-4 w-4" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} /> Zahrnout vybrané přílohy ({chosen.length})</label>
        <Button variant="primary" className="ml-auto" onClick={() => window.print()}><Printer size={16} /> Tisk / uložit jako PDF</Button>
      </div>
      {!a.report?.approved && (
        <p className="no-print mx-auto mb-4 max-w-[820px] rounded-xl bg-warn-wash px-4 py-2 text-sm text-warn">Formativní hodnocení zatím není schválené – tisk je jen náhled.</p>
      )}
      <article className="print-sheet mx-auto max-w-[820px] rounded-2xl border border-line bg-surface px-10 py-10 shadow-sm">
        <header className="border-b-2 border-ink pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{school?.name} · Formativní hodnocení</div>
          <h1 className="mt-2 text-[28px] font-bold">{st ? fullName(st) : ''}</h1>
          <div className="mt-1 text-[15px] text-ink-soft">
            Třída {cls?.name} · {subj?.name} · {periodLabel(a.periodType, a.periodFrom, a.periodTo)} · {fmt(a.date)}
          </div>
        </header>

        <section className="mt-5 grid gap-1 text-sm">
          {(units.length > 0 || a.topic) && <div><strong>Tematické celky:</strong> {[...units, a.topic].filter(Boolean).join(' · ')}</div>}
          {a.goals.length > 0 && (
            <div>
              <strong>Vzdělávací cíle:</strong>
              <ul className="mt-1 list-disc pl-5">
                {a.goals.map((g) => <li key={g.id}>{g.text} – <em>{g.status ? GOAL_STATUS_LABEL[g.status].toLowerCase() : 'splnění neoznačeno'}</em></li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-2 text-[17px] font-bold">Hodnocení dovedností</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(a.scores).map(([cid, l]) => (
              <li key={cid}><strong>{crits.find((c) => c.id === cid)?.name}:</strong> {levelLabel(l)}{a.skillNotes[cid] ? ` – ${a.skillNotes[cid]}` : ''}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-faint">Škála 1 = výborně … 5 = zatím nezvládá. Nehodnocené dovednosti nejsou uvedeny. Nejde o známky.</p>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold">Slovní formativní hodnocení</h2>
          <div className="whitespace-pre-line text-[15px] leading-relaxed">{a.report?.text || 'Hodnocení zatím není vytvořené.'}</div>
        </section>

        {self?.answers && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="mb-2 text-[17px] font-bold">Pohled žáka na vlastní pokrok</h2>
            {(() => {
              const d = describeSelf(self)
              return (
                <ul className="list-disc pl-5 text-sm">
                  <li>{d.understanding}</li>
                  <li>{d.work}</li>
                  <li>Splnění cílů: {d.goalMet.toLowerCase()}</li>
                  {d.nextWish && <li>„{d.nextWish}“</li>}
                </ul>
              )
            })()}
            <p className="mt-1 text-xs text-ink-faint">Vlastní (subjektivní) pohled žáka, nejde o hodnocení učitele.</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-bold">Individuální rozvoj žáka</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEV_FIELDS.map((f) => (
              <div key={f.key} className={cx('break-inside-avoid rounded-xl border p-3', f.box)}>
                <div className={cx('mb-1 font-bold', f.tone)}>{f.title}</div>
                <div className="whitespace-pre-line text-sm">{a.swot[f.key] || '–'}</div>
              </div>
            ))}
          </div>
        </section>

        {charts && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold">Vývoj hodnocených dovedností</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.keys(a.scores).map((cid) => (
                <div key={cid} className="break-inside-avoid">
                  <div className="text-sm font-semibold">{crits.find((c) => c.id === cid)?.name}</div>
                  <ProgressChart points={criterionSeries(history, cid)} height={150} />
                </div>
              ))}
            </div>
          </section>
        )}

        {withFiles && chosen.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[17px] font-bold">Přílohy</h2>
            <ul className="text-sm">
              {chosen.map((f) => (
                <li key={f.id} className="mb-3 break-inside-avoid">
                  <div>{fileKind(f.type, f.name)}: {f.name} ({f.owner === 'zak' ? 'práce žáka' : 'dokument učitele'})</div>
                  {images[f.id] && <img src={images[f.id]} alt={f.name} className="mt-1 max-h-72 rounded-lg border border-line" />}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-10 border-t border-line pt-6 text-sm text-ink-soft">
          <div>Vyučující: {db.settings.teacherName}<br />{a.report?.approved ? `Schváleno ${fmt(a.report.approvedAt!.slice(0, 10))}` : 'Neschválený návrh'}</div>
          <div className="text-right"><div className="mt-8 border-t border-ink-faint pt-1">podpis</div></div>
        </footer>
      </article>
    </div>
  )
}
