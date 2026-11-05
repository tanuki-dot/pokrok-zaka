import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'pokrok-zaka:motiv'
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

let pref: ThemePref = (() => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
})()
const ls = new Set<() => void>()

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && !!mq?.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
apply()
mq?.addEventListener('change', () => {
  if (pref === 'system') apply()
})

export function setTheme(next: ThemePref) {
  pref = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* jen pohodlí */
  }
  apply()
  ls.forEach((l) => l())
}

export function useTheme() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => pref,
  )
}
