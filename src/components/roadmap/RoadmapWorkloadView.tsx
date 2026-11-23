import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, TrendingUp, AlertCircle, Ticket, Gauge, Layers } from 'lucide-react'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import type { RoadmapFeature, RoadmapTicketArea } from '@/types'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/Spinner'
import { TICKET_AREA_META } from './roadmapConfig'

const NO_TEAM = '__none__'

export default function RoadmapWorkloadView() {
  const { t } = useTranslation()
  const allTickets            = useStore((s) => s.allRoadmapTickets)
  const features              = useStore((s) => s.roadmapFeatures)
  const loadAllRoadmapTickets = useStore((s) => s.loadAllRoadmapTickets)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (allTickets === null) {
      setLoading(true)
      loadAllRoadmapTickets()
        .catch((err) => toast.error(t('common.loadError'), { description: errorMessage(err) }))
        .finally(() => setLoading(false))
    }
  }, [allTickets, loadAllRoadmapTickets, t])

  const featureMap = useMemo(() => Object.fromEntries(features.map((f) => [f.id, f])), [features])

  const teamStats = useMemo(() => {
    if (!allTickets) return [] as { team: string; tickets: number; sp: number; areas: RoadmapTicketArea[]; featureIds: string[] }[]
    const map: Record<string, { tickets: number; sp: number; areas: Set<string>; featureIds: Set<string> }> = {}
    for (const tk of allTickets) {
      const team = tk.assignedTeam || NO_TEAM
      if (!map[team]) map[team] = { tickets: 0, sp: 0, areas: new Set(), featureIds: new Set() }
      map[team].tickets++
      map[team].sp += tk.storyPoints ?? 0
      map[team].areas.add(tk.area)
      map[team].featureIds.add(tk.featureId)
    }
    return Object.entries(map)
      .map(([team, s]) => ({ team, tickets: s.tickets, sp: s.sp, areas: [...s.areas] as RoadmapTicketArea[], featureIds: [...s.featureIds] }))
      .sort((a, b) => b.sp - a.sp || b.tickets - a.tickets)
  }, [allTickets])

  const areaStats = useMemo(() => {
    if (!allTickets) return [] as { area: RoadmapTicketArea; tickets: number; sp: number }[]
    const map: Partial<Record<RoadmapTicketArea, { tickets: number; sp: number }>> = {}
    for (const tk of allTickets) {
      if (!map[tk.area]) map[tk.area] = { tickets: 0, sp: 0 }
      map[tk.area]!.tickets++
      map[tk.area]!.sp += tk.storyPoints ?? 0
    }
    return (Object.entries(map) as [RoadmapTicketArea, { tickets: number; sp: number }][])
      .map(([area, s]) => ({ area, ...s }))
      .sort((a, b) => b.sp - a.sp)
  }, [allTickets])

  const totalSP = useMemo(() => allTickets?.reduce((s, tk) => s + (tk.storyPoints ?? 0), 0) ?? 0, [allTickets])

  if (loading) return <LoadingState label={t('roadmap.workload.loading')} />

  if (!allTickets || allTickets.length === 0) {
    return (
      <div className="surface">
        <EmptyState
          icon={<Users />}
          title={t('roadmap.workload.emptyTitle')}
          description={t('roadmap.workload.emptyHint')}
        />
      </div>
    )
  }

  const maxSP     = Math.max(...teamStats.map((s) => s.sp), 1)
  const maxAreaSP = Math.max(...areaStats.map((a) => a.sp), 1)
  const withTickets = new Set(allTickets.map((tk) => tk.featureId))
  const without = features.filter((f) => !withTickets.has(f.id) && f.status !== 'cancelled' && f.status !== 'done')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('roadmap.workload.totalTickets')} value={allTickets.length} icon={Ticket} tone="indigo" />
        <StatCard label={t('roadmap.workload.totalSP')} value={totalSP || '–'} icon={Gauge} tone="violet" />
        <StatCard label={t('roadmap.workload.teamsInvolved')} value={teamStats.filter((s) => s.team !== NO_TEAM).length} icon={Users} tone="sky" />
        <StatCard label={t('roadmap.workload.featuresWithTickets')} value={withTickets.size} icon={Layers} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t('roadmap.workload.perTeam')} icon={<Users />}>
          <ul className="space-y-4">
            {teamStats.map(({ team, tickets, sp, areas, featureIds }) => {
              const linked = featureIds.map((id) => featureMap[id]).filter((f): f is RoadmapFeature => !!f)
              return (
                <li key={team}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className={`truncate text-sm font-medium ${team === NO_TEAM ? 'italic text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {team === NO_TEAM ? t('roadmap.workload.noTeam') : team}
                    </span>
                    <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      <span>{t('roadmap.workload.ticketCount', { count: tickets })}</span>
                      {sp > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sp} SP</span>}
                    </div>
                  </div>
                  {sp > 0 && (
                    <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(sp / maxSP) * 100}%` }} />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {areas.map((a) => (
                      <span key={a} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {t(`roadmap.areas.${a}`)}
                      </span>
                    ))}
                    <span
                      className="ml-auto text-xs text-slate-400 dark:text-slate-500"
                      title={linked.map((f) => f.title).join(', ')}
                    >
                      {t('roadmap.featureCount', { count: featureIds.length })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title={t('roadmap.workload.perArea')} icon={<TrendingUp />}>
          <ul className="space-y-4">
            {areaStats.map(({ area, tickets, sp }) => {
              const AreaIcon = TICKET_AREA_META[area].icon
              return (
                <li key={area}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <AreaIcon className="h-3.5 w-3.5 text-slate-400" />
                      {t(`roadmap.areas.${area}`)}
                    </span>
                    <div className="flex items-center gap-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      <span>{t('roadmap.workload.ticketCount', { count: tickets })}</span>
                      {sp > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sp} SP</span>}
                    </div>
                  </div>
                  {sp > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(sp / maxAreaSP) * 100}%` }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {without.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {t('roadmap.workload.featuresWithoutTickets', { count: without.length })}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/70">
                    {without.map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && ', '}
                        <Link to={`/roadmap/${f.id}`} className="underline decoration-amber-400/50 underline-offset-2 hover:decoration-amber-600 dark:hover:decoration-amber-300">
                          {f.title}
                        </Link>
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
