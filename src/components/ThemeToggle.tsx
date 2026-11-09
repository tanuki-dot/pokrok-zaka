import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'
import { cx } from './ui'

const OPTIONS: [ThemePref, string, typeof Sun][] = [
  ['light', 'Světlý', Sun],
  ['dark', 'Tmavý', Moon],
  ['system', 'Systém', Monitor],
]

// Přepínač vzhledu (světlý / tmavý / podle systému).
// compact = jen ikony, vhodné do úzké lišty (např. landing header).
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme()
  return (
    <div className="grid grid-cols-3 rounded-xl border border-line bg-canvas p-1" role="radiogroup" aria-label="Vzhled">
      {OPTIONS.map(([v, label, Icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={theme === v}
          aria-label={label}
          title={label}
          onClick={() => setTheme(v)}
          className={cx(
            'flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold',
            theme === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
          )}
        >
          <Icon size={compact ? 15 : 13} /> {!compact && label}
        </button>
      ))}
    </div>
  )
}
