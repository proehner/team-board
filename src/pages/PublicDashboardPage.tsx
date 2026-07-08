import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle, Wand2, Users, LogIn } from 'lucide-react'
import { publicApi, type PublicDashboardTeam } from '@/api/client'
import Avatar from '@/components/ui/Avatar'
import { daysUntil } from '@/utils/date'

export default function PublicDashboardPage() {
  const { t } = useTranslation()
  const [teams,   setTeams]   = useState<PublicDashboardTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    publicApi.dashboard()
      .then(setTeams)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('publicDashboard.title')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('publicDashboard.subtitle')}</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            {t('publicDashboard.loginLink')}
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-sm">{t('publicDashboard.loading')}</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-6 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('publicDashboard.error')}</p>
          </div>
        )}

        {!loading && !error && teams.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-16">{t('publicDashboard.empty')}</p>
        )}

        {!loading && !error && teams.length > 0 && (
          <div className="space-y-6">
            {teams.map((team) => (
              <section key={team.teamId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{team.teamName}</h2>
                {team.responsibilities.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('publicDashboard.noTypes')}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {team.responsibilities.map((r) => {
                      const daysLeft = r.current ? daysUntil(r.current.endDate) : null
                      return (
                        <div key={r.typeId} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{r.typeName}</span>
                          </div>
                          {r.current ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={r.current.memberName} color={r.current.avatarColor} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{r.current.memberName}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  {daysLeft !== null && daysLeft >= 0
                                    ? t('publicDashboard.daysLeft', { count: daysLeft + 1 })
                                    : t('publicDashboard.endsToday')}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Wand2 className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <p className="text-xs text-slate-400 dark:text-slate-500">{t('publicDashboard.noActiveAssignment')}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
