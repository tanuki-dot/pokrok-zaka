import { useSyncExternalStore } from 'react'

/*
 * Informace o soukromí (jednou, s tlačítkem „Rozumím“).
 * Aplikace nepoužívá cookies ani služby třetích stran – písma jsou přibalená.
 * Nezbytná data (demo data, výběr třídy, vzhled, tato informace) ukládá jen do
 * localStorage v prohlížeči. Na nezbytné ukládání se souhlas nevyžaduje.
 * Až přibude něco volitelného (např. analytika), je potřeba vrátit volbu Přijmout / Odmítnout.
 */

export const PRIVACY_KEY = 'pokrok-zaka:soukromi'

let state: { open: boolean } = (() => {
  try {
    return { open: localStorage.getItem(PRIVACY_KEY) !== 'videno' }
  } catch {
    return { open: true }
  }
})()
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())

export function acknowledgePrivacy() {
  state = { open: false }
  try {
    localStorage.setItem(PRIVACY_KEY, 'videno')
  } catch {
    /* informace se ukáže znovu při další návštěvě */
  }
  emit()
}

export function openPrivacy() {
  state = { open: true }
  emit()
}

export function usePrivacy() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => state,
  )
}
