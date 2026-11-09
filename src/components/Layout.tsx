import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, ClipboardPen, Download, FileText, FolderOpen, GraduationCap, History, LayoutDashboard, Menu, Settings2,
  MessageSquareHeart, School, SlidersHorizontal, Users, X, LogOut, RefreshCw, CloudOff, Check, Loader2,
} from 'lucide-react'
import { retrySync } from '../lib/store'
import { onSyncState, remoteEnabled, type SyncState } from '../lib/remote'
import { refresh, signOut, useSession } from '../lib/session'
import { setSelection, switchSchoolType } from '../lib/selection'
import { useCtx } from '../lib/useCtx'
import { cx, Select } from './ui'
import { ConfirmDialog } from './ConfirmDialog'
import { useAutoLogout } from '../lib/autologout'

const TEACHER_NAV = [
  { to: '/prehled', label: 'Přehled', icon: LayoutDashboard },
  { to: '/hodnoceni/nove', label: 'Nové hodnocení', icon: ClipboardPen },
  { to: '/historie', label: 'Historie hodnocení', icon: History },
  { to: '/zaci', label: 'Žáci a pokrok', icon: GraduationCap },
  { to: '/sebehodnoceni-zaku', label: 'Sebehodnocení', icon: MessageSquareHeart },
  { to: '/souhrny', label: 'Souhrny', icon: FileText },
  { to: '/portfolio', label: 'Portfolio a přílohy', icon: FolderOpen },
  { to: '/trida', label: 'Přehled třídy', icon: BarChart3 },
  { to: '/tridy', label: 'Třídy a žáci', icon: Users },
  { to: '/kriteria', label: 'Dovednosti a věty', icon: SlidersHorizontal },
  { to: '/export', label: 'Export dat', icon: Download },
  { to: '/nastaveni', label: 'Nastavení', icon: Settings2 },
]
const MGMT_NAV = [
  { to: '/vedeni', label: 'Vedení školy', icon: School },
  { to: '/nastaveni', label: 'Nastavení', icon: Settings2 },
]

export function Layout({ children }: { children: ReactNode }) {
  const { db, type, classes, cls, subjects, subj } = useCtx()
  const [open, setOpen] = useState(false)
  const role = db.settings.role
  const items = role === 'ucitel' ? TEACHER_NAV : MGMT_NAV
  // V serverovém režimu odhlásí učitele i vedení po nastavené době nečinnosti.
  useAutoLogout(remoteEnabled, signOut)

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Hlavní navigace">
      <Link to="/" title="Úvodní stránka" className="mb-6 flex items-center gap-2.5 rounded-xl px-2 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
          <BookOpenCheck size={20} />
        </span>
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold">Pokrok žáka</div>
          <div className="text-xs text-ink-faint">formativní hodnocení</div>
        </div>
      </Link>
      {items.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors',
              isActive ? 'bg-brand-500 text-white shadow-[0_6px_16px_-8px_rgba(14,148,136,.7)]' : 'text-ink-soft hover:bg-sea-50 hover:text-ink',
            )
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        {remoteEnabled ? (
          <ServerBox />
        ) : (
          <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-700">
            <strong className="block text-[13px]">Testovací provoz</strong>
            Fiktivní žáci a třídy. Data se ukládají jen v tomto prohlížeči.
          </div>
        )}
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button className="absolute right-3 top-4 p-2 text-ink-soft" onClick={() => setOpen(false)} aria-label="Zavřít menu">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {role === 'ucitel' && (
          <div className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
              <button className="rounded-lg p-1.5 text-ink-soft lg:hidden" onClick={() => setOpen(true)} aria-label="Otevřít menu">
                <Menu size={22} />
              </button>
              <div className="inline-flex rounded-xl border border-line bg-canvas p-1" role="group" aria-label="Typ školy">
                {(['ZS', 'SS'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchSchoolType(db, t)}
                    aria-pressed={type === t}
                    className={cx('rounded-lg px-3 py-1 text-sm font-bold', type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint')}
                  >
                    {t === 'ZS' ? 'ZŠ' : 'SŠ'}
                  </button>
                ))}
              </div>
              <Select
                id="vyber-trida"
                aria-label="Třída"
                className="w-auto min-w-[110px]"
                value={cls?.id ?? ''}
                onChange={(e) => {
                  const s = db.subjects.find((p) => p.classId === e.target.value)
                  setSelection({ classId: e.target.value, subjectId: s?.id ?? '' })
                }}
              >
                {classes.length === 0 && <option value="">Žádná třída</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>Třída {c.name}</option>
                ))}
              </Select>
              <Select
                id="vyber-predmet"
                aria-label="Předmět"
                className="w-auto min-w-[150px]"
                value={subj?.id ?? ''}
                onChange={(e) => setSelection({ subjectId: e.target.value })}
              >
                {subjects.length === 0 && <option value="">Žádný předmět</option>}
                {subjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <span className="ml-auto hidden text-sm text-ink-faint md:inline">
                {db.schools.find((s) => s.id === cls?.schoolId)?.name}
              </span>
            </div>
          </div>
        )}
        {role === 'vedeni' && (
          <div className="no-print border-b border-line bg-surface px-4 py-3 lg:hidden">
            <button className="rounded-lg p-1.5 text-ink-soft" onClick={() => setOpen(true)} aria-label="Otevřít menu">
              <Menu size={22} />
            </button>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  )
}

/** Serverový režim: kdo je přihlášený, stav ukládání a odhlášení. */
function ServerBox() {
  const session = useSession()
  const [sync, setSync] = useState<SyncState>({ status: 'idle' })
  const [busy, setBusy] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  useEffect(() => {
    const off = onSyncState(setSync)
    return () => void off()
  }, [])
  // Neuložené změny: upozornit před zavřením okna.
  useEffect(() => {
    if (sync.status === 'idle') return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sync.status])
  const email = session.status === 'in' ? session.profile.email : ''

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-700">
      <div>
        <strong className="block text-[13px]">Testovací provoz</strong>
        Jen fiktivní žáci, skutečné údaje zatím nezadávejte.
      </div>
      <div className="truncate font-semibold" title={email}>{email}</div>
      <div role="status" className={cx('flex items-center gap-1.5 font-semibold', sync.status === 'error' && 'text-bad')}>
        {sync.status === 'saving' && <><Loader2 size={13} className="animate-spin" /> Ukládám…</>}
        {sync.status === 'idle' && <><Check size={13} /> Uloženo na serveru</>}
        {sync.status === 'error' && <><CloudOff size={13} /> Neuloženo</>}
      </div>
      {sync.status === 'error' && (
        <div className="flex flex-col gap-1">
          <span className="text-ink-soft" title={sync.message}>Změny se nepodařilo uložit.</span>
          <button className="w-fit font-semibold text-bad underline" onClick={() => void retrySync()}>Zkusit znovu</button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button className="flex items-center gap-1 font-semibold hover:underline" disabled={busy}
          onClick={async () => { setBusy(true); await refresh(); setBusy(false) }}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Načíst znovu
        </button>
        <button className="flex items-center gap-1 font-semibold hover:underline" onClick={() => setConfirmLogout(true)}>
          <LogOut size={13} /> Odhlásit
        </button>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Odhlásit se?"
        message="Neuložené změny se před odhlášením uloží. Pro další přihlášení budete muset znovu zadat heslo."
        confirmLabel="Odhlásit"
        cancelLabel="Zůstat přihlášen"
        onConfirm={() => { setConfirmLogout(false); void signOut() }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
