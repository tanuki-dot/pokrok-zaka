import { useState } from 'react'
import { ExternalLink, Paperclip, Trash2, Upload } from 'lucide-react'
import { addSchoolDocument, removeDocument, useDB } from '../lib/store'
import { ACCEPT, MAX_FILE_MB, fileKind, fmtSize, openDoc } from '../lib/files'
import type { DocKind } from '../lib/types'
import { Card, Pill, Select } from './ui'
import { ConfirmDialog } from './ConfirmDialog'

const KIND_LABEL: Partial<Record<DocKind, string>> = {
  svp: 'ŠVP',
  plan: 'Tematický plán',
  jine: 'Jiné',
}
const KINDS: DocKind[] = ['svp', 'plan', 'jine']

/** Školní dokumenty (ŠVP, tematické plány) pro daný předmět. Na stránce „Dovednosti a věty". */
export function SchoolDocuments({ schoolId, subjectId }: { schoolId: string; subjectId: string }) {
  const db = useDB()
  const docs = db.documents.filter((d) => d.scope === 'skola' && d.schoolId === schoolId && d.subjectId === subjectId)
  const [kind, setKind] = useState<DocKind>('svp')
  const [err, setErr] = useState('')
  const [del, setDel] = useState<string | null>(null)
  const inputId = `skoladok-${subjectId}`

  const onFile = async (file?: File | null) => {
    if (!file) return
    setErr('')
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`Soubor „${file.name}“ je větší než ${MAX_FILE_MB} MB.`)
      return
    }
    try {
      await addSchoolDocument(schoolId, subjectId, kind, file)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Dokument se nepodařilo uložit.')
    }
  }

  return (
    <Card title="ŠVP a tematické plány" className="xl:col-span-2">
      <p className="mb-3 text-sm text-ink-soft">Nahrajte ŠVP a tematické plány k tomuto předmětu (PDF nebo Word). Později z nich bude AI navrhovat vzdělávací cíle a dovednosti. Zatím jen fiktivní dokumenty.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Druh dokumentu
          <Select value={kind} onChange={(e) => setKind(e.target.value as DocKind)} className="w-auto">
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
        </label>
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:border-sea-500 hover:text-sea-600"
        >
          <Upload size={16} className="text-sea-500" /> Nahrát dokument
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-faint">PDF, Word nebo jiný dokument, max. {MAX_FILE_MB} MB.</p>
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}

      {docs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
              <Pill tone="sea">{KIND_LABEL[d.kind] ?? 'Jiné'}</Pill>
              <Paperclip size={16} className="shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{d.name}</div>
                <div className="text-xs text-ink-faint">{fileKind(d.mime, d.name)} · {fmtSize(d.size)} · {new Date(d.addedAt).toLocaleDateString('cs-CZ')}</div>
              </div>
              <button className="rounded-lg p-2 text-ink-soft hover:bg-sea-50 hover:text-sea-700" aria-label={`Otevřít ${d.name}`} onClick={() => openDoc(d).catch((e) => setErr(e.message))}>
                <ExternalLink size={16} />
              </button>
              <button className="rounded-lg p-2 text-ink-soft hover:bg-bad-wash hover:text-bad" aria-label={`Smazat ${d.name}`} onClick={() => setDel(d.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!del}
        title="Smazat dokument?"
        message="Dokument se odstraní i z úložiště. Akci nelze vrátit."
        confirmLabel="Smazat"
        cancelLabel="Zrušit"
        tone="danger"
        onConfirm={() => { if (del) void removeDocument(del); setDel(null) }}
        onCancel={() => setDel(null)}
      />
    </Card>
  )
}
