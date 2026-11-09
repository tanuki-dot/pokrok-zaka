import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'

/*
 * Automatické odhlášení po nečinnosti.
 * - Dobu si nastavuje učitel i vedení (ukládá se v tomto prohlížeči).
 * - Po vypršení se učitel odhlásí – bez hesla se už dovnitř nedostane,
 *   a to i po zavření/obnovení karty (kontroluje se čas poslední aktivity).
 */

const MIN_KEY = 'pokrok-zaka:odhlaseni-min'
const ACT_KEY = 'pokrok-zaka:aktivita'
const FLAG_KEY = 'pokrok-zaka:odhlaseno-necinnost'

export const LOGOUT_OPTIONS = [5, 10, 15, 30, 60] as const
const DEFAULT_MIN = 10

function read(): number {
  try {
    const v = Number(localStorage.getItem(MIN_KEY))
    return (LOGOUT_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT_MIN
  } catch {
    return DEFAULT_MIN
  }
}

let minutes = read()
const subs = new Set<() => void>()

export function getIdleMinutes() {
  return minutes
}
export function setIdleMinutes(n: number) {
  minutes = n
  try {
    localStorage.setItem(MIN_KEY, String(n))
  } catch {
    /* jen pohodlí */
  }
  subs.forEach((l) => l())
}
export function useIdleMinutes() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => subs.delete(l)
    },
    () => minutes,
  )
}

function persistActivity(ts: number) {
  try {
    localStorage.setItem(ACT_KEY, String(ts))
  } catch {
    /* ignore */
  }
}
/** Zaznamená aktivitu „teď" – volá se po přihlášení, aby hlídač hned neodhlásil. */
export function noteActivity() {
  persistActivity(Date.now())
}
function persistedActivity(): number {
  try {
    return Number(localStorage.getItem(ACT_KEY)) || 0
  } catch {
    return 0
  }
}
function flagIdleLogout() {
  try {
    localStorage.setItem(FLAG_KEY, '1')
  } catch {
    /* ignore */
  }
}
/** Byl poslední odchod kvůli nečinnosti? (přečte a smaže příznak) */
export function wasIdleLogout(): boolean {
  try {
    const f = localStorage.getItem(FLAG_KEY) === '1'
    if (f) localStorage.removeItem(FLAG_KEY)
    return f
  } catch {
    return false
  }
}

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

/**
 * Odhlásí uživatele po `minutách` nečinnosti. `active` zapne hlídač
 * (jen v serverovém režimu a když je učitel přihlášený).
 */
export function useAutoLogout(active: boolean, onTimeout: () => void) {
  const min = useIdleMinutes()
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const limit = min * 60_000
    let timer: ReturnType<typeof setTimeout>
    let lastPersist = 0

    const fire = () => {
      flagIdleLogout()
      onTimeout()
    }
    const reset = () => {
      const now = Date.now()
      if (now - lastPersist > 15_000) {
        lastPersist = now
        persistActivity(now)
      }
      clearTimeout(timer)
      timer = setTimeout(fire, limit)
    }
    // Při startu: pokud karta byla dlouho zavřená/skrytá a čas vypršel, odhlásit hned.
    const prev = persistedActivity()
    if (prev && Date.now() - prev >= limit) {
      fire()
      return
    }
    persistActivity(Date.now())
    reset()

    const onActivity = () => reset()
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const p = persistedActivity()
      if (p && Date.now() - p >= limit) fire()
      else reset()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, min, onTimeout])
}
