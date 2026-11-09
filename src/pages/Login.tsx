import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenCheck, Loader2 } from 'lucide-react'
import { rememberedEmail, sendReset, setNewPassword, signIn, signUp } from '../lib/session'
import { wasIdleLogout } from '../lib/autologout'
import { openPrivacy } from '../lib/privacy'
import { Button, Field, Input, cx } from '../components/ui'

type Mode = 'in' | 'up' | 'reset' | 'newpass'

/** Přihlášení učitele (e-mail a heslo). Žák se nepřihlašuje – sebehodnocení otevírá kódem. */
export default function Login({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<Mode>(recovery ? 'newpass' : 'in')
  const [email, setEmail] = useState(rememberedEmail)
  const [idleOut] = useState(wasIdleLogout)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if ((mode === 'up' || mode === 'newpass') && password.length < 10) return setError('Heslo musí mít aspoň 10 znaků.')
    setBusy(true)
    try {
      if (mode === 'in') await signIn(email, password)
      if (mode === 'up') {
        const r = await signUp(email, password, name)
        if (r.needsConfirmation) setInfo('Poslali jsme vám e-mail s odkazem pro potvrzení účtu. Po potvrzení se přihlaste.')
      }
      if (mode === 'reset') {
        await sendReset(email)
        setInfo('Pokud účet existuje, přijde vám e-mail s odkazem pro nastavení nového hesla.')
      }
      if (mode === 'newpass') {
        await setNewPassword(password)
        setInfo('Heslo je změněné.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const title = { in: 'Přihlášení učitele', up: 'Nový účet učitele', reset: 'Zapomenuté heslo', newpass: 'Nové heslo' }[mode]
  const action = { in: 'Přihlásit se', up: 'Vytvořit účet', reset: 'Poslat odkaz', newpass: 'Uložit heslo' }[mode]

  return (
    <div className="grid min-h-full place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white"><BookOpenCheck size={22} /></span>
          <span className="font-display text-xl font-bold">Pokrok žáka</span>
        </Link>
        <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-7" noValidate>
          <h1 className="text-[22px] font-bold">{title}</h1>
          {mode === 'up' && <p className="mt-1 text-sm text-ink-soft">Zatím jen pro vyzkoušení s fiktivními žáky – skutečné údaje žáků sem nezadávejte.</p>}
          {idleOut && mode === 'in' && (
            <p role="status" className="mt-3 rounded-xl bg-warn-wash px-3 py-2 text-sm text-warn">
              Byli jste odhlášeni kvůli nečinnosti. Pro pokračování zadejte heslo.
            </p>
          )}
          <div className="mt-5 grid gap-4">
            {mode === 'up' && (
              <Field label="Jméno a příjmení">
                <Input id="jmeno" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}
            {mode !== 'newpass' && (
              <Field label="E-mail">
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
            )}
            {mode !== 'reset' && (
              <Field label="Heslo" hint={mode === 'in' ? undefined : 'Aspoň 10 znaků.'}>
                <Input
                  id="heslo"
                  type="password"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
            )}
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-bad-wash px-3 py-2 text-sm text-bad">{error}</p>}
          {info && <p role="status" className="mt-4 rounded-xl bg-good-wash px-3 py-2 text-sm text-good">{info}</p>}
          <Button type="submit" variant="primary" className="mt-5 w-full justify-center" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} {action}
          </Button>
          {mode !== 'newpass' && (
            <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
              {mode === 'in' ? (
                <>
                  <ModeLink onClick={() => setMode('up')}>Vytvořit účet</ModeLink>
                  <ModeLink onClick={() => setMode('reset')}>Zapomenuté heslo</ModeLink>
                </>
              ) : (
                <ModeLink onClick={() => setMode('in')}>Zpět na přihlášení</ModeLink>
              )}
            </div>
          )}
        </form>
        <p className="mt-4 text-center text-xs text-ink-faint">
          Žáci se nepřihlašují – sebehodnocení otevřou kódem od učitele.{' '}
          <button onClick={openPrivacy} className="font-semibold underline-offset-2 hover:underline">Soukromí</button>
        </p>
      </div>
    </div>
  )
}

const ModeLink = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <button type="button" onClick={onClick} className={cx('font-semibold text-sea-600 hover:underline')}>
    {children}
  </button>
)
