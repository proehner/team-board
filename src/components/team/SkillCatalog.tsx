import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Info, Pencil, SearchX, Star, Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import EmptyState from '@/components/ui/EmptyState'
import Tabs from '@/components/ui/Tabs'
import type { MemberSkill, Skill, SkillLevel, TeamMember } from '@/types'
import { LEVEL_FILL, RISK_DOT, SKILL_LEVELS, levelText, type SkillRisk } from './skillLevels'
import type { SkillGroups } from './CompetencyMatrix'

type CatalogSortKey = 'name' | 'avg' | 'coverage'

const MAX_VISIBLE_DOTS = 9
const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').substring(0, 2)

interface SkillCatalogProps {
  grouped: SkillGroups
  uncategorised: Skill[]
  totalSkills: number
  memberSkills: MemberSkill[]
  members: TeamMember[]
  getSkillRisk: (skillId: string) => SkillRisk
  onEdit: (sk: Skill) => void
  onDelete: (sk: Skill) => void
  onAdd: () => void
  onResetFilters: () => void
  canWrite: boolean
}

export default function SkillCatalog({
  grouped, uncategorised, totalSkills, memberSkills, members, getSkillRisk, onEdit, onDelete, onAdd, onResetFilters, canWrite,
}: SkillCatalogProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<CatalogSortKey>('name')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Set<string>>(new Set())

  const toggle = (setter: typeof setExpandedIds) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleExpand = toggle(setExpandedIds)
  const toggleArea = toggle(setCollapsedAreaIds)

  if (totalSkills === 0) {
    return (
      <div className="surface">
        <EmptyState
          icon={<Star />}
          title={t('competencies.noSkills')}
          description={t('competencies.noSkillsSubtitle')}
          action={canWrite ? <Button variant="primary" onClick={onAdd}>{t('competencies.addSkill')}</Button> : undefined}
        />
      </div>
    )
  }

  if (grouped.length === 0 && uncategorised.length === 0) {
    return (
      <div className="surface">
        <EmptyState
          icon={<SearchX />}
          title={t('common.noResults')}
          description={t('competencies.noResultsHint')}
          action={<Button variant="secondary" onClick={onResetFilters}>{t('common.resetFilters')}</Button>}
        />
      </div>
    )
  }

  function getStats(skillId: string) {
    const ratings = memberSkills.filter((ms) => ms.skillId === skillId && ms.level > 0)
    const avgLevel = ratings.length > 0 ? ratings.reduce((s, ms) => s + ms.level, 0) / ratings.length : 0
    const expertCount = ratings.filter((ms) => ms.level >= 4).length
    return { ratedCount: ratings.length, avgLevel, expertCount }
  }

  function sortSkills(skills: Skill[]): Skill[] {
    return [...skills].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      const sa = getStats(a.id)
      const sb = getStats(b.id)
      if (sortKey === 'avg') return sb.avgLevel - sa.avgLevel || a.name.localeCompare(b.name)
      if (sortKey === 'coverage') return sb.ratedCount - sa.ratedCount || a.name.localeCompare(b.name)
      return 0
    })
  }

  const renderRow = (sk: Skill) => (
    <SkillRow
      key={sk.id}
      sk={sk}
      risk={getSkillRisk(sk.id)}
      stats={getStats(sk.id)}
      members={members}
      memberSkills={memberSkills}
      expanded={expandedIds.has(sk.id)}
      onToggle={() => toggleExpand(sk.id)}
      onEdit={() => onEdit(sk)}
      onDelete={() => onDelete(sk)}
      canWrite={canWrite}
    />
  )

  const countBadge = (n: number) => (
    <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">{n}</span>
  )

  return (
    <div className="space-y-6">
      {/* Sort + legend */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.sortBy')}</span>
          <Tabs<CatalogSortKey>
            variant="segmented"
            size="sm"
            value={sortKey}
            onChange={setSortKey}
            aria-label={t('common.sortBy')}
            items={[
              { value: 'name', label: t('competencies.sortName') },
              { value: 'avg', label: t('competencies.sortAvg') },
              { value: 'coverage', label: t('competencies.sortCoverage') },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          {SKILL_LEVELS.map((l) => (
            <span key={l} className="inline-flex items-center gap-1">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${LEVEL_FILL[l]}`}>{levelText(l)}</span>
              {t(`skillLevel.${l}`)}
            </span>
          ))}
        </div>
      </div>

      {grouped.map(({ area, cats }) => {
        const isCollapsed = collapsedAreaIds.has(area.id)
        const skillCount = cats.reduce((s, c) => s + c.skills.length, 0)
        return (
          <section key={area.id}>
            <button
              type="button"
              onClick={() => toggleArea(area.id)}
              aria-expanded={!isCollapsed}
              className="group mb-2.5 flex w-full items-center gap-2 rounded-md text-left"
            >
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 ${isCollapsed ? '' : 'rotate-90'}`} />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{area.name}</h2>
              {countBadge(skillCount)}
              <span className="ml-1 h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </button>

            {!isCollapsed && (
              <div className="surface overflow-hidden">
                {cats.map(({ cat, skills }, catIdx) => (
                  <div key={cat.id} className={catIdx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}>
                    <div className="flex items-center gap-2 bg-slate-50/80 px-4 py-2 dark:bg-slate-800/40">
                      <span className="section-label">{cat.name}</span>
                      <span className="text-2xs tabular-nums text-slate-400 dark:text-slate-500">{skills.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">{sortSkills(skills).map(renderRow)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {uncategorised.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center gap-2 pl-6">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('competencies.uncategorised')}</h2>
            {countBadge(uncategorised.length)}
            <span className="ml-1 h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="surface divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {sortSkills(uncategorised).map(renderRow)}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Skill row ────────────────────────────────────────────────────────────────

function SkillRow({
  sk, risk, stats, members, memberSkills, expanded, onToggle, onEdit, onDelete, canWrite,
}: {
  sk: Skill
  risk: SkillRisk
  stats: { ratedCount: number; avgLevel: number; expertCount: number }
  members: TeamMember[]
  memberSkills: MemberSkill[]
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const { ratedCount, avgLevel, expertCount } = stats

  const memberLevelData = members
    .map((m) => ({
      member: m,
      level: (memberSkills.find((ms) => ms.memberId === m.id && ms.skillId === sk.id)?.level ?? 0) as SkillLevel,
    }))
    .sort((a, b) => a.member.name.localeCompare(b.member.name))

  const visibleDots = memberLevelData.slice(0, MAX_VISIBLE_DOTS)
  const hiddenCount = memberLevelData.length - MAX_VISIBLE_DOTS

  return (
    <div>
      {/* Whole row toggles the detail view (keyboard: chevron button) */}
      <div
        onClick={onToggle}
        className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${expanded ? 'bg-slate-50/70 dark:bg-slate-800/30' : ''}`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${risk !== 'none' ? RISK_DOT[risk] : ''}`}
          title={risk !== 'none' ? t(`competencies.risk_${risk}_hint`) : undefined}
        />

        <div className="flex w-32 min-w-0 shrink-0 items-center gap-1.5 sm:w-48">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={sk.name}>{sk.name}</span>
          {sk.description && (
            <span title={sk.description} className="shrink-0 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {/* Member level dots */}
        <div className="flex flex-1 items-center gap-1 overflow-hidden">
          {visibleDots.map(({ member, level }) => (
            <span
              key={member.id}
              className={`flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full text-[9px] font-bold ${LEVEL_FILL[level]}`}
              title={`${member.name}: ${level}/5 · ${t(`skillLevel.${level}`)}`}
            >
              {initials(member.name)}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="ml-0.5 shrink-0 text-2xs text-slate-400 dark:text-slate-500">+{hiddenCount}</span>
          )}
        </div>

        {/* Stats */}
        <div className="hidden shrink-0 items-center gap-4 text-xs sm:flex">
          <span className="w-10 text-right tabular-nums text-slate-500 dark:text-slate-400" title={t('competencies.coverageTitle')}>
            {ratedCount}/{members.length}
          </span>
          <span
            className={`w-12 text-right font-semibold tabular-nums ${
              avgLevel >= 4 ? 'text-indigo-600 dark:text-indigo-300' : avgLevel >= 2 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
            }`}
            title={t('competencies.avgTitle')}
          >
            {avgLevel > 0 ? `Ø ${avgLevel.toFixed(1)}` : '–'}
          </span>
          <span className="flex w-9 items-center gap-0.5 font-medium text-indigo-500 dark:text-indigo-400" title={t('competencies.expertsTitle')}>
            {expertCount > 0 && (<><Star className="h-3 w-3 shrink-0 fill-current" /> {expertCount}</>)}
          </span>
        </div>

        {canWrite && (
          <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <IconButton size="xs" icon={<Pencil />} label={t('competencies.editSkill')} onClick={onEdit} />
            <IconButton size="xs" variant="danger" icon={<Trash2 />} label={t('competencies.removeSkill')} onClick={onDelete} />
          </div>
        )}

        <IconButton
          size="xs"
          icon={<ChevronRight className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />}
          label={expanded ? t('common.showLess') : t('common.details')}
          aria-expanded={expanded}
          onClick={(e) => { e.stopPropagation(); onToggle() }}
        />
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 animate-fade-in dark:border-slate-800 dark:bg-slate-800/20">
          {sk.description && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{sk.description}</p>}
          <div className="flex flex-wrap gap-2">
            {memberLevelData.map(({ member, level }) => (
              <div
                key={member.id}
                className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 ${level === 0 ? 'opacity-50' : ''}`}
              >
                <Avatar name={member.name} color={member.avatarColor} size="2xs" />
                <span className="text-slate-700 dark:text-slate-300">{member.name.split(' ')[0]}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded text-2xs font-bold ${LEVEL_FILL[level]}`}
                  title={t(`skillLevel.${level}`)}
                >
                  {levelText(level)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
