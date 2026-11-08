/*
 * Úložiště souborů příloh v prohlížeči (IndexedDB). Popis přílohy (název, typ, velikost,
 * vlastník) je v hlavních datech (DB.attachments), samotný obsah tady.
 * V demu jsou soubory jen v tomto prohlížeči; pro ostrý provoz patří do zabezpečeného
 * úložiště na serveru (Supabase Storage).
 */

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

export const putFile = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const getFile = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
export const deleteFile = (id: string) => tx('readwrite', (s) => s.delete(id))

/** Otevře přílohu v nové kartě. */
export async function openFile(id: string) {
  const blob = await getFile(id)
  if (!blob) throw new Error('Soubor v tomto prohlížeči není.')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Stáhne přílohu pod původním názvem. */
export async function downloadFile(id: string, name: string) {
  const blob = await getFile(id)
  if (!blob) throw new Error('Soubor v tomto prohlížeči není.')
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
