import { useEffect, useState } from 'react'
import { Download, ExternalLink, Paperclip, Trash2, Upload } from 'lucide-react'
import { addAttachment, removeAttachment } from '../lib/store'
import { ACCEPT, downloadFile, fileKind, fmtSize, getFile, MAX_FILE_MB, openFile } from '../lib/files'
import type { Attachment } from '../lib/types'
import { cx, Pill } from './ui'

/** Náhled obrázkové přílohy (#8). U neobrázků spona. */
export function Thumb({ file, size = 44 }: { file: Attachment; size?: number }) {
  const [url, setUrl] = useState('')
  const isImage = file.type.startsWith('image/')
  useEffect(() => {
    if (!isImage) return
    let u = ''
    let alive = true
    getFile(file).then((b) => {
      if (!b || !alive) return
      u = URL.createObjectURL(b)
      setUrl(u)
    }).catch(() => {})
    return () => { alive = false; if (u) URL.revokeObjectURL(u) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id])
  if (isImage && url)
    return <img src={url} alt={file.name} className="shrink-0 rounded-lg border border-line object-cover" style={{ width: size, height: size }} />
  return (
    <span className="grid shrink-0 place-items-center rounded-lg border border-line bg-canvas text-ink-faint" style={{ width: size, height: size }}>
      <Paperclip size={size > 36 ? 18 : 16} />
    </span>
  )
}

/** Nahrání a seznam příloh jednoho hodnocení. owner určuje, kdo přílohu přidává. */
export function AttachmentUpload({ assessmentId, owner, label, onUpload }: {
  assessmentId: string
  owner: Attachment['owner']
  label: string
  /** Vlastní nahrání (žák na serveru nahrává přes kód, ne přes účet). */
  onUpload?: (f: File) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputId = `prilohy-${owner}-${assessmentId}`
  return (
    <div>
      <label
        htmlFor={inputId}
        className={cx(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft hover:border-sea-500',
          busy && 'opacity-60',
        )}
      >
        <Upload size={20} className="text-sea-500" />
        <span><strong className="text-ink">{label}</strong></span>
        <span className="text-xs text-ink-faint">Fotografie, pracovní list, PDF, dokument, prezentace · max. {MAX_FILE_MB} MB</span>
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          setErr('')
          setBusy(true)
          for (const f of files) {
            if (f.size > MAX_FILE_MB * 1024 * 1024) {
              setErr(`Soubor „${f.name}“ je větší než ${MAX_FILE_MB} MB.`)
              continue
            }
            try {
              await (onUpload ? onUpload(f) : addAttachment(assessmentId, owner, f))
            } catch (e) {
              setErr(onUpload && e instanceof Error ? `„${f.name}“: ${e.message}` : `Soubor „${f.name}“ se nepodařilo uložit.`)
            }
          }
          setBusy(false)
        }}
      />
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
    </div>
  )
}

export function AttachmentList({
  items, canDelete, selectable, selected, onToggle, empty = 'Zatím bez příloh.',
}: {
  items: Attachment[]
  canDelete?: boolean
  selectable?: boolean
  selected?: string[]
  onToggle?: (id: string) => void
  empty?: string
}) {
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState('')
  if (!items.length) return <p className="text-sm text-ink-faint">{empty}</p>
  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
            {selectable && (
              <input
                id={`zahrnout-${f.id}`}
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-sea-500)]"
                checked={!!selected?.includes(f.id)}
                onChange={() => onToggle?.(f.id)}
                aria-label={`Zahrnout ${f.name} do zprávy`}
              />
            )}
            <Thumb file={f} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{f.name}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                <Pill tone={f.owner === 'zak' ? 'brand' : 'sea'}>{f.owner === 'zak' ? 'žák' : 'učitel'}</Pill>
                {fileKind(f.type, f.name)} · {fmtSize(f.size)} · {new Date(f.addedAt).toLocaleDateString('cs-CZ')}
              </div>
              {f.note && <div className="mt-0.5 text-xs text-ink-soft">„{f.note}“</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button className="rounded-lg p-2 text-ink-soft hover:bg-sea-50 hover:text-sea-700" aria-label={`Otevřít ${f.name}`} onClick={() => openFile(f).catch((e) => setErr(e.message))}>
                <ExternalLink size={16} />
              </button>
              <button className="rounded-lg p-2 text-ink-soft hover:bg-sea-50 hover:text-sea-700" aria-label={`Stáhnout ${f.name}`} onClick={() => downloadFile(f, f.name).catch((e) => setErr(e.message))}>
                <Download size={16} />
              </button>
              {canDelete &&
                (confirm === f.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    <button className="font-semibold text-bad" onClick={() => { void removeAttachment(f.id); setConfirm('') }}>smazat</button>
                    <button className="text-ink-faint" onClick={() => setConfirm('')}>zpět</button>
                  </span>
                ) : (
                  <button className="rounded-lg p-2 text-ink-soft hover:bg-bad-wash hover:text-bad" aria-label={`Odstranit ${f.name}`} onClick={() => setConfirm(f.id)}>
                    <Trash2 size={16} />
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
    </>
  )
}
