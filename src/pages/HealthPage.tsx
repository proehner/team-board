import { useState } from 'react'
import { useStore } from '@/store'
import {
  AlertTriangle, CheckCircle2, Shield, TrendingUp, HeartPulse, ListChecks, Gauge,
  UserMinus, Zap, GraduationCap, BarChart3, SearchX, ChevronDown, ChevronUp, CalendarDays,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TeamMember, Skill } from '@/types'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Tabs from '@/components/ui/Tabs'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import SectionHeader from '@/components/ui/SectionHeader'
import Meter, { type MeterTone } from '@/components/dashboard/Meter'
import ScoreRing from '@/components/dashboard/ScoreRing'
import AvatarStack from '@/components/dashboard/AvatarStack'
import GoalMetSummary, { GoalMetBadge } from '@/components/dashboard/GoalMetSummary'
import { formatDate } from '@/utils/date'

function getBusFactor(skillId: string, memberSkills: { memberId: string; skillId: string; level: number }[], threshold = 3) {
  return memberSkills.filter((ms) => ms.skillId === skillId && ms.level >= threshold).length
}

type Severity = 'none' | 'critical' | 'atRisk' | 'ok'
function severityOf(factor: number): Severity {
  if (factor === 0) return 'none'
  if (factor === 1) return 'critical'
  if (factor === 2) return 'atRisk'
  return 'ok'
}

const SEVERITY_STYLE: Record<Severity, { chip: string; bar: string; dot: string; badge: 'danger' | 'warning' | 'success' }> = {
  none:     { chip: 'bg-red-600 text-white dark:bg-red-500',                                                  bar: 'bg-red-600 dark:bg-red-500',     dot: 'bg-red-600 dark:bg-red-500',         badge: 'danger' },
  critical: { chip: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25', bar: 'bg-red-300 dark:bg-red-400/60', dot: 'bg-red-300 dark:bg-red-400/60', badge: 'danger' },
  atRisk:   { chip: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25', bar: 'bg-amber-400', dot: 'bg-amber-400', badge: 'warning' },
  ok:       { chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25', bar: 'bg-emerald-500 dark:bg-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400', badge: 'success' },
}
const SEVERITIES: Severity[] = ['none', 'critical', 'atRisk', 'ok']

type HealthTab = 'busfactor' | 'workload' | 'absence' | 'development' | 'capacity' | 'actions'
type BusFilter = 'all' | 'critical' | 'atRisk' | 'ok'

const BUS_PAGE = 10

export default function HealthPage() {
  const { t } = useTranslation()

  const members = useStore((s) => s.members)
  const skills = useStore((s) => s.skills)
  const memberSkills = useStore((s) => s.memberSkills)
  const skillAreas = useStore((s) => s.skillAreas)
  const catById = new Map(skillAreas.flatMap((a) => a.categories.map((c) => [c.id, `${a.name} · ${c.name}`])))
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const retrospectives = useStore((s) => s.retrospectives)

  const activeMembers = members.filter((m) => m.isActive)
  const [absentMemberId, setAbsentMemberId] = useState<string | null>(null)
  const [tab, setTab] = useState<HealthTab>('busfactor')
  const [busFilter, setBusFilter] = useState<BusFilter>('all')
  const [busQuery, setBusQuery] = useState('')
  const [busExpanded, setBusExpanded] = useState(false)

  const ms = memberSkills as { memberId: string; skillId: string; level: number }[]

  const skillRisks = skills.map((sk) => {
    const factor = getBusFactor(sk.id, ms)
    const experts = ms
      .filter((m) => m.skillId === sk.id && m.level >= 3)
      .map((m) => activeMembers.find((am) => am.id === m.memberId))
      .filter(Boolean) as TeamMember[]
    return { skill: sk, factor, experts }
  }).sort((a, b) => a.factor - b.factor)

  const criticalSkills = skillRisks.filter((s) => s.factor <= 1)
  const atRiskSkills = skillRisks.filter((s) => s.factor === 2)
  const okSkills = skillRisks.filter((s) => s.factor >= 3)
  const severityCounts: Record<Severity, number> = {
    none: skillRisks.filter((s) => s.factor === 0).length,
    critical: skillRisks.filter((s) => s.factor === 1).length,
    atRisk: atRiskSkills.length,
    ok: okSkills.length,
  }

  const completedSprints = sprints
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))

  const sprintsWithVelocity = completedSprints.filter((s) => s.velocity !== undefined && s.velocity !== null && s.velocity > 0)
  const avgVelocity = sprintsWithVelocity.length
    ? Math.round(sprintsWithVelocity.reduce((s, sp) => s + (sp.velocity ?? 0), 0) / sprintsWithVelocity.length)
    : 0
  const maxVelocity = Math.max(...sprintsWithVelocity.map((s) => Math.max(s.velocity ?? 0, s.plannedPoints)), 1)
  // Fallback metric when no velocity is tracked: completed items
  const sprintsWithItems = completedSprints.filter((s) => (s.completedItems ?? 0) > 0)
  const useItems = sprintsWithVelocity.length === 0 && sprintsWithItems.length > 0
  const maxItems = Math.max(...sprintsWithItems.map((s) => Math.max(s.completedItems ?? 0, s.plannedItems ?? 0)), 1)
  const avgItems = sprintsWithItems.length
    ? Math.round(sprintsWithItems.reduce((s, sp) => s + (sp.completedItems ?? 0), 0) / sprintsWithItems.length)
    : 0

  const sprintsWithGoalMet = completedSprints.filter((s) => s.goalMet !== undefined && s.goalMet !== null)
  const goalMetCount = sprintsWithGoalMet.filter((s) => s.goalMet === 'Ja').length
  const goalPartialCount = sprintsWithGoalMet.filter((s) => s.goalMet === 'Teilweise').length
  const goalMetRate = sprintsWithGoalMet.length
    ? Math.round(((goalMetCount + goalPartialCount * 0.5) / sprintsWithGoalMet.length) * 100)
    : null

  const absentMember = absentMemberId ? activeMembers.find((m) => m.id === absentMemberId) : null
  const affectedAssignments = absentMemberId
    ? assignments.filter((a) => a.memberId === absentMemberId && !a.isSynthetic && !a.isArchived)
    : []
  const soleExpertise = absentMemberId
    ? skills.filter((sk) => {
        const bf = getBusFactor(sk.id, ms)
        const isExpert = ms.some((m) => m.memberId === absentMemberId && m.skillId === sk.id && m.level >= 3)
        return bf === 1 && isExpert
      })
    : []

  function getCoverCandidates(skill: Skill): TeamMember[] {
    return activeMembers.filter((m) =>
      m.id !== absentMemberId &&
      ms.some((x) => x.memberId === m.id && x.skillId === skill.id && x.level >= 2),
    )
  }

  const memberTotalsRaw = activeMembers.map((member) => ({
    member,
    total: skills.reduce((sum, sk) => sum + (ms.find((x) => x.memberId === member.id && x.skillId === sk.id)?.level ?? 0), 0),
  }))
  const teamAvgCapacity = activeMembers.length > 0
    ? memberTotalsRaw.reduce((s, m) => s + m.total, 0) / activeMembers.length
    : 0
  const teamMaxCapacity = Math.max(...memberTotalsRaw.map((m) => m.total), 1)
  const avgMarkerPct = teamMaxCapacity > 0 ? (teamAvgCapacity / teamMaxCapacity) * 100 : 0

  const memberCapacities = memberTotalsRaw
    .map(({ member, total }) => {
      const deviation = total - teamAvgCapacity
      const relDev = teamAvgCapacity > 0 ? deviation / teamAvgCapacity : 0
      const pct = (total / teamMaxCapacity) * 100
      const status = relDev >= -0.1 ? 'ok' : relDev >= -0.3 ? 'warning' : 'critical'
      return { member, total, deviation, pct, status }
    })
    .sort((a, b) => b.total - a.total)

  const devSuggestions = activeMembers.map((member) => {
    const suggestions = skills.map((sk) => {
      const myLevel = ms.find((x) => x.memberId === member.id && x.skillId === sk.id)?.level ?? 0
      const busFactor = getBusFactor(sk.id, ms)
      const teamMax = Math.max(...ms.filter((x) => x.skillId === sk.id).map((x) => x.level), 0)
      if (myLevel === 0 || myLevel >= 4) return null
      const isCritical = busFactor <= 1
      const hasGrowthRoom = myLevel < teamMax - 1
      if (!isCritical && !hasGrowthRoom) return null
      return {
        skill: sk,
        currentLevel: myLevel,
        targetLevel: Math.min(myLevel + 2, 5) as number,
        critical: isCritical,
        reason: isCritical ? t('health.criticalCompetency') : t('health.growthPotential'),
      }
    }).filter(Boolean) as { skill: Skill; currentLevel: number; targetLevel: number; critical: boolean; reason: string }[]
    return { member, suggestions }
  }).filter((d) => d.suggestions.length > 0)
  const totalSuggestions = devSuggestions.reduce((s, d) => s + d.suggestions.length, 0)

  const openActions = retrospectives
    .flatMap((r) => r.items
      .filter((i) => i.type === 'Aktionspunkt' && i.status !== 'Erledigt')
      .map((i) => ({ ...i, retroTitle: r.title, retroDate: r.date })),
    )
    .sort((a, b) => a.retroDate.localeCompare(b.retroDate))

  // ── Health score (same formula as before, split into its parts for display) ─
  const totalSkills = skills.length || 1
  const scoreParts = [
    { key: 'coverage', value: ((totalSkills - criticalSkills.length) / totalSkills) * 50, max: 50 },
    { key: 'risk',     value: atRiskSkills.length === 0 ? 20 : Math.max(0, 20 - atRiskSkills.length * 5), max: 20 },
    { key: 'actions',  value: openActions.length === 0 ? 20 : Math.max(0, 20 - openActions.length * 2), max: 20 },
    { key: 'base',     value: 10, max: 10 },
  ]
  const healthScore = Math.min(100, Math.round(scoreParts.reduce((s, p) => s + p.value, 0)))
  const scoreTone: 'emerald' | 'amber' | 'red' = healthScore >= 80 ? 'emerald' : healthScore >= 60 ? 'amber' : 'red'
  const scoreLabel = healthScore >= 80 ? t('health.scoreGood') : healthScore >= 60 ? t('health.scoreFair') : t('health.scorePoor')
  const scoreBadge: 'success' | 'warning' | 'danger' = scoreTone === 'emerald' ? 'success' : scoreTone === 'amber' ? 'warning' : 'danger'

  // ── Bus factor list filtering ──────────────────────────────────────────────
  const q = busQuery.trim().toLowerCase()
  const filteredRisks = skillRisks.filter(({ skill, factor }) => {
    if (busFilter === 'critical' && factor > 1) return false
    if (busFilter === 'atRisk' && factor !== 2) return false
    if (busFilter === 'ok' && factor < 3) return false
    if (q && !skill.name.toLowerCase().includes(q) && !(skill.categoryId && (catById.get(skill.categoryId) ?? '').toLowerCase().includes(q))) return false
    return true
  })
  const visibleRisks = busExpanded ? filteredRisks : filteredRisks.slice(0, BUS_PAGE)

  const tabItems: { value: HealthTab; label: string; icon: typeof Shield; count?: number }[] = [
    { value: 'busfactor',   label: t('health.tabBusFactor'),   icon: Shield,        count: criticalSkills.length || undefined },
    { value: 'workload',    label: t('health.tabDelivery'),    icon: Zap },
    { value: 'absence',     label: t('health.tabAbsence'),     icon: UserMinus },
    { value: 'development', label: t('health.tabDevelopment'), icon: GraduationCap, count: totalSuggestions || undefined },
    { value: 'capacity',    label: t('health.tabCapacity'),    icon: BarChart3 },
    { value: 'actions',     label: t('health.tabActions'),     icon: ListChecks,    count: openActions.length || undefined },
  ]

  return (
    <Page>
      <PageHeader icon={HeartPulse} title={t('health.title')} subtitle={t('health.subtitle')} />

      <div className="space-y-6">
        {/* ── Score + KPIs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <section className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center lg:col-span-2" aria-labelledby="health-score-heading">
            <ScoreRing value={healthScore} tone={scoreTone} label={t('health.healthScore')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="health-score-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('health.healthScore')}</h2>
                <Badge label={scoreLabel} variant={scoreBadge} dot />
              </div>
              <ul className="mt-3 space-y-2">
                {scoreParts.map((p) => (
                  <li key={p.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{t(`health.scorePart_${p.key}`)}</span>
                    <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                      {Math.round(p.value)}<span className="text-slate-400 dark:text-slate-500">/{p.max}</span>
                    </span>
                    <Meter
                      className="col-span-2"
                      value={(p.value / p.max) * 100}
                      size="xs"
                      tone={p.value / p.max >= 0.8 ? 'emerald' : p.value / p.max >= 0.5 ? 'amber' : 'red'}
                      label={t(`health.scorePart_${p.key}`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-3">
            <StatCard
              icon={Shield}
              tone={criticalSkills.length > 0 ? 'rose' : 'emerald'}
              label={t('health.criticalSkills')}
              value={criticalSkills.length}
              hint={t('health.ofSkills', { count: skills.length })}
            />
            <StatCard
              icon={AlertTriangle}
              tone="amber"
              label={t('health.atRisk')}
              value={atRiskSkills.length}
              hint={t('health.onlyTwoExperts')}
            />
            <StatCard
              icon={ListChecks}
              tone={openActions.length > 3 ? 'amber' : 'sky'}
              label={t('health.openActions')}
              value={openActions.length}
              hint={t('health.fromRetros')}
            />
            <StatCard
              icon={TrendingUp}
              tone="emerald"
              label={<span className="hyphens-auto break-words">{t('health.developmentSuggestions')}</span>}
              value={totalSuggestions}
              hint={t('health.inTotal')}
            />
          </div>
        </div>

        {/* ── Sections ─────────────────────────────────────────────────────── */}
        <div>
          <Tabs items={tabItems} value={tab} onChange={setTab} aria-label={t('health.title')} className="mb-5" />

          {/* Bus factor */}
          {tab === 'busfactor' && (
            <div className="space-y-4 animate-fade-in">
              <div className="surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('health.busFactor')}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('health.busFactorHint')}</p>
                </div>
                {skillRisks.length > 0 && (
                  <>
                    <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={SEVERITIES.map((s) => `${t(`health.severity_${s}`)}: ${severityCounts[s]}`).join(', ')}>
                      {SEVERITIES.filter((s) => severityCounts[s] > 0).map((s) => (
                        <div
                          key={s}
                          className={`h-full first:rounded-l-full last:rounded-r-full ${SEVERITY_STYLE[s].bar}`}
                          style={{ width: `${(severityCounts[s] / skillRisks.length) * 100}%` }}
                          title={`${t(`health.severity_${s}`)}: ${severityCounts[s]}`}
                        />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                      {SEVERITIES.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className={`h-2 w-2 rounded-full ${SEVERITY_STYLE[s].dot}`} aria-hidden />
                          {t(`health.severity_${s}`)}
                          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{severityCounts[s]}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs<BusFilter>
                  variant="pills"
                  size="sm"
                  value={busFilter}
                  onChange={(v) => { setBusFilter(v); setBusExpanded(false) }}
                  aria-label={t('common.filter')}
                  items={[
                    { value: 'all', label: t('common.all'), count: skillRisks.length },
                    { value: 'critical', label: t('health.status_critical'), count: criticalSkills.length },
                    { value: 'atRisk', label: t('health.status_atRisk'), count: atRiskSkills.length },
                    { value: 'ok', label: t('health.status_ok'), count: okSkills.length },
                  ]}
                />
                <SearchInput
                  size="sm"
                  value={busQuery}
                  onChange={(v) => { setBusQuery(v); setBusExpanded(false) }}
                  placeholder={t('health.searchSkill')}
                  className="w-full sm:w-60"
                />
              </div>

              <div className="surface overflow-hidden">
                {filteredRisks.length === 0 ? (
                  skillRisks.length === 0 ? (
                    <EmptyState compact icon={<Shield />} title={t('health.noSuggestions')} />
                  ) : (
                    <EmptyState
                      compact
                      icon={<SearchX />}
                      title={t('common.noResults')}
                      action={<Button size="sm" variant="secondary" onClick={() => { setBusFilter('all'); setBusQuery('') }}>{t('common.resetFilters')}</Button>}
                    />
                  )
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleRisks.map(({ skill, factor, experts }) => {
                        const sev = severityOf(factor)
                        const category = skill.categoryId ? (catById.get(skill.categoryId) ?? '') : ''
                        return (
                          <li key={skill.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${SEVERITY_STYLE[sev].chip}`}
                              title={t('health.expertCount', { count: factor })}
                            >
                              {factor}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{skill.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                <span className={sev === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : sev === 'atRisk' ? 'text-amber-700 dark:text-amber-300' : 'text-red-600 dark:text-red-400'}>
                                  {t(`health.status_${sev === 'none' ? 'critical' : sev}`)}
                                </span>
                                {category && <span> · {category}</span>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {experts.length > 0 ? (
                                <>
                                  <AvatarStack people={experts} max={3} />
                                  <span className="hidden max-w-[11rem] truncate text-xs text-slate-500 dark:text-slate-400 md:inline" title={experts.map((m) => m.name).join(', ')}>
                                    {experts.map((m) => m.name.split(' ')[0]).join(', ')}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">{t('health.noOneLevel3')}</span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    {filteredRisks.length > BUS_PAGE && (
                      <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          fullWidth
                          iconRight={busExpanded ? <ChevronUp /> : <ChevronDown />}
                          onClick={() => setBusExpanded((v) => !v)}
                        >
                          {busExpanded ? t('common.showLess') : t('health.showMoreCount', { count: filteredRisks.length - BUS_PAGE })}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sprint delivery */}
          {tab === 'workload' && (
            <div className="surface p-5 animate-fade-in">
              {completedSprints.length === 0 ? (
                <EmptyState compact icon={<Zap />} title={t('health.noCompletedSprints')} />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      {sprintsWithGoalMet.length > 0 ? (
                        <GoalMetSummary values={sprintsWithGoalMet.map((s) => s.goalMet)} rate={goalMetRate} />
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('health.noGoalData')}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {useItems ? t('health.avgCompletedItems') : t('health.avgVelocity')}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
                        {useItems ? (avgItems || '—') : avgVelocity > 0 ? `${avgVelocity} SP` : '—'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <SectionHeader title={t('health.lastSprints', { count: Math.min(completedSprints.length, 6) })} />
                    <ul className="space-y-3">
                      {completedSprints.slice(0, 6).map((sp) => {
                        const velocity = sp.velocity ?? 0
                        const planned = sp.plannedPoints
                        const value = useItems ? (sp.completedItems ?? 0) : velocity
                        const max = useItems ? maxItems : maxVelocity
                        const plannedMarker = useItems
                          ? (sp.plannedItems ? (sp.plannedItems / maxItems) * 100 : undefined)
                          : (planned > 0 ? Math.min((planned / maxVelocity) * 100, 100) : undefined)
                        const hitGoal = useItems
                          ? sp.goalMet === 'Ja'
                          : velocity > 0 && planned > 0 && velocity >= planned
                        return (
                          <li key={sp.id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 sm:grid-cols-[9rem_1fr_4.5rem_6.5rem]">
                            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300" title={sp.name}>{sp.name}</span>
                            <Meter
                              value={max > 0 ? Math.min((value / max) * 100, 100) : 0}
                              tone={hitGoal ? 'emerald' : 'indigo'}
                              neutralTrack
                              size="md"
                              marker={plannedMarker}
                              markerLabel={t('dashboard.planned')}
                            />
                            <span className="text-right text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                              {value > 0 ? (useItems ? t('dashboard.itemsCount', { count: value }) : `${value} SP`) : '—'}
                            </span>
                            <span className="hidden text-right sm:block">
                              {sp.goalMet ? <GoalMetBadge value={sp.goalMet} /> : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    {completedSprints.slice(0, 6).some((sp) => (useItems ? (sp.plannedItems ?? 0) : sp.plannedPoints) > 0) && (
                      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-block h-3 w-0.5 bg-slate-700/70 dark:bg-slate-200/70" aria-hidden />
                        {t('health.plannedMarkerNote')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Absence simulator */}
          {tab === 'absence' && (
            <div className="space-y-4 animate-fade-in">
              <div className="surface p-5">
                <label htmlFor="absence-member" className="form-label">{t('health.selectMember')}</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Select
                    id="absence-member"
                    value={absentMemberId ?? ''}
                    onChange={(e) => setAbsentMemberId(e.target.value || null)}
                    wrapperClassName="sm:max-w-xs"
                  >
                    <option value="">{t('health.selectMemberPlaceholder')}</option>
                    {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('health.absenceHint')}</p>
                </div>
              </div>

              {!absentMember ? (
                <div className="surface">
                  <EmptyState compact icon={<UserMinus />} title={t('health.absenceEmptyTitle')} description={t('health.absenceEmptyDescription')} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="surface p-5">
                    <SectionHeader title={t('health.affectedAssignments', { count: affectedAssignments.length })} icon={<CalendarDays />} />
                    {affectedAssignments.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('health.noActiveAssignments')}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {affectedAssignments.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/10 dark:ring-amber-400/20">
                            <span className="text-sm font-medium text-amber-900 dark:text-amber-200">{a.type}</span>
                            <span className="text-xs tabular-nums text-amber-700 dark:text-amber-300">{formatDate(a.startDate)} – {formatDate(a.endDate)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="surface p-5">
                    <SectionHeader title={t('health.soleExpertise', { count: soleExpertise.length })} icon={<Shield />} />
                    {soleExpertise.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('health.noKnowledgeMonopoly')}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {soleExpertise.map((sk) => {
                          const covers = getCoverCandidates(sk)
                          return (
                            <li key={sk.id} className="rounded-lg bg-red-50 p-3 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/10 dark:ring-red-400/20">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className="text-sm font-semibold text-red-800 dark:text-red-200">{sk.name}</span>
                                <span className="text-xs text-red-600/80 dark:text-red-300/80">{sk.categoryId ? (catById.get(sk.categoryId) ?? '') : ''}</span>
                              </div>
                              {covers.length > 0 ? (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs text-slate-600 dark:text-slate-400">{t('health.canFillIn')}</span>
                                  {covers.map((m) => {
                                    const lvl = ms.find((x) => x.memberId === m.id && x.skillId === sk.id)?.level ?? 0
                                    return (
                                      <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pl-0.5 pr-2 ring-1 ring-inset ring-red-200 dark:bg-slate-900 dark:ring-red-400/20">
                                        <Avatar name={m.name} color={m.avatarColor} size="2xs" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">{m.name.split(' ')[0]}</span>
                                        <span className="text-2xs font-medium text-slate-400 dark:text-slate-500">L{lvl}</span>
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {t('health.noReplacementAvailable')}
                                </p>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Development suggestions */}
          {tab === 'development' && (
            <div className="animate-fade-in">
              {devSuggestions.length === 0 ? (
                <div className="surface">
                  <EmptyState compact icon={<GraduationCap />} title={t('health.noSuggestions')} />
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-indigo-500 dark:bg-indigo-400" />{t('health.levelCurrent')}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-indigo-100 ring-1 ring-inset ring-indigo-300 dark:bg-indigo-500/15 dark:ring-indigo-500/40" />{t('health.levelTarget')}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {devSuggestions.map(({ member, suggestions }) => (
                      <div key={member.id} className="surface p-4">
                        <div className="mb-3 flex items-center gap-2.5">
                          <Avatar name={member.name} color={member.avatarColor} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{member.name}</span>
                          <Badge label={t('health.suggestionCount', { count: suggestions.length })} variant="indigo" />
                        </div>
                        <ul className="space-y-2">
                          {suggestions.map(({ skill, currentLevel, targetLevel, critical, reason }) => (
                            <li key={skill.id} className="flex items-center gap-3">
                              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300" title={skill.name}>{skill.name}</span>
                              <span className="flex shrink-0 items-center gap-0.5" aria-label={`${currentLevel} → ${targetLevel}`}>
                                {Array.from({ length: 5 }, (_, i) => (
                                  <span
                                    key={i}
                                    className={`h-3 w-3 rounded-sm ${
                                      i < currentLevel
                                        ? 'bg-indigo-500 dark:bg-indigo-400'
                                        : i < targetLevel
                                          ? 'bg-indigo-100 ring-1 ring-inset ring-indigo-300 dark:bg-indigo-500/15 dark:ring-indigo-500/40'
                                          : 'bg-slate-100 dark:bg-slate-800'
                                    }`}
                                  />
                                ))}
                              </span>
                              <Badge label={reason} variant={critical ? 'danger' : 'info'} className="hidden shrink-0 sm:inline-flex" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Skill capacity */}
          {tab === 'capacity' && (
            <div className="surface p-5 animate-fade-in">
              {skills.length === 0 || activeMembers.length === 0 ? (
                <EmptyState compact icon={<Gauge />} title={t('health.noSuggestions')} />
              ) : (
                <>
                  <ul className="space-y-3.5">
                    {memberCapacities.map(({ member, total, deviation, pct, status }) => {
                      const tone: MeterTone = status === 'ok' ? 'emerald' : status === 'warning' ? 'amber' : 'red'
                      const devColor = status === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : status === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      const dev = Math.round(deviation)
                      return (
                        <li key={member.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11rem_1fr_4.5rem_8.5rem]">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar name={member.name} color={member.avatarColor} size="xs" />
                            <span className="truncate text-sm text-slate-700 dark:text-slate-300" title={member.name}>{member.name}</span>
                          </div>
                          <Meter
                            className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                            value={pct}
                            tone={tone}
                            neutralTrack
                            size="md"
                            marker={activeMembers.length > 1 ? avgMarkerPct : undefined}
                            markerLabel={t('health.teamAverage')}
                          />
                          <span className="hidden text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300 sm:block">
                            {t('health.points', { count: total })}
                          </span>
                          <span className={`text-right text-xs tabular-nums ${devColor}`}>
                            <span className="sm:hidden">{t('health.points', { count: total })} · </span>
                            {dev >= 0 ? t('health.pointsAbove', { count: dev }) : t('health.pointsBelow', { count: Math.abs(dev) })}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span className="inline-block h-3 w-0.5 bg-slate-700/70 dark:bg-slate-200/70" aria-hidden />
                    {t('health.skillCapacityNote', { avg: Math.round(teamAvgCapacity), count: skills.length })}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Open retro actions */}
          {tab === 'actions' && (
            <div className="surface overflow-hidden animate-fade-in">
              {openActions.length === 0 ? (
                <EmptyState compact icon={<CheckCircle2 />} title={t('health.allActionsDone')} />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {openActions.map((item) => {
                    const assignee = item.assigneeId ? members.find((m) => m.id === item.assigneeId) : null
                    return (
                      <li key={item.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 dark:text-slate-200">{item.text}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.retroTitle}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                          {assignee && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                              <Avatar name={assignee.name} color={assignee.avatarColor} size="2xs" />
                              {assignee.name.split(' ')[0]}
                            </span>
                          )}
                          <Badge
                            label={t(`retroItemStatus.${item.status}`)}
                            variant={item.status === 'InBearbeitung' ? 'info' : 'default'}
                            dot
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
