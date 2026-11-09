import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FileQuestion, Home, Lock, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui'

type Variant = '404' | '403' | '500'

const PRESET: Record<Variant, { icon: typeof Lock; title: string; message: string }> = {
  '404': { icon: FileQuestion, title: 'Stránka nenalezena', message: 'Tahle stránka neexistuje nebo byla přesunutá. Zkontrolujte adresu, nebo se vraťte zpět.' },
  '403': { icon: Lock, title: 'Přístup odepřen', message: 'K této stránce nemáte oprávnění. Pokud je to omyl, obraťte se na správce školy.' },
  '500': { icon: AlertTriangle, title: 'Něco se pokazilo', message: 'V aplikaci nastala neočekávaná chyba. Zkuste stránku obnovit.' },
}

export function ErrorPage({
  variant,
  title,
  message,
  standalone = false,
  children,
}: {
  variant: Variant
  title?: string
  message?: ReactNode
  standalone?: boolean
  children?: ReactNode
}) {
  const preset = PRESET[variant]
  const Icon = preset.icon
  return (
    <div className={standalone ? 'grid min-h-dvh place-items-center bg-canvas px-4 py-16' : 'grid min-h-[60vh] place-items-center px-4 py-12'}>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-warn-wash text-warn">
          <Icon size={30} />
        </div>
        <p className="mt-5 font-display text-6xl font-bold tracking-tight text-ink">{variant}</p>
        <h1 className="mt-2 text-xl font-bold text-ink">{title ?? preset.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{message ?? preset.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  )
}

// Neznámá adresa v rozhraní učitele (uvnitř Layoutu).
export function NotFound() {
  return (
    <ErrorPage variant="404">
      <Link to="/prehled"><Button variant="primary"><Home size={16} /> Zpět na přehled</Button></Link>
      <Link to="/"><Button>Na úvodní stránku</Button></Link>
    </ErrorPage>
  )
}

// Přihlášený uživatel bez oprávnění k dané stránce (např. učitel na stránce vedení).
export function Forbidden() {
  return (
    <ErrorPage variant="403">
      <Link to="/prehled"><Button variant="primary"><Home size={16} /> Zpět na přehled</Button></Link>
    </ErrorPage>
  )
}

// Neočekávaná chyba – používá ErrorBoundary (stránka stojí samostatně, bez Layoutu).
export function AppError() {
  return (
    <ErrorPage variant="500" standalone>
      <Button variant="primary" onClick={() => location.reload()}><RotateCcw size={16} /> Obnovit stránku</Button>
      <Button onClick={() => { location.hash = '#/'; location.reload() }}><Home size={16} /> Na úvod</Button>
    </ErrorPage>
  )
}
