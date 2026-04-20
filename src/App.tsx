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
import MeetingsPage from '@/pages/MeetingsPage'
import MeetingDetailPage from '@/pages/MeetingDetailPage'
import TopicDetailPage from '@/pages/TopicDetailPage'
import LoginPage from '@/pages/LoginPage'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { authApi, teamsApi } from '@/api/client'
import { Loader2, AlertTriangle, Users } from 'lucide-react'

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

// ─── Team Selection Screen ─────────────────────────────────────────────────────
function TeamSelectionScreen() {
  const { t }       = useTranslation()
  const teams       = useAuthStore((s) => s.teams)
  const selectTeam  = useAuthStore((s) => s.selectTeam)
  const logout      = useAuthStore((s) => s.logout)
  const user        = useAuthStore((s) => s.user)

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 max-w-sm w-full shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('teams.selectTitle')}</h1>
            <p className="text-xs text-slate-500">{t('teams.selectSubtitle')}</p>
          </div>
        </div>

        <div className="space-y-2">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => selectTeam(team.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-md bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                <span className="text-indigo-600 dark:text-indigo-300 text-sm font-bold">
                  {team.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{team.name}</p>
                {team.description && (
                  <p className="text-xs text-slate-500 truncate">{team.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">{user?.displayName}</span>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {t('sidebar.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  const loadAll = useStore((s) => s.loadAll)
  const loading = useStore((s) => s.loading)
  const error   = useStore((s) => s.error)
  const members = useStore((s) => s.members)

  const token         = useAuthStore((s) => s.token)
  const user          = useAuthStore((s) => s.user)
  const currentTeamId = useAuthStore((s) => s.currentTeamId)
  const login         = useAuthStore((s) => s.login)
  const logout        = useAuthStore((s) => s.logout)
  const setTeams      = useAuthStore((s) => s.setTeams)

  // Token present but no user → fetch /me after page reload
  useEffect(() => {
    if (token && !user) {
      authApi.me()
        .then((me) => login(token, me))
        .catch(() => logout())
    }
  }, [token, user, login, logout])

  // Load teams once logged in
  useEffect(() => {
    if (token && user) {
      teamsApi.list().then(setTeams).catch(() => {/* ignore */})
    }
  }, [token, user, setTeams])

  // Load team data once a team is selected
  useEffect(() => {
    if (token && user && currentTeamId) loadAll()
  }, [token, user, currentTeamId, loadAll])

  // Not logged in → login page
  if (!token || (!user && !loading)) {
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

  // Logged in but no team selected → team selection screen
  if (user && !currentTeamId) {
    return <TeamSelectionScreen />
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
        <Route path="meetings"          element={<ProtectedRoute page="meetings"><MeetingsPage /></ProtectedRoute>} />
        <Route path="meetings/:meetingId" element={<ProtectedRoute page="meetings"><MeetingDetailPage /></ProtectedRoute>} />
        <Route path="meetings/:meetingId/topics/:topicId" element={<ProtectedRoute page="meetings"><TopicDetailPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
