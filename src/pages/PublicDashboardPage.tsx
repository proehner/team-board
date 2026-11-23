import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Users, LogIn, Shield, Sun, Moon, RefreshCw, UserX, CalendarDays, LayoutDashboard, Languages } from 'lucide-react'
import { publicApi, type PublicDashboardTeam, type PublicDashboardResponsibility } from '@/api/client'
import { useThemeStore } from '@/store/theme'
import { useAuthStore } from '@/store/auth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { calendarDaysUntil } from '@/components/dashboard/sprintTime'
import { formatDate } from '@/utils/date'
import i18n from '@/i18n'

const REFRESH_MS = 5 * 60 * 1000

function ResponsibilityCard({ r }: { r: PublicDashboardResponsibility }) {
  const { t } = useTranslation()

  if (!r.current) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-dashed border-slate-300 bg-white/40 p-4 dark:border-slate-700 dark:bg-slate-900/30">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 shrink-0 rounded-full opacity-60" style={{ backgroundColor: r.color }} aria-hidden />
          <span className="truncate" title={r.typeName}>{r.typeName}</span>
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <UserX className="h-[18px] w-[18px]" />
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('publicDashboard.noActiveAssignment')}</p>
        </div>
      </div>
    )
  }

  const days = calendarDaysUntil(r.current.endDate)
  const remaining =
    days <= 0 ? t('publicDashboard.endsToday')
      : days === 1 ? t('publicDashboard.endsTomorrow')
        : t('publicDashboard.daysRemaining', { count: days })
  const soon = days <= 1

  return (
    <div className="surface relative flex h-full flex-col overflow-hidden p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: r.color }} aria-hidden />
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
        <span className="truncate" title={r.typeName}>{r.typeName}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={r.current.memberName} color={r.current.avatarColor} size="md" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50" title={r.current.memberName}>{r.current.memberName}</p>
          <p className={`mt-0.5 text-xs ${soon ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>{remaining}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {t('dashboard.until', { date: formatDate(r.current.endDate) })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PublicDashboardPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('publicDashboard.title'))
  const isDark = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const loggedIn = !!useAuthStore((s) => s.token)

  const [teams,     setTeams]     = useState<PublicDashboardTeam[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    publicApi.dashboard()
      .then((data) => { setTeams(data); setError(null); setUpdatedAt(new Date()) })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    // Keep wall displays up to date
    const id = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const locale = i18n.language?.startsWith('de') ? 'de-DE' : 'en-US'
  const isDe = i18n.language?.startsWith('de')
  const totalRoles = teams.reduce((s, tm) => s + tm.responsibilities.length, 0)
  const filledRoles = teams.reduce((s, tm) => s + tm.responsibilities.filter((r) => r.current).length, 0)
  const initialLoad = loading && teams.length === 0 && !error

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30 ring-1 ring-inset ring-white/10">
              <Shield className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">Team Board</p>
              <p className="truncate text-xs leading-tight text-slate-500 dark:text-slate-400">{t('publicDashboard.publicView')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <IconButton
              icon={<Languages />}
              label={isDe ? 'English' : 'Deutsch'}
              onClick={() => i18n.changeLanguage(isDe ? 'en' : 'de')}
            />
            <IconButton
              icon={isDark ? <Sun /> : <Moon />}
              label={isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
              onClick={toggleTheme}
            />
            <Link
              to={loggedIn ? '/dashboard' : '/login'}
              aria-label={loggedIn ? t('publicDashboard.toDashboard') : t('publicDashboard.signIn')}
              title={loggedIn ? t('publicDashboard.toDashboard') : t('publicDashboard.signIn')}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              {loggedIn ? <LayoutDashboard className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span className="hidden min-[400px]:inline">{loggedIn ? t('publicDashboard.toDashboard') : t('publicDashboard.signIn')}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 animate-fade-in sm:px-6 lg:px-8">
        {/* ── Title row ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">{t('publicDashboard.title')}</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('publicDashboard.subtitle')}</p>
            {!initialLoad && !error && teams.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label={t('publicDashboard.teamCount', { count: teams.length })} icon={<Users />} />
                <Badge
                  label={t('publicDashboard.filledRoles', { filled: filledRoles, total: totalRoles })}
                  variant={totalRoles > 0 && filledRoles === totalRoles ? 'success' : filledRoles === 0 ? 'warning' : 'indigo'}
                  dot
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {error && teams.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('publicDashboard.refreshFailed')}
              </span>
            )}
            {updatedAt && (
              <span>{t('publicDashboard.updatedAt', { time: updatedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>
            )}
            <IconButton
              icon={<RefreshCw className={loading ? 'animate-spin' : ''} />}
              label={t('publicDashboard.refresh')}
              variant="secondary"
              onClick={load}
              disabled={loading}
            />
          </div>
        </div>

        {/* ── States ────────────────────────────────────────────────────────── */}
        {initialLoad && (
          <div className="space-y-6" aria-busy="true" aria-label={t('publicDashboard.loading')}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="surface p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <Skeleton className="h-3 w-24" />
                      <div className="mt-3 flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && teams.length === 0 && (
          <div className="surface">
            <EmptyState
              icon={<AlertTriangle />}
              title={t('publicDashboard.error')}
              description={error}
              action={<Button variant="secondary" icon={<RefreshCw />} onClick={load}>{t('common.retry')}</Button>}
            />
          </div>
        )}

        {!loading && !error && teams.length === 0 && (
          <div className="surface">
            <EmptyState icon={<Users />} title={t('publicDashboard.empty')} description={t('publicDashboard.emptyHint')} />
          </div>
        )}

        {/* ── Teams ─────────────────────────────────────────────────────────── */}
        {teams.length > 0 && (
          <div className="space-y-6">
            {teams.map((team) => {
              const filled = team.responsibilities.filter((r) => r.current).length
              return (
                <section key={team.teamId} aria-labelledby={`team-${team.teamId}`} className="surface p-4 sm:p-5">
                  <header className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white dark:from-slate-600 dark:to-slate-700">
                        {team.teamName.charAt(0).toUpperCase()}
                      </span>
                      <h2 id={`team-${team.teamId}`} className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{team.teamName}</h2>
                    </div>
                    {team.responsibilities.length > 0 && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {t('publicDashboard.filledRoles', { filled, total: team.responsibilities.length })}
                      </span>
                    )}
                  </header>
                  {team.responsibilities.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      {t('publicDashboard.noTypes')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {team.responsibilities.map((r) => <ResponsibilityCard key={r.typeId} r={r} />)}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200/80 py-5 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        Team Board · {t('publicDashboard.footer')}
      </footer>
    </div>
  )
}
