/*
 * Úložiště souborů příloh v prohlížeči (IndexedDB). Popis přílohy (název, typ, velikost,
 * vlastník) je v hlavních datech (DB.attachments), samotný obsah tady.
 * S nastaveným serverem se soubory ukládají do Supabase Storage (bucket „prilohy“),
 * v demu jen v tomto prohlížeči.
 */

import type { Attachment, Document } from './types'
import {
  downloadDoc as remoteDownloadDoc, downloadFile as remoteDownload, remoteEnabled, removeDoc as remoteRemoveDoc,
  removeFile as remoteRemove, uploadDoc as remoteUploadDoc, uploadFile as remoteUpload,
} from './remote'

const DB_NAME = 'pokrok-zaka-prilohy'
const STORE = 'soubory'

export const MAX_FILE_MB = 10
export const ACCEPT =
  'image/*,application/pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.ppt,.pptx,.odp'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

type Ref = Pick<Attachment, 'id' | 'assessmentId'>

/** Uloží soubor přílohy – na server (Supabase Storage), nebo v demu do prohlížeče. */
export const putFile = async (att: Ref, blob: Blob) =>
  remoteEnabled ? remoteUpload(att.assessmentId, att.id, blob) : void (await tx('readwrite', (s) => s.put(blob, att.id)))
export const getFile = (att: Ref): Promise<Blob | undefined> =>
  remoteEnabled ? remoteDownload(att.assessmentId, att.id) : tx<Blob | undefined>('readonly', (s) => s.get(att.id) as IDBRequest<Blob | undefined>)
export const deleteFile = async (att: Ref) => (remoteEnabled ? remoteRemove(att.assessmentId, att.id) : void (await tx('readwrite', (s) => s.delete(att.id))))

// ─── Podpůrné dokumenty žáka (stejné úložiště, klíč = id, cesta = <student_id>/<id>) ──
type DocRef = Pick<Document, 'id' | 'studentId'>

export const putDoc = async (doc: DocRef, blob: Blob) =>
  remoteEnabled ? remoteUploadDoc(doc.studentId, doc.id, blob) : void (await tx('readwrite', (s) => s.put(blob, doc.id)))
export const getDoc = (doc: DocRef): Promise<Blob | undefined> =>
  remoteEnabled ? remoteDownloadDoc(doc.studentId, doc.id) : tx<Blob | undefined>('readonly', (s) => s.get(doc.id) as IDBRequest<Blob | undefined>)
export const deleteDoc = async (doc: DocRef) => (remoteEnabled ? remoteRemoveDoc(doc.studentId, doc.id) : void (await tx('readwrite', (s) => s.delete(doc.id))))

export async function openDoc(doc: DocRef) {
  const blob = await getDoc(doc)
  if (!blob) throw new Error(remoteEnabled ? 'Dokument se nepodařilo načíst ze serveru.' : 'Dokument v tomto prohlížeči není.')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadDocFile(doc: DocRef, name: string) {
  const blob = await getDoc(doc)
  if (!blob) throw new Error(remoteEnabled ? 'Dokument se nepodařilo načíst ze serveru.' : 'Dokument v tomto prohlížeči není.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Otevře přílohu v nové kartě. */
export async function openFile(att: Ref) {
  const blob = await getFile(att)
  if (!blob) throw new Error(remoteEnabled ? 'Soubor se nepodařilo načíst ze serveru.' : 'Soubor v tomto prohlížeči není.')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Stáhne přílohu pod původním názvem. */
export async function downloadFile(att: Ref, name: string) {
  const blob = await getFile(att)
  if (!blob) throw new Error(remoteEnabled ? 'Soubor se nepodařilo načíst ze serveru.' : 'Soubor v tomto prohlížeči není.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileKind = (type: string, name: string) => {
  if (type.startsWith('image/')) return 'Fotografie'
  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (/\.(pptx?|odp)$/i.test(name)) return 'Prezentace'
  if (/\.(xlsx?|ods)$/i.test(name)) return 'Tabulka'
  return 'Dokument'
}

export const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
