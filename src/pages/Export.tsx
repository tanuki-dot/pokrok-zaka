import { useState } from 'react'
import { Database, Download, FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { useCtx } from '../lib/useCtx'
import { replaceDB } from '../lib/store'
import { buildSheets, download, exportCsv, exportXlsx } from '../lib/exporter'
import { today } from '../lib/dates'
import type { DB } from '../lib/types'
import { Button, Card, Field, PageHeader, Select } from '../components/ui'

export default function ExportPage() {
  const { db, cls, subj } = useCtx()
  const [scope, setScope] = useState<'predmet' | 'vse'>('predmet')
  const [msg, setMsg] = useState('')
  const sid = scope === 'vse' || !subj ? 'vse' : subj.id
  const counts = buildSheets(db, sid)
  const base = scope === 'vse' ? `pokrok-zaka-vse-${today()}` : `pokrok-zaka-${cls?.name}-${subj?.name}-${today()}`.replace(/\s+/g, '-').toLowerCase()

  return (
    <>
      <PageHeader icon={<Download size={28} />} title="Export dat" subtitle="Stáhněte záznamy pro další zpracování nebo archivaci. Tisk slovního hodnocení najdete u schváleného souhrnu." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Záznamy hodnocení">
          <Field label="Rozsah">
            <Select id="export-rozsah" value={scope} onChange={(e) => setScope(e.target.value as 'predmet' | 'vse')}>
              <option value="predmet">{cls?.name} · {subj?.name}</option>
              <option value="vse">Všechny třídy a předměty</option>
            </Select>
          </Field>
          <p className="mt-3 text-sm text-ink-soft">
            {counts.hodnoceni.length} hodnocení · {counts.cile.length} cílů · {counts.souhrny.length} schválených souhrnů
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => exportXlsx(db, sid, `${base}.xlsx`)}><FileSpreadsheet size={16} /> Excel (.xlsx)</Button>
            <Button onClick={() => exportCsv(db, sid, `${base}.csv`)}><FileText size={16} /> CSV</Button>
          </div>
          <p className="mt-3 text-xs text-ink-faint">Excel obsahuje listy Hodnocení, Cíle a Schválené souhrny. CSV obsahuje jen hodnocení (oddělovač středník, kódování UTF-8).</p>
        </Card>

        <Card title="Záloha celé aplikace">
          <p className="text-sm text-ink-soft">V demu jsou data jen v tomto prohlížeči. Zálohou je přenesete jinam nebo obnovíte.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => download(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }), `pokrok-zaka-zaloha-${today()}.json`)}>
              <Database size={16} /> Stáhnout zálohu (.json)
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold hover:border-sea-500 hover:text-sea-600">
              <Upload size={16} /> Obnovit ze zálohy
              <input
                id="obnovit-zalohu"
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    replaceDB(JSON.parse(await f.text()) as DB)
                    setMsg('Záloha obnovena.')
                  } catch {
                    setMsg('Soubor není platná záloha aplikace.')
                  }
                }}
              />
            </label>
          </div>
          {msg && <p role="status" className="mt-3 text-sm font-semibold">{msg}</p>}
        </Card>
      </div>
    </>
  )
}
