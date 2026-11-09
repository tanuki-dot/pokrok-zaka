import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useDB } from './lib/store'
import Dashboard from './pages/Dashboard'
import Wizard from './pages/eval/Wizard'
import History from './pages/History'
import Portfolio from './pages/Portfolio'
import PrintAssessment from './pages/PrintAssessment'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import ClassOverview from './pages/ClassOverview'
import Summaries from './pages/Summaries'
import SummaryEditor from './pages/SummaryEditor'
import Classes from './pages/Classes'
import CriteriaPage from './pages/Criteria'
import ExportPage from './pages/Export'
import Management from './pages/Management'
import SelfAssessmentPage from './pages/SelfAssessment'
import PrintSummary from './pages/PrintSummary'
import Landing from './pages/Landing'
import SelfResults from './pages/SelfResults'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import { Forbidden, NotFound } from './pages/ErrorPage'
import { remoteEnabled } from './lib/remote'
import { useSession } from './lib/session'
import { Loader2 } from 'lucide-react'
import { Button } from './components/ui'

export default function App() {
  const db = useDB()
  const loc = useLocation()

  const session = useSession()

  // Úvodní stránka a sebehodnocení žáka (odkaz/QR) jsou veřejné.
  if (loc.pathname === '/') return <Landing />
  if (loc.pathname.startsWith('/sebehodnoceni/'))
    return (
      <Routes>
        <Route path="/sebehodnoceni/:code" element={<SelfAssessmentPage />} />
      </Routes>
    )

  // Se serverem musí být učitel přihlášený.
  if (remoteEnabled) {
    if (session.status === 'loading')
      return (
        <div className="grid min-h-full place-items-center text-ink-faint" role="status">
          <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Načítám data…</span>
        </div>
      )
    if (session.status === 'error')
      return (
        <div className="grid min-h-full place-items-center px-4 text-center">
          <div>
            <p className="font-semibold">Data se nepodařilo načíst ze serveru.</p>
            <p className="mt-1 text-sm text-ink-faint">{session.message}</p>
            <Button className="mt-4" onClick={() => location.reload()}>Zkusit znovu</Button>
          </div>
        </div>
      )
    if (session.status === 'out') return <Login />
    if (session.recovery) return <Login recovery />
    if (loc.pathname === '/prihlaseni') return <Navigate to="/prehled" replace />
  } else if (loc.pathname === '/prihlaseni') return <Navigate to="/prehled" replace />

  // Tisk – bez rozhraní učitele.
  if (loc.pathname.startsWith('/tisk/')) {
    return (
      <Routes>
        <Route path="/tisk/hodnoceni/:id" element={<PrintAssessment />} />
        <Route path="/tisk/:id" element={<PrintSummary />} />
      </Routes>
    )
  }

  if (db.settings.role === 'vedeni') {
    return (
      <Layout>
        <Routes>
          <Route path="/vedeni" element={<Management />} />
          <Route path="/nastaveni" element={<Settings />} />
          <Route path="*" element={<Navigate to="/vedeni" replace />} />
        </Routes>
      </Layout>
    )
  }

  // První přihlášení bez tříd: ukázková data, nebo vlastní škola.
  if (remoteEnabled && db.schools.length === 0)
    return (
      <Layout>
        <Onboarding />
      </Layout>
    )

  return (
    <Layout>
      <Routes>
        <Route path="/prehled" element={<Dashboard />} />
        <Route path="/hodnoceni/nove" element={<WizardKeyed />} />
        <Route path="/hodnoceni/:id" element={<WizardKeyed />} />
        <Route path="/hodnoceni/:id/:step" element={<WizardKeyed />} />
        <Route path="/historie" element={<History />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/zaci/novy" element={<Navigate to="/hodnoceni/nove?novy=1" replace />} />
        <Route path="/zaci" element={<Students />} />
        <Route path="/zaci/:id" element={<StudentDetail />} />
        <Route path="/trida" element={<ClassOverview />} />
        <Route path="/souhrny" element={<Summaries />} />
        <Route path="/souhrny/:id" element={<SummaryEditor />} />
        <Route path="/sebehodnoceni-zaku" element={<SelfResults />} />
        <Route path="/tridy" element={<Classes />} />
        <Route path="/kriteria" element={<CriteriaPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/nastaveni" element={<Settings />} />
        <Route path="/vedeni" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

/** Nové hodnocení = vždy čistý formulář; u existujícího záznamu se stav drží podle id. */
function WizardKeyed() {
  const { id } = useParams()
  const loc = useLocation()
  return <Wizard key={id ?? `nove-${loc.key}`} />
}
