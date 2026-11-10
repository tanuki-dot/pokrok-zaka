import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui'

/**
 * Potvrzovací dialog – vycentrovaný na střed, s rozmazaným ztmaveným pozadím.
 * Zavře se klávesou Esc nebo kliknutím mimo kartu.
 * Vykresluje se portálem do document.body, aby ho nemohl překrýt obsah stránky:
 * sidebar je position:sticky, což vytváří stacking context, a z-index dialogu
 * by jinak platil jen uvnitř něj (grafy na stránce by dialog překryly).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Potvrdit',
  cancelLabel = 'Zrušit',
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(22,33,58,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold text-ink">{title}</h2>
        {message && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone} autoFocus onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
