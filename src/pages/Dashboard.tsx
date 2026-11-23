import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users, Zap, Star, ArrowRight, Calendar, Target, TrendingUp, Flag, Globe, LayoutDashboard,
  ListChecks, AlertTriangle, RefreshCw, CheckCircle2, UserX, Ticket as TicketIcon, History, CalendarDays,
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import QuickAccessTiles from '@/components/dashboard/QuickAccessTiles'
import SprintTimeProgress, { SprintDeadlineBadge, sprintDeadlineLabel } from '@/components/dashboard/SprintTimeProgress'
import GoalMetSummary, { GoalMetBadge } from '@/components/dashboard/GoalMetSummary'
import AvatarStack from '@/components/dashboard/AvatarStack'
import Meter from '@/components/dashboard/Meter'
import { sprintTimeInfo, calendarDaysUntil } from '@/components/dashboard/sprintTime'
import { formatDate, isOverdue, isCurrentlyActive, countWorkingDays } from '@/utils/date'
import type { Ticket, TicketPriority, TicketStatus } from '@/types'
import { ticketsApi } from '@/api/client'
import i18n from '@/i18n'

const PRIORITY_CLS: Record<TicketPriority, string> = {
  low:    'text-slate-400 dark:text-slate-500',
  medium: 'text-amber-500 dark:text-amber-400',
  high:   'text-red-500 dark:text-red-400',
}
const PRIORITY_ORDER: Record<TicketPriority, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<TicketStatus, number> = { in_progress: 0, todo: 1, done: 2 }

/** "Alle →" style link for card headers. */
function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 rounded-md text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function greetingKey(hour: number) {
  if (hour < 11) return 'dashboard.greetingMorning'
  if (hour < 18) return 'dashboard.greetingDay'
  return 'dashboard.greetingEvening'
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const isAllowed = useAuthStore((s) => s.isAllowed)
  const teams = useAuthStore((s) => s.teams)
  const currentTeamId = useAuthStore((s) => s.currentTeamId)
  const members = useStore((s) => s.members)
  const skills = useStore((s) => s.skills)
  const skillAreas = useStore((s) => s.skillAreas)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const retrospectives = useStore((s) => s.retrospectives)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)

  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [ticketsLoaded, setTicketsLoaded] = useState(false)

  useEffect(() => {
    ticketsApi.list().then((all) => {
      const myMemberId = currentUser?.memberId
      if (!myMemberId) { setMyTickets([]); return }
      setMyTickets(all.filter((tk) => tk.status !== 'done' && tk.assigneeIds?.includes(myMemberId)))
    }).catch(() => {}).finally(() => setTicketsLoaded(true))
  }, [currentUser])

  const linkIf = (page: string, to: string) => (isAllowed(page) ? to : undefined)

  const activeMembers = members.filter((m) => m.isActive)
  const activeSprint = sprints.find((s) => s.status === 'Aktiv')
  const sprintInfo = activeSprint ? sprintTimeInfo(activeSprint.startDate, activeSprint.endDate) : null
  const sprintOverdue = sprintInfo?.state === 'overdue'

  const openActionItems = retrospectives.flatMap((r) =>
    r.items.filter((i) => i.type === 'Aktionspunkt' && i.status !== 'Erledigt'),
  )
  const overdueActionCount = openActionItems.filter((i) => i.dueDate && isOverdue(i.dueDate)).length
  const inProgressActionCount = openActionItems.filter((i) => i.status === 'InBearbeitung').length

  // Assignments overlapping the running sprint — or today, if there is no (still running) sprint.
  const currentAssignments = assignments.filter((a) => {
    if (activeSprint && !sprintOverdue) {
      return a.startDate <= activeSprint.endDate && a.endDate >= activeSprint.startDate
    }
    return isCurrentlyActive(a.startDate, a.endDate)
  })

  const recentSprints = [...sprints]
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, 5)

  const sortedTickets = useMemo(
    () => [...myTickets].sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    [myTickets],
  )

  const sprintMembers = activeSprint
    ? activeSprint.capacity
        .map((c) => members.find((m) => m.id === c.memberId))
        .filter((m): m is NonNullable<typeof m> => !!m)
    : []

  // ── Header texts ──────────────────────────────────────────────────────────
  const locale = i18n.language?.startsWith('de') ? 'de-DE' : 'en-US'
  const now = new Date()
  const todayLabel = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const firstName = currentUser?.displayName?.split(' ')[0] ?? ''
  const teamName = teams.find((tm) => tm.id === currentTeamId)?.name

  // ── Sprint history metrics ───────────────────────────────────────────────
  const historyHasVelocity = recentSprints.some((s) => (s.velocity ?? 0) > 0)
  const historyHasItems = recentSprints.some((s) => (s.completedItems ?? 0) > 0)
  const historyMetric = (s: typeof recentSprints[number]) =>
    historyHasVelocity ? (s.velocity ?? 0) : historyHasItems ? (s.completedItems ?? 0) : 0
  const historyMax = Math.max(...recentSprints.map((s) => Math.max(historyMetric(s), historyHasVelocity ? s.plannedPoints : 0)), 1)
  const ratedRecent = recentSprints.filter((s) => s.goalMet)
  const recentGoalRate = ratedRecent.length
    ? Math.round(((ratedRecent.filter((s) => s.goalMet === 'Ja').length + ratedRecent.filter((s) => s.goalMet === 'Teilweise').length * 0.5) / ratedRecent.length) * 100)
    : null

  return (
    <Page size="wide">
      <PageHeader
        icon={LayoutDashboard}
        title={firstName ? t(greetingKey(now.getHours()), { name: firstName }) : t('dashboard.title')}
        documentTitle={t('dashboard.title')}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <span className="first-letter:uppercase">{todayLabel}</span>
            {teamName && (
              <>
                <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
                <span>{t('dashboard.teamOverview', { team: teamName })}</span>
              </>
            )}
          </span>
        }
      />

      <div className="space-y-8">
        {/* ── KPI tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={Users}
            tone="indigo"
            label={t('dashboard.activeMembers')}
            value={activeMembers.length}
            hint={
              activeSprint
                ? t('dashboard.inSprintHint', { count: sprintMembers.length })
                : t('dashboard.membersTotalHint', { count: members.length })
            }
            to={linkIf('team', '/team')}
          />
          <StatCard
            icon={Zap}
            tone={sprintOverdue ? 'amber' : 'emerald'}
            label={t('dashboard.activeSprint')}
            value={<span title={activeSprint?.name}>{activeSprint?.name ?? '—'}</span>}
            hint={
              sprintInfo ? (
                <span className={sprintOverdue ? 'inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300' : ''}>
                  {sprintOverdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                  {sprintDeadlineLabel(sprintInfo, t)}
                </span>
              ) : t('dashboard.noActiveSprint')
            }
            to={linkIf('sprints', activeSprint ? `/sprints/${activeSprint.id}` : '/sprints')}
          />
          <StatCard
            icon={ListChecks}
            tone="amber"
            label={t('dashboard.openActionItems')}
            value={openActionItems.length}
            hint={
              overdueActionCount > 0 ? (
                <span className="font-medium text-red-600 dark:text-red-400">{t('dashboard.overdueCount', { count: overdueActionCount })}</span>
              ) : openActionItems.length > 0 ? (
                t('dashboard.inProgressCount', { count: inProgressActionCount })
              ) : (
                t('dashboard.allDone')
              )
            }
            to={linkIf('retro', '/retro')}
          />
          <StatCard
            icon={Star}
            tone="violet"
            label={t('dashboard.skillsInCatalog')}
            value={skills.length}
            hint={t('dashboard.skillAreasHint', { count: skillAreas.length })}
            to={linkIf('kompetenzen', '/kompetenzen')}
          />
        </div>

        {/* ── Quick access ─────────────────────────────────────────────── */}
        <QuickAccessTiles />

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Active Sprint */}
            <Card
              title={t('dashboard.activeSprint')}
              icon={<Zap />}
              action={activeSprint && isAllowed('sprints') ? <CardLink to={`/sprints/${activeSprint.id}`}>{t('dashboard.openSprint')}</CardLink> : undefined}
            >
              {activeSprint ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{activeSprint.name}</h3>
                        <Badge label={t(`sprintStatus.${activeSprint.status}`)} variant="info" dot />
                        {activeSprint.goalMet && <GoalMetBadge value={activeSprint.goalMet} />}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                      </p>
                    </div>
                    <SprintDeadlineBadge startDate={activeSprint.startDate} endDate={activeSprint.endDate} />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                    <div className="min-w-0">
                      <p className="section-label mb-0.5">{t('dashboard.sprintGoal')}</p>
                      {activeSprint.goal?.trim() ? (
                        <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{activeSprint.goal}</p>
                      ) : (
                        <p className="text-sm italic text-slate-400 dark:text-slate-500">{t('dashboard.noSprintGoal')}</p>
                      )}
                    </div>
                  </div>

                  <SprintTimeProgress startDate={activeSprint.startDate} endDate={activeSprint.endDate} showDeadline={false} />

                  <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-3">
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="section-label">{t('dashboard.sprintTeam')}</dt>
                      <dd className="mt-1.5 flex items-center gap-2">
                        {sprintMembers.length > 0 ? (
                          <>
                            <AvatarStack people={sprintMembers} max={5} />
                            <span className="text-sm text-slate-600 dark:text-slate-300">{t('dashboard.memberCount', { count: sprintMembers.length })}</span>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="section-label">{t('dashboard.sprintDuration')}</dt>
                      <dd className="mt-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {t('dashboard.workingDays', { count: countWorkingDays(activeSprint.startDate, activeSprint.endDate) })}
                      </dd>
                    </div>
                    <div>
                      <dt className="section-label">{t('dashboard.storyPoints')}</dt>
                      <dd className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-800 dark:text-slate-200">
                        {activeSprint.plannedPoints > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Target className="h-3.5 w-3.5 text-slate-400" />
                            {activeSprint.plannedPoints} SP {t('dashboard.planned')}
                          </span>
                        ) : null}
                        {activeSprint.velocity != null && activeSprint.velocity > 0 ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                            {activeSprint.velocity} SP
                          </span>
                        ) : null}
                        {!(activeSprint.plannedPoints > 0) && !(activeSprint.velocity && activeSprint.velocity > 0) && (
                          <span className="text-slate-400 dark:text-slate-500">{t('dashboard.notPlanned')}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Zap />}
                  title={t('dashboard.noActiveSprint')}
                  description={t('dashboard.noActiveSprintHint')}
                  action={isAllowed('sprints') ? (
                    <Button size="sm" variant="secondary" iconRight={<ArrowRight />} onClick={() => navigate('/sprints')}>
                      {t('dashboard.goToSprints')}
                    </Button>
                  ) : undefined}
                />
              )}
            </Card>

            {/* Sprint History */}
            <Card
              title={t('dashboard.sprintHistory')}
              subtitle={recentSprints.length > 0 ? t('dashboard.sprintHistorySubtitle', { count: recentSprints.length }) : undefined}
              icon={<History />}
              action={isAllowed('sprints') ? <CardLink to="/sprints">{t('dashboard.all')}</CardLink> : undefined}
              padding={false}
            >
              {recentSprints.length === 0 ? (
                <EmptyState compact icon={<History />} title={t('dashboard.noCompletedSprints')} />
              ) : (
                <>
                  {ratedRecent.length > 0 && (
                    <GoalMetSummary values={recentSprints.map((s) => s.goalMet)} rate={recentGoalRate} className="border-b border-slate-100 px-5 py-4 dark:border-slate-800" />
                  )}
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentSprints.map((sp) => {
                      const metric = historyMetric(sp)
                      const row = (
                        <>
                          <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                            <p className="truncate text-sm font-medium text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">{sp.name}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatDate(sp.startDate)} – {formatDate(sp.endDate)}</p>
                          </div>
                          <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
                            {(historyHasVelocity || historyHasItems) && (
                              <>
                                <Meter value={(metric / historyMax) * 100} tone={sp.goalMet === 'Ja' ? 'emerald' : 'indigo'} neutralTrack size="sm" />
                                <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                                  {metric > 0 ? (historyHasVelocity ? `${metric} SP` : t('dashboard.itemsCount', { count: metric })) : '—'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="w-24 shrink-0 text-right">
                            {sp.goalMet ? <GoalMetBadge value={sp.goalMet} /> : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                          </div>
                        </>
                      )
                      return (
                        <li key={sp.id}>
                          {isAllowed('sprints') ? (
                            <Link to={`/sprints/${sp.id}`} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              {row}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-4 px-5 py-3">{row}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* Current Responsibilities */}
            <Card
              title={t('dashboard.currentResponsibilities')}
              icon={<RefreshCw />}
              action={isAllowed('rotation') ? <CardLink to="/rotation">{t('dashboard.all')}</CardLink> : undefined}
              padding={false}
            >
              {currentAssignments.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentAssignments.map((a) => {
                    const member = members.find((m) => m.id === a.memberId)
                    if (!member) return null
                    const color = responsibilityTypes.find((rt) => rt.name === a.type)?.color ?? '#6366f1'
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={member.name} color={member.avatarColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{member.name}</p>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                            <span className="truncate" title={a.type}>{a.type}</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500" title={`${formatDate(a.startDate)} – ${formatDate(a.endDate)}`}>
                          {t('dashboard.until', { date: formatDate(a.endDate) })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={<RefreshCw />}
                  title={t('dashboard.noCurrentAssignments')}
                  description={t('dashboard.noCurrentAssignmentsHint')}
                  action={isAllowed('rotation') ? (
                    <Button size="sm" variant="secondary" iconRight={<ArrowRight />} onClick={() => navigate('/rotation')}>
                      {t('dashboard.goToRotation')}
                    </Button>
                  ) : undefined}
                />
              )}
            </Card>

            {/* My Open Tickets */}
            <Card
              title={t('dashboard.myOpenTickets')}
              subtitle={ticketsLoaded && sortedTickets.length > 0 ? t('dashboard.openCount', { count: sortedTickets.length }) : undefined}
              icon={<TicketIcon />}
              action={isAllowed('tickets') ? <CardLink to="/tickets">{t('dashboard.all')}</CardLink> : undefined}
              padding={false}
            >
              {!ticketsLoaded ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-3.5 flex-1" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : sortedTickets.length === 0 ? (
                currentUser?.memberId ? (
                  <EmptyState compact icon={<CheckCircle2 />} title={t('dashboard.noMyOpenTickets')} />
                ) : (
                  <EmptyState compact icon={<UserX />} title={t('dashboard.noLinkedMember')} description={t('dashboard.noLinkedMemberHint')} />
                )
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedTickets.slice(0, 6).map((ticket) => {
                    const body = (
                      <>
                        <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_CLS[ticket.priority]}`} aria-label={t(`tickets.priority.${ticket.priority}`)} />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white" title={ticket.title}>
                          {ticket.title}
                        </span>
                        {ticket.isGlobal && (
                          <Globe className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" aria-label={t('tickets.global')} />
                        )}
                        <Badge
                          label={t(`tickets.status.${ticket.status}`)}
                          variant={ticket.status === 'in_progress' ? 'info' : 'default'}
                          className="shrink-0"
                        />
                      </>
                    )
                    return (
                      <li key={ticket.id}>
                        {isAllowed('tickets') ? (
                          <Link to="/tickets" className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">{body}</Link>
                        ) : (
                          <div className="flex items-center gap-3 px-5 py-2.5">{body}</div>
                        )}
                      </li>
                    )
                  })}
                  {sortedTickets.length > 6 && (
                    <li className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {t('dashboard.moreItems', { count: sortedTickets.length - 6 })}
                    </li>
                  )}
                </ul>
              )}
            </Card>

            {/* Open Action Items */}
            <Card
              title={t('dashboard.openActionItems')}
              subtitle={openActionItems.length > 0 ? t('dashboard.openCount', { count: openActionItems.length }) : undefined}
              icon={<ListChecks />}
              action={isAllowed('retro') ? <CardLink to="/retro">{t('dashboard.all')}</CardLink> : undefined}
              padding={false}
            >
              {openActionItems.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {openActionItems.slice(0, 5).map((item) => {
                    const assignee = item.assigneeId ? members.find((m) => m.id === item.assigneeId) : null
                    const overdue = item.dueDate ? isOverdue(item.dueDate) : false
                    return (
                      <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.status === 'InBearbeitung' ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm leading-snug text-slate-700 dark:text-slate-200" title={item.text}>{item.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <Badge
                              label={t(`retroItemStatus.${item.status}`)}
                              variant={item.status === 'InBearbeitung' ? 'warning' : 'default'}
                            />
                            {assignee && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Avatar name={assignee.name} color={assignee.avatarColor} size="2xs" />
                                {assignee.name.split(' ')[0]}
                              </span>
                            )}
                            {item.dueDate && (
                              <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                <CalendarDays className="h-3 w-3" />
                                {overdue
                                  ? t('dashboard.overdueSince', { count: -calendarDaysUntil(item.dueDate) })
                                  : t('dashboard.due', { date: formatDate(item.dueDate) })}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {openActionItems.length > 5 && (
                    <li className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {t('dashboard.moreItems', { count: openActionItems.length - 5 })}
                    </li>
                  )}
                </ul>
              ) : (
                <EmptyState compact icon={<CheckCircle2 />} title={t('dashboard.noOpenActionItems')} />
              )}
            </Card>
          </div>
        </div>
      </div>
    </Page>
  )
}
