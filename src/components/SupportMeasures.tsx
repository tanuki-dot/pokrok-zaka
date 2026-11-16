import { useState } from 'react'
import { ExternalLink, FileText, Paperclip, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { addDocument, removeDocument, setStudentNoSupport, useDB } from '../lib/store'
import { MAX_FILE_MB, fileKind, fmtSize, openDoc } from '../lib/files'
import { docKindLabel, SUPPORT_ACCEPT, SUPPORT_KIND_LABEL, SUPPORT_KINDS } from '../lib/documents'
import type { DocKind } from '../lib/types'
import { Button, Card, cx, Input, Pill, Select } from './ui'
import { ConfirmDialog } from './ConfirmDialog'

/** Hodnota rozbalovacího pole navíc oproti druhům dokumentů. */
const NONE = 'zadne'

/**
 * Dokumentace a podpůrná opatření žáka (zadání bod 1): rozbalovací pole s druhem
 * opatření, nahrání PDF/Word (i více souborů) a volba „žák nemá podpůrná opatření".
 * Dokumenty jsou vázané na žáka a propojí se s formativním hodnocením (analysis.ts, ai.ts).
 *
 * `wrapped` = false → bez karty (vkládá se do „Základní údaje" v 1. kroku hodnocení).
 */
export function SupportMeasures({ studentId, wrapped = true }: { studentId: string; wrapped?: boolean }) {
  const db = useDB()
  const docs = db.documents.filter((d) => d.scope === 'zak' && d.studentId === studentId)
  const noSupport = !!db.students.find((s) => s.id === studentId)?.noSupport
  const [choice, setChoice] = useState<DocKind | typeof NONE>('plpp')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState<string | null>(null)
  const inputId = `podpora-${studentId}`

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length || choice === NONE) return
    setErr('')
    const tooBig = [...files].find((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig) { setErr(`Soubor „${tooBig.name}" je větší než ${MAX_FILE_MB} MB.`); return }
    if (choice === 'jine' && !title.trim()) { setErr('U druhu „Další dokument" zadejte vlastní název.'); return }
    setBusy(true)
    try {
      for (const f of files) await addDocument(studentId, choice, f, choice === 'jine' ? title : undefined)
      setTitle('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Dokument se nepodařilo uložit.')
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>
      <p className="mb-3 text-sm text-ink-soft">
        PLPP, IVP, doporučení PPP a SPC, zprávy ŠPZ a další podpůrná opatření pomáhají zohlednit individuální potřeby žáka.
        Aplikace je propojí s formativním hodnocením. Zatím jen fiktivní dokumenty.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-semibold text-ink-faint">
          Dokumentace a podpůrná opatření žáka
          <Select
            id={`${inputId}-druh`}
            value={choice}
            onChange={(e) => { setChoice(e.target.value as DocKind | typeof NONE); setErr('') }}
          >
            {SUPPORT_KINDS.map((k) => <option key={k} value={k}>{SUPPORT_KIND_LABEL[k]}</option>)}
            <option value={NONE}>Žák nemá evidovaná podpůrná opatření</option>
          </Select>
        </label>

        {choice === 'jine' && (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-ink-faint">
            Vlastní název dokumentu
            <Input id={`${inputId}-nazev`} value={title} placeholder="Např. Souhrnná zpráva výchovného poradce" onChange={(e) => setTitle(e.target.value)} />
          </label>
        )}
      </div>

      {choice === NONE ? (
        <div className="mt-3">
          {docs.length > 0 ? (
            <p className="rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">
              U žáka jsou nahrané podpůrné dokumenty. Nejdřív je odeberte, pak lze označit, že žák nemá podpůrná opatření.
            </p>
          ) : noSupport ? (
            <p className="inline-flex items-center gap-2 rounded-xl bg-good-wash px-3 py-2 text-sm text-good">
              <ShieldCheck size={16} /> Evidováno: žák nemá podpůrná opatření.
            </p>
          ) : (
            <Button onClick={() => setStudentNoSupport(studentId, true)}>
              <ShieldCheck size={16} /> Označit: žák nemá podpůrná opatření
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor={inputId}
              className={cx(
                'inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:border-sea-500 hover:text-sea-600',
                busy && 'pointer-events-none opacity-60',
              )}
            >
              <Upload size={16} className="text-sea-500" /> {busy ? 'Nahrávám…' : 'Nahrát dokument'}
            </label>
            <input
              id={inputId}
              type="file"
              accept={SUPPORT_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }}
            />
            <span className="text-xs text-ink-faint">PDF nebo Word, lze vybrat i více souborů, max. {MAX_FILE_MB} MB.</span>
          </div>
        </>
      )}

      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}

      {noSupport && docs.length === 0 && choice !== NONE && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-good-wash px-3 py-2 text-sm text-good">
          <ShieldCheck size={16} /> Evidováno: žák nemá podpůrná opatření.
          <button className="font-semibold underline hover:text-good/80" onClick={() => setStudentNoSupport(studentId, false)}>Zrušit</button>
        </p>
      )}

      {docs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
              <Pill tone="sea">{docKindLabel(d)}</Pill>
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
    </>
  )

  if (wrapped) return <Card title="Dokumentace a podpůrná opatření žáka">{body}</Card>

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <FileText size={16} className="text-sea-500" /> Dokumentace a podpůrná opatření žáka
      </div>
      {body}
    </div>
  )
}
