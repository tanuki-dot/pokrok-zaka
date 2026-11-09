import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PrivacyNotice } from './components/PrivacyNotice'
import '@fontsource-variable/figtree'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import './lib/theme'
import { hideSplash } from './lib/splash'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <PrivacyNotice />
    </HashRouter>
  </StrictMode>,
)

hideSplash()
