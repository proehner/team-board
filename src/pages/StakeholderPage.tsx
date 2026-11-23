import { useStore } from '@/store'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import Meter from '@/components/dashboard/Meter'
import SprintTimeProgress, { SprintDeadlineBadge } from '@/components/dashboard/SprintTimeProgress'
import { GoalMetBadge } from '@/components/dashboard/GoalMetSummary'
import { formatDate } from '@/utils/date'
import { Target, Calendar, Users, Zap, CheckCircle2, Eye, Flag, TrendingUp, History, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'

export default function StakeholderPage() {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members)
  const retrospectives = useStore((s) => s.retrospectives)

  const activeSprint = sprints.find((s) => s.status === 'Aktiv')
  const completedSprints = sprints.filter((s) => s.status === 'Abgeschlossen').sort((a, b) => b.endDate.localeCompare(a.endDate))
  const recentSprints = completedSprints.slice(0, 5)
  const progress = activeSprint && activeSprint.plannedPoints > 0
    ? Math.min(Math.round(((activeSprint.velocity ?? 0) / activeSprint.plannedPoints) * 100), 100) : 0

  const completedActions = retrospectives.flatMap((r) => r.items.filter((i) => i.type === 'Aktionspunkt' && i.status === 'Erledigt')).length
  const totalActions = retrospectives.flatMap((r) => r.items.filter((i) => i.type === 'Aktionspunkt')).length
  const actionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0

  // Delivery KPIs over the completed sprints
  const rated = completedSprints.filter((s) => s.goalMet)
  const goalRate = rated.length
    ? Math.round(((rated.filter((s) => s.goalMet === 'Ja').length + rated.filter((s) => s.goalMet === 'Teilweise').length * 0.5) / rated.length) * 100)
    : null
  const withVelocity = completedSprints.filter((s) => (s.velocity ?? 0) > 0)
  const withItems = completedSprints.filter((s) => (s.completedItems ?? 0) > 0)
  const avgVelocity = withVelocity.length ? Math.round(withVelocity.reduce((s, sp) => s + (sp.velocity ?? 0), 0) / withVelocity.length) : null
  const avgItems = withItems.length ? Math.round(withItems.reduce((s, sp) => s + (sp.completedItems ?? 0), 0) / withItems.length) : null

  const firstSprintStart = completedSprints.length ? completedSprints[completedSprints.length - 1].startDate : null

  const locale = i18n.language?.startsWith('de') ? 'de-DE' : 'en-US'
  const today = new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })

  const sprintTeam = activeSprint
    ? activeSprint.capacity
        .map((c) => ({ c, member: members.find((m) => m.id === c.memberId) }))
        .filter((x): x is { c: typeof x.c; member: NonNullable<typeof x.member> } => !!x.member)
    : []

  return (
    <Page>
      <PageHeader
        icon={Eye}
        title={t('stakeholder.title')}
        subtitle={t('stakeholder.subtitleDate', { date: today })}
      />

      <div className="space-y-6">
        {/* ── Active sprint ──────────────────────────────────────────────── */}
        {activeSprint ? (
          <section className="surface relative overflow-hidden" aria-labelledby="stakeholder-sprint">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" aria-hidden />
            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="section-label mb-1">{t('stakeholder.currentSprint')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="stakeholder-sprint" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{activeSprint.name}</h2>
                    <Badge label={t('sprintStatus.Aktiv')} variant="info" dot />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                  </p>
                </div>
                <SprintDeadlineBadge startDate={activeSprint.startDate} endDate={activeSprint.endDate} />
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-indigo-50/70 p-4 ring-1 ring-inset ring-indigo-500/10 dark:bg-indigo-500/10 dark:ring-indigo-400/15">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-500/10 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-400/20">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-indigo-700/80 dark:text-indigo-300/80">{t('dashboard.sprintGoal')}</p>
                  {activeSprint.goal?.trim() ? (
                    <p className="mt-0.5 whitespace-pre-line text-sm font-medium leading-relaxed text-indigo-950 dark:text-indigo-100">{activeSprint.goal}</p>
                  ) : (
                    <p className="mt-0.5 text-sm italic text-indigo-900/60 dark:text-indigo-200/60">{t('dashboard.noSprintGoal')}</p>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-6 ${activeSprint.plannedPoints > 0 ? 'md:grid-cols-2' : ''}`}>
                <SprintTimeProgress startDate={activeSprint.startDate} endDate={activeSprint.endDate} showDeadline={false} />
                {activeSprint.plannedPoints > 0 && (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{t('stakeholder.progress')}</span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {activeSprint.velocity ?? 0} / {activeSprint.plannedPoints} Story Points · {progress}% {t('stakeholder.completed')}
                      </span>
                    </div>
                    <Meter value={progress} tone={progress >= 100 ? 'emerald' : 'indigo'} size="md" label={t('stakeholder.progress')} />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2.5 flex items-center gap-1.5 section-label">
                  <Users className="h-3.5 w-3.5" />
                  {t('stakeholder.team', { count: sprintTeam.length })}
                </p>
                {sprintTeam.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {sprintTeam.map(({ c, member }) => (
                      <li key={member.id} className="flex items-center gap-2 rounded-full bg-slate-50 py-1 pl-1 pr-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
                        <Avatar name={member.name} color={member.avatarColor} size="xs" />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{member.name}</span>
                        {c.plannedPoints > 0 && <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{c.plannedPoints} SP</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">—</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="surface">
            <EmptyState icon={<Zap />} title={t('stakeholder.noActiveSprint')} description={t('stakeholder.noActiveSprintHint')} />
          </div>
        )}

        {/* ── KPIs ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          <StatCard
            icon={Flag}
            tone="emerald"
            label={t('overview.goalAchievement')}
            value={goalRate !== null ? `${goalRate}%` : '—'}
            hint={rated.length > 0 ? t('stakeholder.fromSprints', { count: rated.length }) : t('stakeholder.noData')}
          />
          <StatCard
            icon={TrendingUp}
            tone="indigo"
            label={avgVelocity !== null || avgItems === null ? t('health.avgVelocity') : t('health.avgCompletedItems')}
            value={avgVelocity !== null ? `${avgVelocity} SP` : avgItems !== null ? avgItems : '—'}
            hint={t('stakeholder.perSprint')}
          />
          <StatCard
            className="col-span-2 md:col-span-1"
            icon={CheckCircle2}
            tone="violet"
            label={t('stakeholder.completedSprints')}
            value={completedSprints.length}
            hint={firstSprintStart ? t('stakeholder.since', { date: formatDate(firstSprintStart) }) : t('stakeholder.noData')}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ── Recent sprints ─────────────────────────────────────────── */}
          <Card
            className="lg:col-span-3"
            title={t('stakeholder.recentSprints')}
            icon={<History />}
            padding={false}
          >
            {recentSprints.length === 0 ? (
              <EmptyState compact icon={<History />} title={t('dashboard.noCompletedSprints')} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentSprints.map((sp) => (
                  <li key={sp.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{sp.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatDate(sp.startDate)} – {formatDate(sp.endDate)}</p>
                    </div>
                    {sp.velocity != null && sp.velocity > 0 ? (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">{sp.velocity} SP</span>
                    ) : (sp.completedItems ?? 0) > 0 ? (
                      <span className="hidden shrink-0 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400 sm:inline">{t('dashboard.itemsCount', { count: sp.completedItems })}</span>
                    ) : null}
                    <span className="w-24 shrink-0 text-right">
                      {sp.goalMet ? <GoalMetBadge value={sp.goalMet} /> : <span className="text-xs text-slate-400 dark:text-slate-500" title={t('sprintDetail.goalMet')}>—</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Continuous improvement ─────────────────────────────────── */}
          <Card
            className="lg:col-span-2"
            title={t('stakeholder.continuousImprovement')}
            icon={<Sparkles />}
          >
            {totalActions > 0 ? (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {completedActions}
                    <span className="text-base font-medium text-slate-400 dark:text-slate-500"> / {totalActions}</span>
                  </p>
                  <span className="pb-1 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{actionRate}%</span>
                </div>
                <Meter value={actionRate} tone="emerald" size="md" label={t('stakeholder.continuousImprovement')} />
                <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {completedActions} {t('stakeholder.retroActionsImplemented')}
                </p>
              </div>
            ) : (
              <EmptyState compact icon={<Sparkles />} title={t('stakeholder.noActions')} />
            )}
          </Card>
        </div>
      </div>
    </Page>
  )
}
