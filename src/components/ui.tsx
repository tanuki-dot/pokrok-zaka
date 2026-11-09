import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { HelpCircle } from 'lucide-react'
import { levelLabel } from '../lib/levels'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/** #12: krátká nápověda u funkce – ikona „?" se slovním vysvětlením (hover i dotyk). */
export function Help({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('group relative inline-flex align-middle', className)}>
      <button type="button" aria-label="Nápověda" className="grid h-5 w-5 place-items-center rounded-full text-ink-faint hover:text-sea-600 focus:text-sea-600 focus:outline-none">
        <HelpCircle size={15} />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-56 max-w-[min(14rem,80vw)] -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-lg group-hover:block group-focus-within:block">
        {children}
      </span>
    </span>
  )
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(22,33,58,.04)]', className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-bold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

type BtnVariant = 'primary' | 'brand' | 'ghost' | 'outline' | 'danger'
export function Button({ variant = 'outline', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-sea-500 text-white hover:bg-sea-600 border-transparent',
    brand: 'bg-brand-500 text-white hover:bg-brand-600 border-transparent',
    ghost: 'bg-transparent text-ink-soft hover:bg-sea-50 hover:text-ink border-transparent',
    outline: 'bg-surface text-ink hover:border-sea-500 hover:text-sea-600 border-line',
    danger: 'bg-surface text-bad hover:bg-bad-wash border-bad/30',
  }
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
    />
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

const inputCls =
  'rounded-xl border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-100'

const width = (c?: string) => (c && /(^|\s)(w-|min-w-|flex-1)/.test(c) ? '' : 'w-full')
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, width(p.className), p.className)} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={2} {...p} className={cx(inputCls, 'w-full resize-y leading-relaxed', p.className)} />
)
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(inputCls, width(p.className), 'cursor-pointer pr-8', p.className)} />
)

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'sea' | 'brand'; className?: string }) {
  const tones = {
    neutral: 'bg-muted text-ink-soft',
    good: 'bg-good-wash text-good',
    warn: 'bg-warn-wash text-warn',
    bad: 'bg-bad-wash text-bad',
    sea: 'bg-sea-50 text-sea-700',
    brand: 'bg-brand-50 text-brand-700',
  }
  // Výchozí štítek se nezalamuje; s className „whitespace-normal“ se zalomí (dlouhé texty na telefonu).
  const wrap = className?.includes('whitespace-') ? '' : 'whitespace-nowrap'
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', wrap, tones[tone], className)}>{children}</span>
}

export function LevelBadge({ level, size = 'md' }: { level?: number; size?: 'sm' | 'md' }) {
  if (!level) return <span className="text-ink-faint">–</span>
  return (
    <span
      title={levelLabel(level)}
      className={cx(
        'tabular inline-flex items-center justify-center rounded-lg font-bold text-white',
        size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm',
      )}
      style={{ background: `var(--color-lv${level})` }}
    >
      {level}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-[28px] font-bold leading-tight">
          {icon && <span className="text-brand-500">{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-canvas/60 px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex max-w-full flex-wrap rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-sea-500 text-white' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
