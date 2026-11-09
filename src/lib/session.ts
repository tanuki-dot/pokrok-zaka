import { useSyncExternalStore } from 'react'
import { flush, loadAll, loadProfile, remoteEnabled, sb, type Profile } from './remote'
import { clearLoaded, getDB, setLoaded } from './store'

/*
 * Přihlášení učitele (Supabase Auth) a načtení jeho dat.
 * Žák se nepřihlašuje – k dotazníku se dostane jen přes kód.
 */

export type SessionState =
  | { status: 'loading' }
  | { status: 'out'; recovery?: boolean }
  | { status: 'in'; profile: Profile; recovery?: boolean }
  | { status: 'error'; message: string }

let state: SessionState = remoteEnabled ? { status: 'loading' } : { status: 'out' }
const ls = new Set<() => void>()
const set = (s: SessionState) => {
  state = s
  ls.forEach((l) => l())
}
export const getSession = () => state

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => state,
  )
}

let lastLoad = 0
async function loadEverything(recovery = false) {
  try {
    const profile = await loadProfile()
    if (!profile) {
      clearLoaded()
      set({ status: 'out' })
      return
    }
    const prevSettings = getDB().settings
    const data = await loadAll({
      settings: { role: profile.role, teacherName: profile.fullName || profile.email, schoolType: prevSettings.schoolType },
    })
    // Typ školy podle tříd, které učitel má (ZŠ / SŠ).
    const types = new Set(data.schools.map((s) => s.type))
    if (types.size && !types.has(data.settings.schoolType)) data.settings.schoolType = [...types][0]
    setLoaded(data)
    lastLoad = Date.now()
    set({ status: 'in', profile, recovery })
  } catch (e) {
    set({ status: 'error', message: (e as Error).message })
  }
}

/** Znovu načte data ze serveru (např. nově odeslaná sebehodnocení žáků). */
export async function refresh() {
  if (state.status !== 'in') return
  await flush()
  await loadEverything(state.recovery)
}

if (remoteEnabled && sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      void loadEverything(true)
      return
    }
    if (event === 'SIGNED_OUT' || !session) {
      clearLoaded()
      set({ status: 'out' })
      return
    }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      // Opakované SIGNED_IN (obnovení tokenu v jiné kartě) nenačítá data znovu.
      if (state.status === 'in' && event === 'SIGNED_IN') return
      setTimeout(() => void loadEverything(), 0)
    }
  })
  // Po návratu do okna načíst novinky (nejvýš jednou za minutu).
  if (typeof window !== 'undefined')
    window.addEventListener('focus', () => {
      if (state.status === 'in' && Date.now() - lastLoad > 60_000) void refresh()
    })
}

// ─── Akce ────────────────────────────────────────────────────────────────────

const redirect = () => `${location.origin}${location.pathname}`

/** České znění častých chyb přihlášení. */
function czech(e: { message: string; name?: string; status?: number }) {
  const m = e.message
  if (e.name === 'AuthRetryableFetchError' || /fetch|network/i.test(m)) return 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.'
  if (m === 'Invalid login credentials') return 'Nesprávný e-mail nebo heslo.'
  if (/email not confirmed/i.test(m)) return 'E-mail zatím není potvrzený – klikněte na odkaz v e-mailu.'
  if (/already registered/i.test(m)) return 'Účet s tímto e-mailem už existuje.'
  if (/rate limit|too many/i.test(m) || e.status === 429) return 'Příliš mnoho pokusů, zkuste to za chvíli.'
  if (/password/i.test(m) && /weak|short|least/i.test(m)) return 'Heslo je příliš slabé – použijte aspoň 10 znaků.'
  return m
}

export async function signIn(email: string, password: string) {
  const { error } = await sb!.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(czech(error))
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await sb!.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirect() } })
  if (error) throw new Error(czech(error))
  return { needsConfirmation: !data.session }
}

export async function sendReset(email: string) {
  const { error } = await sb!.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() })
  if (error) throw new Error(czech(error))
}

export async function setNewPassword(password: string) {
  const { error } = await sb!.auth.updateUser({ password })
  if (error) throw new Error(czech(error))
  if (state.status === 'in') set({ ...state, recovery: false })
}

export async function signOut() {
  await flush()
  await sb!.auth.signOut()
}
