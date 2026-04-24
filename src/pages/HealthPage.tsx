import { useState } from 'react'
import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import { AlertTriangle, CheckCircle, Shield, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TeamMember, Skill } from '@/types'

function getBusFactor(skillId: string, memberSkills: { memberId: string; skillId: string; level: number }[], threshold = 3) {
  return memberSkills.filter((ms) => ms.skillId === skillId && ms.level >= threshold).length
}

function getRiskColor(factor: number): string {
  if (factor <= 1) return 'text-red-600 bg-red-50 border-red-200'
  if (factor === 2) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-green-600 bg-green-50 border-green-200'
}

export default function HealthPage() {
  const { t } = useTranslation()

  function getRiskLabel(factor: number): string {
    if (factor === 0) return t('skillLevel.0')
    if (factor === 1) return t('health.critical')
    if (factor === 2) return t('health.atRisk')
    return 'OK'
  }

  const members = useStore((s) => s.members)
  const skills = useStore((s) => s.skills)
  const memberSkills = useStore((s) => s.memberSkills)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const retrospectives = useStore((s) => s.retrospectives)

  const activeMembers = members.filter((m) => m.isActive)
  const [absentMemberId, setAbsentMemberId] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('busfactor')

  function toggleSection(s: string) {
    setExpandedSection((prev) => (prev === s ? null : s))
  }

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

  const completedSprints = sprints
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))

  const sprintsWithVelocity = completedSprints.filter((s) => s.velocity !== undefined && s.velocity > 0)
  const avgVelocity = sprintsWithVelocity.length
    ? Math.round(sprintsWithVelocity.reduce((s, sp) => s + (sp.velocity ?? 0), 0) / sprintsWithVelocity.length)
    : 0
  const maxVelocity = Math.max(...sprintsWithVelocity.map((s) => Math.max(s.velocity ?? 0, s.plannedPoints)), 1)

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
        reason: isCritical ? t('health.criticalCompetency') : t('health.growthPotential'),
      }
    }).filter(Boolean) as { skill: Skill; currentLevel: number; targetLevel: number; reason: string }[]
    return { member, suggestions }
  }).filter((d) => d.suggestions.length > 0)

  const openActions = retrospectives
    .flatMap((r) => r.items
      .filter((i) => i.type === 'Aktionspunkt' && i.status !== 'Erledigt')
      .map((i) => ({ ...i, retroTitle: r.title, retroDate: r.date })),
    )
    .sort((a, b) => a.retroDate.localeCompare(b.retroDate))

  const totalSkills = skills.length || 1
  const healthScore = Math.min(100, Math.round(
    ((totalSkills - criticalSkills.length) / totalSkills) * 50 +
    (atRiskSkills.length === 0 ? 20 : Math.max(0, 20 - atRiskSkills.length * 5)) +
    (openActions.length === 0 ? 20 : Math.max(0, 20 - openActions.length * 2)) +
    10,
  ))
  const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600'
  const healthBg = healthScore >= 80 ? 'bg-green-50 border-green-200' : healthScore >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('health.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('health.subtitle')}</p>
        </div>
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${healthBg}`}>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('health.healthScore')}</span>
          <span className={`text-2xl font-bold ${healthColor}`}>{healthScore}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">/ 100</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Shield className="w-5 h-5 text-red-500" />} label={t('health.criticalSkills')} value={criticalSkills.length} sub={t('health.ofSkills', { count: skills.length })} highlight={criticalSkills.length > 0} />
        <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} label={t('health.atRisk')} value={atRiskSkills.length} sub={t('health.onlyTwoExperts')} highlight={atRiskSkills.length > 2} />
        <SummaryCard icon={<CheckCircle className="w-5 h-5 text-indigo-500" />} label={t('health.openActions')} value={openActions.length} sub={t('health.fromRetros')} highlight={openActions.length > 3} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-500" />} label={t('health.developmentSuggestions')} value={devSuggestions.reduce((s, d) => s + d.suggestions.length, 0)} sub={t('health.inTotal')} highlight={false} />
      </div>

      {/* Bus Factor */}
      <Section id="busfactor" title={t('health.busFactor')} badge={criticalSkills.length > 0 ? `${criticalSkills.length} ${t('health.critical')}` : undefined} badgeColor="red" expanded={expandedSection === 'busfactor'} onToggle={() => toggleSection('busfactor')}>
        <div className="space-y-2 pt-2">
          {skillRisks.map(({ skill, factor, experts }) => (
            <div key={skill.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${getRiskColor(factor)}`}>
                {factor}× {getRiskLabel(factor)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{skill.name}</span>
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{skill.categories.join(', ')}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {experts.map((m) => (
                  <div key={m.id} className="flex items-center gap-1">
                    <Avatar name={m.name} color={m.avatarColor} size="xs" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{m.name.split(' ')[0]}</span>
                  </div>
                ))}
                {experts.length === 0 && <span className="text-xs text-red-400">{t('health.noOneLevel3')}</span>}
              </div>
            </div>
          ))}
          {skillRisks.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">{t('health.noSuggestions')}</p>}
        </div>
      </Section>

      {/* Sprint Delivery */}
      <Section id="workload" title={t('health.sprintDelivery')} expanded={expandedSection === 'workload'} onToggle={() => toggleSection('workload')}>
        {completedSprints.length === 0 ? (
          <p className="text-sm text-slate-400 pt-2">{t('health.noCompletedSprints')}</p>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Goal achievement summary */}
            {sprintsWithGoalMet.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{t('health.goalAchievementRate')}:</span>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-green-600 font-medium">{goalMetCount}× {t('sprintDetail.goalMet_Ja')}</span>
                  <span className="text-amber-600 font-medium">{goalPartialCount}× {t('sprintDetail.goalMet_Teilweise')}</span>
                  <span className="text-red-500 font-medium">{sprintsWithGoalMet.filter((s) => s.goalMet === 'Nein').length}× {t('sprintDetail.goalMet_Nein')}</span>
                  {goalMetRate !== null && <span className="text-slate-400">({goalMetRate}%)</span>}
                </div>
              </div>
            )}
            {/* Velocity bars */}
            <div className="space-y-2.5">
              {completedSprints.slice(0, 6).map((sp) => {
                const velocity = sp.velocity ?? 0
                const planned = sp.plannedPoints
                const barPct = maxVelocity > 0 ? Math.min((velocity / maxVelocity) * 100, 100) : 0
                const plannedPct = maxVelocity > 0 ? Math.min((planned / maxVelocity) * 100, 100) : 0
                const hitGoal = velocity > 0 && planned > 0 && velocity >= planned
                return (
                  <div key={sp.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-24 shrink-0 truncate">{sp.name}</span>
                    <div className="flex-1 relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      {planned > 0 && (
                        <div className="absolute inset-y-0 left-0 bg-slate-200 dark:bg-slate-700 rounded-full" style={{ width: `${plannedPct}%` }} />
                      )}
                      {velocity > 0 && (
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${hitGoal ? 'bg-green-400' : 'bg-indigo-400'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-14 text-right shrink-0">
                      {velocity > 0 ? `${velocity} SP` : '—'}
                    </span>
                    {sp.goalMet && (
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${
                        sp.goalMet === 'Ja' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : sp.goalMet === 'Teilweise' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {t(`sprintDetail.goalMet_${sp.goalMet}`)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {avgVelocity > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('health.avgVelocity')}: {avgVelocity} SP</p>
            )}
          </div>
        )}
      </Section>

      {/* Absence Simulator */}
      <Section id="absence" title={t('health.absenceSimulator')} expanded={expandedSection === 'absence'} onToggle={() => toggleSection('absence')}>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('health.selectMember')}</label>
            <select value={absentMemberId ?? ''} onChange={(e) => setAbsentMemberId(e.target.value || null)} className="form-input text-sm">
              <option value="">{t('health.selectMemberPlaceholder')}</option>
              {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {absentMember && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('health.affectedAssignments', { count: affectedAssignments.length })}</p>
                {affectedAssignments.length === 0
                  ? <p className="text-xs text-slate-400">{t('health.noActiveAssignments')}</p>
                  : affectedAssignments.map((a) => (
                      <div key={a.id} className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex justify-between mb-1">
                        <span className="font-medium text-amber-800">{a.type}</span>
                        <span className="text-amber-600">{a.startDate} – {a.endDate}</span>
                      </div>
                    ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('health.soleExpertise', { count: soleExpertise.length })}</p>
                {soleExpertise.length === 0
                  ? <p className="text-xs text-green-600">{t('health.noKnowledgeMonopoly')}</p>
                  : soleExpertise.map((sk) => {
                      const covers = getCoverCandidates(sk)
                      return (
                        <div key={sk.id} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs font-semibold text-red-700">{sk.name}</span>
                            <span className="text-xs text-red-400">{sk.categories.join(', ')}</span>
                          </div>
                          {covers.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-slate-500 dark:text-slate-400">{t('health.canFillIn')}</span>
                              {covers.map((m) => {
                                const lvl = ms.find((x) => x.memberId === m.id && x.skillId === sk.id)?.level ?? 0
                                return (
                                  <div key={m.id} className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 border border-red-100 dark:border-red-900">
                                    <Avatar name={m.name} color={m.avatarColor} size="xs" />
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{m.name.split(' ')[0]}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">Lvl {lvl}</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : <p className="text-xs text-red-500">{t('health.noReplacement')}</p>}
                        </div>
                      )
                    })}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Development Suggestions */}
      <Section id="development" title={t('health.developmentSuggestionsIndividual')} badge={devSuggestions.length > 0 ? `${devSuggestions.reduce((s, d) => s + d.suggestions.length, 0)} ${t('health.suggestions')}` : undefined} badgeColor="indigo" expanded={expandedSection === 'development'} onToggle={() => toggleSection('development')}>
        {devSuggestions.length === 0
          ? <p className="text-sm text-slate-400 py-4 text-center">{t('health.noSuggestions')}</p>
          : <div className="space-y-4 pt-2">
              {devSuggestions.map(({ member, suggestions }) => (
                <div key={member.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{member.name}</span>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    {suggestions.map(({ skill, currentLevel, targetLevel, reason }) => (
                      <div key={skill.id} className="flex items-center gap-3 text-xs">
                        <span className="flex-1 text-slate-700 dark:text-slate-300">{skill.name}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className={`w-3 h-3 rounded-sm ${i < currentLevel ? 'bg-indigo-400' : i < targetLevel ? 'bg-indigo-100 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700' : 'bg-slate-100 dark:bg-slate-800'}`} />
                          ))}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 ${reason === t('health.criticalCompetency') ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>}
      </Section>

      {/* Skill Capacity */}
      <Section id="capacity" title={t('health.skillCapacity')} expanded={expandedSection === 'capacity'} onToggle={() => toggleSection('capacity')}>
        {skills.length === 0 || activeMembers.length === 0 ? (
          <p className="text-sm text-slate-400 pt-2">{t('health.noSuggestions')}</p>
        ) : (
          <div className="space-y-3 pt-2">
            {memberCapacities.map(({ member, total, deviation, pct, status }) => {
              const barColor = status === 'ok' ? 'bg-green-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
              const devColor = status === 'ok' ? 'text-green-600 dark:text-green-400' : status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
              const devLabel = deviation >= 0
                ? `+${Math.round(deviation)} Pkt. über Ø`
                : `${Math.round(deviation)} Pkt. unter Ø`
              return (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-36 shrink-0">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{member.name.split(' ')[0]}</span>
                  </div>
                  <div className="flex-1 relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    {activeMembers.length > 1 && (
                      <div className="absolute inset-y-0 w-px bg-slate-400 dark:bg-slate-500" style={{ left: `${avgMarkerPct}%` }} />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-14 text-right shrink-0">
                    {total} Pkt.
                  </span>
                  <span className={`text-xs shrink-0 w-32 text-right ${devColor}`}>
                    {devLabel}
                  </span>
                </div>
              )
            })}
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
              {t('health.skillCapacityNote', { avg: Math.round(teamAvgCapacity), count: skills.length })}
            </p>
          </div>
        )}
      </Section>

      {/* Open Action Items */}
      <Section id="actions" title={t('health.openRetroActions')} badge={openActions.length > 0 ? `${openActions.length} ${t('health.open')}` : `0 ${t('health.open')}`} badgeColor={openActions.length > 0 ? 'amber' : 'green'} expanded={expandedSection === 'actions'} onToggle={() => toggleSection('actions')}>
        {openActions.length === 0
          ? <p className="text-sm text-green-600 py-2 pt-2">{t('health.allActionsDone')}</p>
          : <div className="space-y-2 pt-2">
              {openActions.map((item) => {
                const assignee = item.assigneeId ? members.find((m) => m.id === item.assigneeId) : null
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200">{item.text}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{item.retroTitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignee && (
                        <div className="flex items-center gap-1">
                          <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{assignee.name.split(' ')[0]}</span>
                        </div>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${item.status === 'InBearbeitung' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{t(`retroItemStatus.${item.status}`)}</span>
                    </div>
                  </div>
                )
              })}
            </div>}
      </Section>
    </div>
  )
}

function SummaryCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: number; sub: string; highlight: boolean }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 ${highlight ? 'border-amber-300' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span></div>
      <p className={`text-2xl font-bold ${highlight ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}`}>{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ id: _id, title, badge, badgeColor = 'slate', expanded, onToggle, children }: { id: string; title: string; badge?: string; badgeColor?: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  const colorMap: Record<string, string> = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-green-100 text-green-700', indigo: 'bg-indigo-100 text-indigo-700', slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' }
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
          {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorMap[badgeColor] ?? colorMap.slate}`}>{badge}</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800">{children}</div>}
    </div>
  )
}
