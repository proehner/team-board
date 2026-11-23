import { Fragment, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Info, MousePointerClick, SearchX, Star, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Chip from '@/components/ui/Chip'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { toast, errorMessage } from '@/store/toast'
import type { Skill, SkillArea, SkillAreaCategory, SkillLevel, TeamMember } from '@/types'
import { LEVEL_CELL, LEVEL_FILL, RISK_DOT, SKILL_LEVELS, levelText, type SkillRisk } from './skillLevels'

export type SkillGroups = { area: SkillArea; cats: { cat: SkillAreaCategory; skills: Skill[] }[] }[]

const firstName = (name: string) => name.split(' ')[0]

interface CompetencyMatrixProps {
  members: TeamMember[]
  grouped: SkillGroups
  uncategorised: Skill[]
  /** Number of skills before search/area/risk filters — distinguishes "no data" from "no results". */
  totalSkills: number
  getLevel: (memberId: string, skillId: string) => SkillLevel
  getSkillRisk: (skillId: string) => SkillRisk
  setMemberSkillLevel: (memberId: string, skillId: string, level: SkillLevel) => Promise<void>
  canWrite: boolean
  canWriteOwn: boolean
  currentMemberId: string | undefined
  canSeeFooter: boolean
  onResetFilters: () => void
}

export default function CompetencyMatrix({
  members, grouped, uncategorised, totalSkills, getLevel, getSkillRisk, setMemberSkillLevel,
  canWrite, canWriteOwn, currentMemberId, canSeeFooter, onResetFilters,
}: CompetencyMatrixProps) {
  const { t } = useTranslation()
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Set<string>>(new Set())
  const [activeCell, setActiveCell] = useState<{ memberId: string; skillId: string } | null>(null)

  const toggleSet = (setter: typeof setCollapsedAreaIds) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleArea = toggleSet(setCollapsedAreaIds)
  const toggleMember = toggleSet(setSelectedMemberIds)

  if (members.length === 0 || totalSkills === 0) {
    return (
      <div className="surface">
        <EmptyState icon={<Star />} title={t('competencies.noData')} description={t('competencies.noDataSubtitle')} />
      </div>
    )
  }

  const visibleMembers = selectedMemberIds.size > 0 ? members.filter((m) => selectedMemberIds.has(m.id)) : members
  const allSkills = [...grouped.flatMap((g) => g.cats.flatMap((c) => c.skills)), ...uncategorised]
  const editableAny = canWrite || canWriteOwn

  function pickLevel(memberId: string, skillId: string, level: SkillLevel) {
    setActiveCell(null)
    setMemberSkillLevel(memberId, skillId, level).catch((err) =>
      toast.error(t('common.saveError'), { description: errorMessage(err) }),
    )
  }

  // Sticky first column needs an opaque background that follows the row hover
  const stickyCellBg = 'bg-white group-hover/row:bg-slate-50 dark:bg-slate-900 dark:group-hover/row:bg-slate-800'
  const firstColW = 'w-40 min-w-[10rem] max-w-[10rem] sm:w-64 sm:min-w-[16rem] sm:max-w-[16rem]'
  const colSpan = visibleMembers.length + 1

  function renderSkillRow(skill: Skill) {
    const risk = getSkillRisk(skill.id)
    return (
      <tr key={skill.id} className="group/row">
        <th
          scope="row"
          className={`sticky left-0 z-10 border-b border-r border-slate-100 py-1.5 pl-4 pr-3 text-left font-normal transition-colors dark:border-slate-800 ${stickyCellBg} ${firstColW}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${risk !== 'none' ? RISK_DOT[risk] : ''}`}
              title={risk !== 'none' ? t(`competencies.risk_${risk}_hint`) : undefined}
              aria-label={risk !== 'none' ? t(`competencies.risk_${risk}`) : undefined}
            />
            <span className="truncate text-sm font-medium text-slate-700 group-hover/row:text-slate-900 dark:text-slate-300 dark:group-hover/row:text-slate-100" title={skill.name}>
              {skill.name}
            </span>
            {skill.description && (
              <span title={skill.description} className="shrink-0 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
                <Info className="h-3.5 w-3.5" aria-label={skill.description} />
              </span>
            )}
          </div>
        </th>
        {visibleMembers.map((m) => {
          const level = getLevel(m.id, skill.id)
          const isOpen = activeCell?.memberId === m.id && activeCell?.skillId === skill.id
          const colActive = hoveredCol === m.id
          const canEditCell = canWrite || (canWriteOwn && m.id === currentMemberId)
          return (
            <td
              key={m.id}
              onMouseEnter={() => setHoveredCol(m.id)}
              className={`relative border-b border-slate-100 px-1 py-1 text-center transition-colors dark:border-slate-800 ${
                colActive
                  ? 'bg-indigo-50/70 group-hover/row:bg-indigo-100/70 dark:bg-indigo-500/[0.07] dark:group-hover/row:bg-indigo-500/15'
                  : 'group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => canEditCell && setActiveCell(isOpen ? null : { memberId: m.id, skillId: skill.id })}
                disabled={!canEditCell}
                aria-haspopup={canEditCell ? 'dialog' : undefined}
                aria-expanded={canEditCell ? isOpen : undefined}
                aria-label={`${skill.name} · ${m.name}: ${level}/5 ${t(`skillLevel.${level}`)}`}
                title={`${m.name} · ${t(`skillLevel.${level}`)}`}
                className={`mx-auto flex h-8 w-12 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-[box-shadow,transform,background-color] disabled:cursor-default ${LEVEL_CELL[level]} ${
                  canEditCell ? 'hover:ring-2 hover:ring-indigo-400/60 active:scale-95 dark:hover:ring-indigo-400/50' : ''
                } ${isOpen ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}
              >
                {levelText(level)}
              </button>
              {isOpen && (
                <LevelPicker
                  current={level}
                  memberName={m.name}
                  skillName={skill.name}
                  onPick={(l) => pickLevel(m.id, skill.id, l)}
                  onClose={() => setActiveCell(null)}
                />
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  const noResults = grouped.length === 0 && uncategorised.length === 0

  return (
    <div className="surface flex min-h-0 flex-col overflow-hidden lg:min-h-[420px] lg:flex-1">
      {/* Member focus chips */}
      {members.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2.5 scrollbar-none dark:border-slate-800 sm:px-4">
          <span className="section-label shrink-0">{t('competencies.membersLabel')}</span>
          {members.map((m) => (
            <Chip
              key={m.id}
              active={selectedMemberIds.has(m.id)}
              onClick={() => toggleMember(m.id)}
              icon={<Avatar name={m.name} color={m.avatarColor} size="2xs" className="-ml-1" />}
              title={m.name}
            >
              {firstName(m.name)}
            </Chip>
          ))}
          {selectedMemberIds.size > 0 && (
            <Button variant="ghost" size="xs" icon={<X />} onClick={() => setSelectedMemberIds(new Set())} className="shrink-0">
              {t('competencies.showAllMembers')}
            </Button>
          )}
        </div>
      )}

      {noResults ? (
        <EmptyState
          icon={<SearchX />}
          title={t('common.noResults')}
          description={t('competencies.noResultsHint')}
          action={<Button variant="secondary" onClick={onResetFilters}>{t('common.resetFilters')}</Button>}
          className="flex-1"
        />
      ) : (
        <div
          className="max-h-[70vh] min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-thin lg:max-h-none"
          onMouseLeave={() => setHoveredCol(null)}
        >
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-left align-bottom dark:border-slate-800 dark:bg-[#162032] ${firstColW}`}
                >
                  <span className="section-label">{t('competencies.skillColumn')}</span>
                  <span className="ml-1.5 text-2xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">{allSkills.length}</span>
                </th>
                {visibleMembers.map((m) => {
                  const colActive = hoveredCol === m.id
                  const isMe = m.id === currentMemberId
                  return (
                    <th
                      key={m.id}
                      scope="col"
                      onMouseEnter={() => setHoveredCol(m.id)}
                      className={`sticky top-0 z-20 min-w-[4.5rem] border-b border-slate-200 px-1 pb-2 pt-2.5 text-center font-medium transition-colors dark:border-slate-800 ${
                        colActive ? 'bg-indigo-50 dark:bg-[#1e2346]' : 'bg-slate-50 dark:bg-[#162032]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5" title={m.name}>
                        <Avatar
                          name={m.name}
                          color={m.avatarColor}
                          size="sm"
                          className={`transition-shadow ${colActive ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-indigo-50 dark:ring-offset-[#1e2346]' : ''}`}
                        />
                        <span
                          className={`max-w-[4.5rem] truncate text-xs ${
                            colActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'
                          } ${isMe ? 'font-semibold' : ''}`}
                        >
                          {firstName(m.name)}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ area, cats }) => {
                const isCollapsed = collapsedAreaIds.has(area.id)
                const count = cats.reduce((s, c) => s + c.skills.length, 0)
                return (
                  <Fragment key={`area-${area.id}`}>
                    <tr>
                      <td colSpan={colSpan} className="border-b border-slate-200 bg-slate-100/80 p-0 dark:border-slate-800 dark:bg-slate-800/70">
                        <button
                          type="button"
                          onClick={() => toggleArea(area.id)}
                          aria-expanded={!isCollapsed}
                          className="group sticky left-0 flex items-center gap-2 px-3 py-2 text-left"
                        >
                          <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 ${isCollapsed ? '' : 'rotate-90'}`} />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{area.name}</span>
                          <span className="rounded-full bg-white px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                            {count}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!isCollapsed && cats.map(({ cat, skills }) => (
                      <Fragment key={`cat-${cat.id}`}>
                        <tr>
                          <td colSpan={colSpan} className="border-b border-slate-100 bg-white p-0 dark:border-slate-800 dark:bg-slate-900">
                            <div className="sticky left-0 w-fit py-1.5 pl-8 pr-4 section-label">{cat.name}</div>
                          </td>
                        </tr>
                        {skills.map(renderSkillRow)}
                      </Fragment>
                    ))}
                  </Fragment>
                )
              })}

              {uncategorised.length > 0 && (
                <>
                  <tr>
                    <td colSpan={colSpan} className="border-b border-slate-200 bg-slate-100/80 p-0 dark:border-slate-800 dark:bg-slate-800/70">
                      <div className="sticky left-0 flex w-fit items-center gap-2 px-4 py-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('competencies.uncategorised')}</span>
                        <span className="rounded-full bg-white px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                          {uncategorised.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {uncategorised.map(renderSkillRow)}
                </>
              )}
            </tbody>
            {canSeeFooter && <MemberTotalsFooter members={visibleMembers} allSkills={allSkills} getLevel={getLevel} firstColW={firstColW} />}
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 sm:px-4">
        <span className="section-label">{t('competencies.legendLevel')}</span>
        {SKILL_LEVELS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={`flex h-5 w-6 items-center justify-center rounded text-2xs font-semibold ${LEVEL_FILL[l]}`}>{levelText(l)}</span>
            {t(`skillLevel.${l}`)}
          </span>
        ))}
        {editableAny && (
          <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500 lg:ml-auto">
            <MousePointerClick className="h-3.5 w-3.5" />
            {canWrite ? t('competencies.editHint') : t('competencies.editOwnHint')}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Level picker popover ─────────────────────────────────────────────────────

function LevelPicker({
  current, memberName, skillName, onPick, onClose,
}: {
  current: SkillLevel
  memberName: string
  skillName: string
  onPick: (level: SkillLevel) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<SkillLevel | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const el = ref.current
    el?.querySelector<HTMLButtonElement>(`[data-level="${current}"]`)?.focus({ preventScroll: true })
    // The owning cell counts as "inside" so its button can toggle the picker closed
    const cell = el?.parentElement
    function onDown(e: MouseEvent) {
      if (cell && !cell.contains(e.target as Node)) onCloseRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cell?.querySelector<HTMLButtonElement>('button')?.focus()
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[data-level]') ?? [])
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowRight' ? Math.min(idx + 1, btns.length - 1) : Math.max(idx - 1, 0)
    btns[next]?.focus()
  }

  const shown = preview ?? current

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${skillName} · ${memberName}`}
      onKeyDown={onKeyDown}
      className="absolute left-1/2 top-full z-40 mt-1 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-popover animate-slide-down dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="mb-1.5 max-w-[15rem] truncate px-0.5 text-left text-2xs font-medium text-slate-400 dark:text-slate-500">
        {firstName(memberName)} · {skillName}
      </p>
      <div className="flex gap-1" onMouseLeave={() => setPreview(null)}>
        {SKILL_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            data-level={l}
            onClick={() => onPick(l)}
            onMouseEnter={() => setPreview(l)}
            onFocus={() => setPreview(l)}
            aria-pressed={l === current}
            aria-label={`${l} – ${t(`skillLevel.${l}`)}`}
            className={`h-9 w-9 rounded-lg text-xs font-semibold tabular-nums transition-transform hover:scale-105 ${LEVEL_FILL[l]} ${
              l === current ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-indigo-300 dark:ring-offset-slate-900' : ''
            }`}
          >
            {levelText(l)}
          </button>
        ))}
      </div>
      <p className="mt-1.5 whitespace-nowrap text-center text-xs font-medium text-slate-600 dark:text-slate-300">
        <span className="tabular-nums text-slate-400 dark:text-slate-500">{shown}/5</span> · {t(`skillLevel.${shown}`)}
      </p>
    </div>
  )
}

// ─── Member totals footer ─────────────────────────────────────────────────────

function MemberTotalsFooter({
  members, allSkills, getLevel, firstColW,
}: {
  members: TeamMember[]
  allSkills: Skill[]
  getLevel: (memberId: string, skillId: string) => SkillLevel
  firstColW: string
}) {
  const { t } = useTranslation()
  if (allSkills.length === 0 || members.length === 0) return null
  const totals = members.map((m) => allSkills.reduce((sum, sk) => sum + getLevel(m.id, sk.id), 0))
  const counts = members.map((m) => allSkills.filter((sk) => getLevel(m.id, sk.id) > 0).length)
  const teamAvg = totals.reduce((s, v) => s + v, 0) / members.length
  const teamMax = Math.max(...totals, 1)
  const avgMarkerPct = (teamAvg / teamMax) * 100

  return (
    <tfoot>
      <tr>
        <th
          scope="row"
          title={t('competencies.totalHint')}
          className={`sticky left-0 z-10 border-r border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-left align-top dark:border-slate-700 dark:bg-[#162032] ${firstColW}`}
        >
          <span className="section-label">{t('competencies.totalRow', { avg: Math.round(teamAvg) })}</span>
          <p className="mt-1 text-2xs font-normal leading-snug text-slate-400 dark:text-slate-500">{t('competencies.totalHintShort')}</p>
        </th>
        {members.map((m, i) => {
          const total = totals[i]
          const count = counts[i]
          const deviation = total - teamAvg
          const relDev = teamAvg > 0 ? deviation / teamAvg : 0
          const pct = (total / teamMax) * 100
          const status = relDev >= -0.1 ? 'ok' : relDev >= -0.3 ? 'warning' : 'critical'
          const barColor = status === 'ok' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-400' : 'bg-red-500'
          const textColor = status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          const deviationLabel = deviation >= 0 ? `+${Math.round(deviation)}` : `${Math.round(deviation)}`
          return (
            <td key={m.id} className="border-t-2 border-slate-200 bg-slate-50 px-1 py-3 text-center dark:border-slate-700 dark:bg-[#162032]">
              <div
                className="flex flex-col items-center gap-1"
                title={t('competencies.totalCellTitle', { total, dev: deviationLabel, count, skills: allSkills.length })}
              >
                <span className={`text-sm font-bold tabular-nums ${textColor}`}>{total}</span>
                <span className="text-2xs leading-none tabular-nums text-slate-400 dark:text-slate-500">{count}/{allSkills.length}</span>
                <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  {members.length > 1 && (
                    <div className="absolute inset-y-0 w-px bg-slate-900/40 dark:bg-white/60" style={{ left: `${avgMarkerPct}%` }} />
                  )}
                </div>
                <span className={`text-xs font-medium tabular-nums ${textColor}`}>{deviationLabel}</span>
              </div>
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
}
