import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './i18n'
import './index.css'

// Fix favicon path for sub-directory deployment (e.g. IIS at /board/)
const favicon = document.getElementById('favicon') as HTMLLinkElement | null
if (favicon) {
  favicon.href = import.meta.env.BASE_URL + 'favicon.svg'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
