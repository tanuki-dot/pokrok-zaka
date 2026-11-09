import { useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { acknowledgePrivacy, usePrivacy } from '../lib/privacy'
import { aiAvailable } from '../lib/ai'
import { remoteEnabled } from '../lib/remote'

/** Jednorázová informace o soukromí. Souhlas se nevyžaduje – nic volitelného se nezpracovává. */
export function PrivacyNotice() {
  const { open } = usePrivacy()
  const loc = useLocation()
  if (!open || loc.pathname.startsWith('/tisk/')) return null

  return (
    <div
      role="region"
      aria-labelledby="soukromi-nadpis"
      className="no-print fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
    >
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_20px_50px_-20px_rgba(22,33,58,.45)] sm:flex-row sm:items-center sm:p-5">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-good-wash text-good sm:grid">
          <ShieldCheck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="soukromi-nadpis" className="text-[16px] font-bold">Bez cookies a bez sledování</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Aplikace nepoužívá cookies ani reklamní či analytické služby.{' '}
            {remoteEnabled
              ? 'Data učitelů, tříd a hodnocení ukládá do databáze Supabase (servery v EU), přihlášení drží v úložišti prohlížeče. Zatím jde o testovací provoz jen s fiktivními žáky.'
              : 'Ukázková data, vybranou třídu, vzhled a přílohy ukládá jen ve vašem prohlížeči. Smazat je můžete vymazáním dat stránky v prohlížeči.'}
            {aiAvailable && (
              <>
                {' '}Návrhy pomocí AI zpracovává jako zpracovatel společnost Anthropic (Claude, servery mimo EU – v USA). Posílají se jen pseudonymizované údaje hodnocení bez jména, příjmení a třídy žáka; podle podmínek Anthropic se údaje z API nepoužívají k trénování modelů. V testovacím provozu jde navíc jen o fiktivní data.{' '}
                <a
                  href="https://www.anthropic.com/legal/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sea-600 underline underline-offset-2 hover:text-sea-700"
                >
                  Zásady ochrany soukromí Anthropic
                </a>.
              </>
            )}
          </p>
        </div>
        <button
          onClick={acknowledgePrivacy}
          className="shrink-0 rounded-xl bg-sea-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sea-600"
        >
          Rozumím
        </button>
      </div>
    </div>
  )
}
