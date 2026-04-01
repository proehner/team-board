import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatDate, daysUntil } from '@/utils/date'
import { Target, Calendar, Users, Zap, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { SprintStatus } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default', Aktiv: 'info', Abgeschlossen: 'success', Abgebrochen: 'danger',
}

export default function StakeholderPage() {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members)
  const retrospectives = useStore((s) => s.retrospectives)

  const activeSprint = sprints.find((s) => s.status === 'Aktiv')
  const recentSprints = sprints.filter((s) => s.status === 'Abgeschlossen').sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 3)
  const daysLeft = activeSprint ? daysUntil(activeSprint.endDate) : null
  const progress = activeSprint && activeSprint.plannedPoints > 0
    ? Math.min(Math.round(((activeSprint.velocity ?? 0) / activeSprint.plannedPoints) * 100), 100) : 0

  const completedActions = retrospectives.flatMap((r) => r.items.filter((i) => i.type === 'Aktionspunkt' && i.status === 'Erledigt')).length
  const totalActions = retrospectives.flatMap((r) => r.items.filter((i) => i.type === 'Aktionspunkt')).length

  const locale = i18n.language === 'de' ? 'de-DE' : 'en-US'

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('stakeholder.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('stakeholder.subtitle')} {new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      {activeSprint ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeSprint.name}</h2>
                <Badge label={t('sprintStatus.Aktiv')} variant="info" dot />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Calendar className="w-4 h-4" />
                {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                {daysLeft !== null && (
                  <span className={`ml-2 font-medium ${daysLeft <= 2 ? 'text-red-500' : daysLeft <= 5 ? 'text-amber-500' : 'text-green-600'}`}>
                    ({daysLeft > 0 ? t('dashboard.daysLeft', { count: daysLeft }) : daysLeft === 0 ? 'today' : 'overdue'})
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3">
            <Target className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-sm text-indigo-800 dark:text-indigo-300">{activeSprint.goal || '—'}</p>
          </div>
          {activeSprint.plannedPoints > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{t('stakeholder.progress')}</span>
                <span>{activeSprint.velocity ?? 0} / {activeSprint.plannedPoints} Story Points</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                <div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{progress}% {t('stakeholder.completed')}</p>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Users className="w-3.5 h-3.5" />
              {t('stakeholder.team', { count: activeSprint.capacity.length })}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSprint.capacity.map((c) => {
                const member = members.find((m) => m.id === c.memberId)
                if (!member) return null
                return (
                  <div key={member.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 rounded-full px-3 py-1 border border-slate-200 dark:border-slate-700">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{member.name}</span>
                    {c.plannedPoints > 0 && <span className="text-xs text-slate-400 dark:text-slate-500">{c.plannedPoints} SP</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 dark:text-slate-500">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('stakeholder.noActiveSprint')}</p>
        </div>
      )}

      {totalActions > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('stakeholder.continuousImprovement')}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{completedActions} / {totalActions} {t('stakeholder.implemented')}</span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${totalActions > 0 ? (completedActions / totalActions) * 100 : 0}%` }} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle className="w-3.5 h-3.5" />
            {completedActions} {t('stakeholder.retroActionsImplemented')}
          </div>
        </div>
      )}

      {recentSprints.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('stakeholder.recentSprints')}</h3>
          <div className="space-y-3">
            {recentSprints.map((sp) => (
              <div key={sp.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{sp.name}</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(sp.startDate)} – {formatDate(sp.endDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {sp.velocity !== undefined && <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{sp.velocity} SP</span>}
                  <Badge label={t(`sprintStatus.${sp.status}`)} variant={STATUS_VARIANTS[sp.status]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
