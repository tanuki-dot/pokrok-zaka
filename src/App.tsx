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

export default function App() {
  const db = useDB()
  const loc = useLocation()

  // Úvodní stránka (zatím bez přihlášení, jen proklik do dema).
  if (loc.pathname === '/') return <Landing />

  // Stránky bez rozhraní učitele: sebehodnocení žáka (odkaz/QR) a tisk.
  if (loc.pathname.startsWith('/sebehodnoceni/') || loc.pathname.startsWith('/tisk/')) {
    return (
      <Routes>
        <Route path="/sebehodnoceni/:code" element={<SelfAssessmentPage />} />
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
          <Route path="*" element={<Navigate to="/vedeni" replace />} />
        </Routes>
      </Layout>
    )
  }

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
        <Route path="*" element={<Navigate to="/prehled" replace />} />
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
