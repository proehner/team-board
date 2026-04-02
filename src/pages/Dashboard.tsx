import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatDate, daysUntil, isOverdue, isCurrentlyActive } from '@/utils/date'
import { Users, Zap, AlertCircle, Star, ArrowRight, Calendar, Target } from 'lucide-react'
import type { SprintStatus } from '@/types'

const sprintStatusVariant: Record<SprintStatus, 'info' | 'success' | 'default' | 'danger'> = {
  Geplant: 'default',
  Aktiv: 'info',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

export default function Dashboard() {
  const { t } = useTranslation()
  const members = useStore((s) => s.members)
  const skills = useStore((s) => s.skills)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const retrospectives = useStore((s) => s.retrospectives)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)

  const activeMembers = members.filter((m) => m.isActive)
  const activeSprint = sprints.find((s) => s.status === 'Aktiv')

  const openActionItems = retrospectives.flatMap((r) =>
    r.items.filter((i) => i.type === 'Aktionspunkt' && i.status !== 'Erledigt'),
  )

  const currentAssignments = assignments.filter((a) => {
    if (activeSprint) {
      return a.startDate <= activeSprint.endDate && a.endDate >= activeSprint.startDate
    }
    return isCurrentlyActive(a.startDate, a.endDate)
  })

  const daysLeft = activeSprint ? daysUntil(activeSprint.endDate) : null
  const capacity = activeSprint?.capacity ?? []
  const totalDays = capacity.reduce((s, c) => s + c.availableDays, 0)
  const totalPoints = capacity.reduce((s, c) => s + c.plannedPoints, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label={t('dashboard.activeMembers')}
          value={activeMembers.length.toString()}
          color="indigo"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label={t('dashboard.activeSprint')}
          value={activeSprint?.name ?? '—'}
          sub={daysLeft !== null ? t('dashboard.daysLeft', { count: daysLeft }) : undefined}
          color="green"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          label={t('dashboard.openActionItems')}
          value={openActionItems.length.toString()}
          color="amber"
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label={t('dashboard.skillsInCatalog')}
          value={skills.length.toString()}
          color="purple"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Sprint */}
        <Card
          title={t('dashboard.activeSprint')}
          action={
            activeSprint ? (
              <Link to={`/sprints/${activeSprint.id}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                {t('common.details')} <ArrowRight className="w-3 h-3" />
              </Link>
            ) : undefined
          }
        >
          {activeSprint ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge label={t(`sprintStatus.${activeSprint.status}`)} variant={sprintStatusVariant[activeSprint.status]} dot />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{activeSprint.name}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Target className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="italic">{activeSprint.goal}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{t('dashboard.totalAvailableDays')}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{totalDays}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{t('dashboard.plannedStoryPoints')}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{totalPoints}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('dashboard.noActiveSprint')}</p>
          )}
        </Card>

        {/* Current Responsibilities */}
        <Card
          title={t('dashboard.currentResponsibilities')}
          action={
            <Link to="/rotation" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {currentAssignments.length > 0 ? (
            <div className="space-y-2">
              {currentAssignments.map((a) => {
                const member = members.find((m) => m.id === a.memberId)
                if (!member) return null
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: responsibilityTypes.find((t) => t.name === a.type)?.color ?? '#6366f1' }}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-36 shrink-0">{a.type}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{member.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dashboard.noCurrentAssignments')}</p>
          )}
        </Card>

        {/* Team Capacity */}
        <Card title={t('dashboard.teamCapacity')}>
          {capacity.length > 0 ? (
            <div className="space-y-2.5">
              {capacity.map((c) => {
                const member = members.find((m) => m.id === c.memberId)
                if (!member) return null
                const maxDays = 10
                const pct = Math.round((c.availableDays / maxDays) * 100)
                return (
                  <div key={c.memberId} className="flex items-center gap-3">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-24 shrink-0 truncate">{member.name}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: member.avatarColor }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">{c.availableDays}T / {c.plannedPoints}SP</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dashboard.noCapacityData')}</p>
          )}
        </Card>

        {/* Open Action Items */}
        <Card
          title={t('dashboard.openActionItems')}
          action={
            <Link to="/retro" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {openActionItems.length > 0 ? (
            <div className="space-y-2">
              {openActionItems.slice(0, 5).map((item) => {
                const assignee = item.assigneeId ? members.find((m) => m.id === item.assigneeId) : null
                const overdue = item.dueDate ? isOverdue(item.dueDate) : false
                return (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.status === 'InBearbeitung' ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {assignee && (
                          <span className="text-xs text-slate-400">{assignee.name}</span>
                        )}
                        {item.dueDate && (
                          <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                            {overdue ? t('dashboard.overdue') : t('dashboard.due', { date: formatDate(item.dueDate) })}
                          </span>
                        )}
                        <Badge
                          label={t(`retroItemStatus.${item.status}`)}
                          variant={item.status === 'InBearbeitung' ? 'warning' : 'default'}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {openActionItems.length > 5 && (
                <p className="text-xs text-slate-400 pt-1">{t('dashboard.moreItems', { count: openActionItems.length - 5 })}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dashboard.noOpenActionItems')}</p>
          )}
        </Card>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: 'indigo' | 'green' | 'amber' | 'purple'
}

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
