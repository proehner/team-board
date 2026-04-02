import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import TeamPage from '@/pages/TeamPage'
import CompetencyPage from '@/pages/CompetencyPage'
import SprintsPage from '@/pages/SprintsPage'
import SprintDetailPage from '@/pages/SprintDetailPage'
import RotationPage from '@/pages/RotationPage'
import RetroPage from '@/pages/RetroPage'
import RetroDetailPage from '@/pages/RetroDetailPage'
import HealthPage from '@/pages/HealthPage'
import PulsePage from '@/pages/PulsePage'
import StakeholderPage from '@/pages/StakeholderPage'
import AzureRankingPage from '@/pages/AzureRankingPage'
import AdminPage from '@/pages/AdminPage'
import KnownErrorDBPage from '@/pages/KnownErrorDBPage'
import KnownErrorDetailPage from '@/pages/KnownErrorDetailPage'
import LoginPage from '@/pages/LoginPage'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/client'
import { Loader2, AlertTriangle } from 'lucide-react'

function ProtectedRoute({ page, children }: { page: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  const isAllowed = useAuthStore((s) => s.isAllowed)
  if (!isAllowed(page)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-800">{t('app.noAccess')}</h2>
          <p className="text-sm text-slate-500">{t('app.noPermission')}</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  const { t } = useTranslation()
  const loadAll = useStore((s) => s.loadAll)
  const loading = useStore((s) => s.loading)
  const error   = useStore((s) => s.error)
  const members = useStore((s) => s.members)

  const token   = useAuthStore((s) => s.token)
  const user    = useAuthStore((s) => s.user)
  const login   = useAuthStore((s) => s.login)
  const logout  = useAuthStore((s) => s.logout)

  // Token vorhanden aber kein User → /me abfragen (nach Seiten-Reload)
  useEffect(() => {
    if (token && !user) {
      authApi.me()
        .then((me) => login(token, me))
        .catch(() => logout())
    }
  }, [token, user, login, logout])

  // Daten laden sobald eingeloggt
  useEffect(() => {
    if (token && user) loadAll()
  }, [token, user, loadAll])

  // Nicht eingeloggt → Login-Seite
  if (!token || (!user && !loading)) {
    // Wenn Token vorhanden, aber /me noch lädt: Warte-Screen
    if (token && !user) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm">{t('app.verifyingSession')}</span>
        </div>
      )
    }
    return <LoginPage />
  }

  if (loading && members.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-sm">{t('app.loadingData')}</span>
      </div>
    )
  }

  if (error && members.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md text-center space-y-3 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-800">{t('app.serverUnreachable')}</h2>
          <p className="text-sm text-slate-500">
            <Trans
              i18nKey="app.serverUnreachableMessage"
              components={[
                <code className="bg-slate-100 px-1 rounded" />,
                <code className="bg-slate-100 px-1 rounded" />,
              ]}
            />
          </p>
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => loadAll()}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('app.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"         element={<ProtectedRoute page="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="team"              element={<ProtectedRoute page="team"><TeamPage /></ProtectedRoute>} />
        <Route path="kompetenzen"       element={<ProtectedRoute page="kompetenzen"><CompetencyPage /></ProtectedRoute>} />
        <Route path="sprints"           element={<ProtectedRoute page="sprints"><SprintsPage /></ProtectedRoute>} />
        <Route path="sprints/:sprintId" element={<ProtectedRoute page="sprints"><SprintDetailPage /></ProtectedRoute>} />
        <Route path="rotation"          element={<ProtectedRoute page="rotation"><RotationPage /></ProtectedRoute>} />
        <Route path="retro"             element={<ProtectedRoute page="retro"><RetroPage /></ProtectedRoute>} />
        <Route path="retro/:retroId"    element={<ProtectedRoute page="retro"><RetroDetailPage /></ProtectedRoute>} />
        <Route path="health"            element={<ProtectedRoute page="health"><HealthPage /></ProtectedRoute>} />
        <Route path="pulse"             element={<ProtectedRoute page="pulse"><PulsePage /></ProtectedRoute>} />
        <Route path="stakeholder"       element={<ProtectedRoute page="stakeholder"><StakeholderPage /></ProtectedRoute>} />
        <Route path="azure-ranking"     element={<ProtectedRoute page="azure-ranking"><AzureRankingPage /></ProtectedRoute>} />
        <Route path="admin"             element={<ProtectedRoute page="admin"><AdminPage /></ProtectedRoute>} />
        <Route path="known-errors"      element={<ProtectedRoute page="known-errors"><KnownErrorDBPage /></ProtectedRoute>} />
        <Route path="known-errors/:errorId" element={<ProtectedRoute page="known-errors"><KnownErrorDetailPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
