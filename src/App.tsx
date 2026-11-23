import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import TicketsPage from '@/pages/TicketsPage'
import RoadmapPage from '@/pages/RoadmapPage'
import RoadmapFeatureDetailPage from '@/pages/RoadmapFeatureDetailPage'
import LoginPage from '@/pages/LoginPage'
import PublicDashboardPage from '@/pages/PublicDashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { authApi, teamsApi } from '@/api/client'
import { AlertTriangle, ShieldOff, Shield, ChevronRight, LogOut, Loader2 } from 'lucide-react'
import Toaster from '@/components/ui/Toaster'
import Button from '@/components/ui/Button'

function ProtectedRoute({ page, children }: { page: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  const isAllowed = useAuthStore((s) => s.isAllowed)
  if (!isAllowed(page)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-500/10">
            <ShieldOff className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('app.noAccess')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('app.noPermission')}</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/** Centered full-screen status (loading, verifying session …) */
function FullScreenStatus({ label }: { label: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-slate-950">
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <Loader2 className="absolute -bottom-1.5 -right-1.5 h-5 w-5 animate-spin rounded-full bg-slate-50 p-0.5 text-indigo-500 dark:bg-slate-950" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

// ─── Team Selection Screen ─────────────────────────────────────────────────────
function TeamSelectionScreen() {
  const { t }       = useTranslation()
  const teams       = useAuthStore((s) => s.teams)
  const selectTeam  = useAuthStore((s) => s.selectTeam)
  const logout      = useAuthStore((s) => s.logout)
  const user        = useAuthStore((s) => s.user)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,theme(colors.indigo.100),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,theme(colors.indigo.950),transparent_60%)]" />
      <div className="relative w-full max-w-md animate-scale-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('teams.selectTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('teams.selectSubtitle')}</p>
        </div>

        <div className="surface p-2">
          {teams.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <ul className="space-y-1">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    onClick={() => selectTeam(team.id)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-base font-bold text-indigo-600 ring-1 ring-inset ring-indigo-500/10 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10 dark:text-indigo-300">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{team.name}</p>
                      {team.description && (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{team.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between px-1 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{user?.displayName}</span>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('sidebar.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  const location = useLocation()
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
        .then(({ token: newToken, user: me }) => login(newToken, me))
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

  // Public dashboard: reachable without login, rendered standalone (no Layout/sidebar).
  if (location.pathname === '/public-dashboard') {
    return <><PublicDashboardPage /><Toaster /></>
  }

  // Not logged in → login page
  if (!token || (!user && !loading)) {
    if (token && !user) {
      return <FullScreenStatus label={t('app.verifyingSession')} />
    }
    return <><LoginPage /><Toaster /></>
  }

  // Logged in but no team selected → team selection screen
  if (user && !currentTeamId) {
    return <><TeamSelectionScreen /><Toaster /></>
  }

  if (loading && members.length === 0) {
    return <FullScreenStatus label={t('app.loadingData')} />
  }

  if (error && members.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="surface w-full max-w-md p-8 text-center animate-scale-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-inset ring-red-500/20 dark:bg-red-500/10">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('app.serverUnreachable')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <Trans
              i18nKey="app.serverUnreachableMessage"
              components={[
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300" />,
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300" />,
              ]}
            />
          </p>
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" icon={<LogOut />} onClick={logout}>{t('sidebar.logout')}</Button>
            <Button variant="primary" onClick={() => loadAll()} loading={loading}>{t('app.tryAgain')}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <Toaster />
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
        <Route path="tickets"               element={<ProtectedRoute page="tickets"><TicketsPage /></ProtectedRoute>} />
        <Route path="roadmap"               element={<ProtectedRoute page="roadmap"><RoadmapPage /></ProtectedRoute>} />
        <Route path="roadmap/:featureId"    element={<ProtectedRoute page="roadmap"><RoadmapFeatureDetailPage /></ProtectedRoute>} />
        <Route path="*"                     element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  )
}
