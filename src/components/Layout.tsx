import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3, BookOpenCheck, ClipboardPen, Download, FileText, GraduationCap, LayoutDashboard, Menu, RotateCcw,
  Monitor, Moon, School, SlidersHorizontal, Sun, Users, X,
} from 'lucide-react'
import { resetDemo, setRole } from '../lib/store'
import { setSelection, switchSchoolType } from '../lib/selection'
import { useCtx } from '../lib/useCtx'
import { cx, Select } from './ui'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'

const TEACHER_NAV = [
  { to: '/', label: 'Přehled', icon: LayoutDashboard, end: true },
  { to: '/hodnoceni/nove', label: 'Nové hodnocení', icon: ClipboardPen },
  { to: '/zaci', label: 'Žáci a pokrok', icon: GraduationCap },
  { to: '/trida', label: 'Přehled třídy', icon: BarChart3 },
  { to: '/souhrny', label: 'Souhrny', icon: FileText },
  { to: '/tridy', label: 'Třídy a žáci', icon: Users },
  { to: '/kriteria', label: 'Kritéria a věty', icon: SlidersHorizontal },
  { to: '/export', label: 'Export dat', icon: Download },
]
const MGMT_NAV = [{ to: '/vedeni', label: 'Vedení školy', icon: School }]

export function Layout({ children }: { children: ReactNode }) {
  const { db, type, classes, cls, subjects, subj } = useCtx()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const role = db.settings.role
  const items = role === 'ucitel' ? TEACHER_NAV : MGMT_NAV
  const [confirmReset, setConfirmReset] = useState(false)
  const theme = useTheme()

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Hlavní navigace">
      <div className="mb-6 flex items-center gap-2.5 px-2 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
          <BookOpenCheck size={20} />
        </span>
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold">Pokrok žáka</div>
          <div className="text-xs text-ink-faint">formativní hodnocení</div>
        </div>
      </div>
      {items.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors',
              isActive ? 'bg-brand-500 text-white shadow-[0_6px_16px_-8px_rgba(238,116,36,.8)]' : 'text-ink-soft hover:bg-sea-50 hover:text-ink',
            )
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-700">
          <strong className="block text-[13px]">Demo režim</strong>
          Fiktivní žáci a třídy. Data se ukládají jen v tomto prohlížeči.
        </div>
        <div className="flex flex-col gap-1 px-1 text-xs font-semibold text-ink-faint">
          Vzhled
          <div className="grid grid-cols-3 rounded-xl border border-line bg-canvas p-1" role="radiogroup" aria-label="Vzhled">
            {([
              ['light', 'Světlý', Sun],
              ['dark', 'Tmavý', Moon],
              ['system', 'Systém', Monitor],
            ] as [ThemePref, string, typeof Sun][]).map(([v, label, Icon]) => (
              <button
                key={v}
                role="radio"
                aria-checked={theme === v}
                onClick={() => setTheme(v)}
                className={cx(
                  'flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold',
                  theme === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 px-1 text-xs font-semibold text-ink-faint">
          Přihlášen jako
          <Select
            id="role"
            value={role}
            onChange={(e) => {
              const r = e.target.value as 'ucitel' | 'vedeni'
              setRole(r)
              nav(r === 'ucitel' ? '/' : '/vedeni')
            }}
          >
            <option value="ucitel">Učitel/ka</option>
            <option value="vedeni">Vedení školy</option>
          </Select>
        </label>
        {confirmReset ? (
          <div className="flex items-center gap-2 px-1 text-xs">
            <span className="text-ink-soft">Obnovit demo data?</span>
            <button className="font-semibold text-bad" onClick={() => { resetDemo(); setConfirmReset(false); nav('/') }}>Ano</button>
            <button className="font-semibold text-ink-soft" onClick={() => setConfirmReset(false)}>Ne</button>
          </div>
        ) : (
          <button className="flex items-center gap-2 px-1 text-xs font-semibold text-ink-faint hover:text-ink" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Obnovit ukázková data
          </button>
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
