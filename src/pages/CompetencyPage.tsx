import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Chip from '@/components/ui/Chip'
import SearchInput from '@/components/ui/SearchInput'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import CompetencyMatrix, { type SkillGroups } from '@/components/team/CompetencyMatrix'
import SkillCatalog from '@/components/team/SkillCatalog'
import { RISK_COLOR, type SkillRisk } from '@/components/team/skillLevels'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useAuthStore } from '@/store/auth'
import {
  Plus, Star, Trash2, Settings2, X, Check, Grid3x3, List, Pencil, FolderTree, Sparkles,
} from 'lucide-react'
import type { Skill, SkillArea, SkillAreaCategory, SkillLevel } from '@/types'

type Tab = 'matrix' | 'katalog'
type Risk = Exclude<SkillRisk, 'none'>
const RISKS: Risk[] = ['red', 'orange', 'yellow']
const ALL = '__all__'

// ─── Inline editable label ────────────────────────────────────────────────────
function InlineEdit({ value, onSave, className = '' }: { value: string; onSave: (v: string) => void; className?: string }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) }
        }}
        aria-label={value}
        className={`form-input form-sm !py-1 ${className}`}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(value); setEditing(true) }}
      title={t('competencies.clickToEdit')}
      className={`group/inline inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100" />
    </button>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CompetencyPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('kompetenzen')
  const { canWrite: canWriteMatrix, canWriteOwn: canWriteOwnMatrix } = usePagePermission('kompetenzen-matrix')
  const { isAllowed: canSeeMatrixFooter } = usePagePermission('kompetenzen-matrix-footer')
  const currentMemberId = useAuthStore((s) => s.user?.memberId)
  const members        = useStore((s) => s.members).filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name))
  const skills         = useStore((s) => s.skills)
  const memberSkills   = useStore((s) => s.memberSkills)
  const skillAreas     = useStore((s) => s.skillAreas)
  const addSkill       = useStore((s) => s.addSkill)
  const updateSkill    = useStore((s) => s.updateSkill)
  const deleteSkill    = useStore((s) => s.deleteSkill)
  const setMemberSkillLevel    = useStore((s) => s.setMemberSkillLevel)
  const addSkillArea           = useStore((s) => s.addSkillArea)
  const updateSkillArea        = useStore((s) => s.updateSkillArea)
  const deleteSkillArea        = useStore((s) => s.deleteSkillArea)
  const addSkillAreaCategory   = useStore((s) => s.addSkillAreaCategory)
  const updateSkillAreaCategory = useStore((s) => s.updateSkillAreaCategory)
  const deleteSkillAreaCategory = useStore((s) => s.deleteSkillAreaCategory)

  const [tab, setTab] = useState<Tab>('matrix')
  const [filterArea, setFilterArea] = useState<string>(ALL)
  const [filterText, setFilterText] = useState('')
  const [riskFilter, setRiskFilter] = useState<Set<Risk>>(new Set())
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [deleteSkillTarget, setDeleteSkillTarget] = useState<Skill | null>(null)
  const [skillForm, setSkillForm] = useState<{ name: string; categoryId: string | null; description: string }>({ name: '', categoryId: null, description: '' })
  const [skillSaving, setSkillSaving] = useState(false)

  const [showAreasModal, setShowAreasModal] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [newCatName, setNewCatName] = useState<Record<string, string>>({})
  const [deleteAreaTarget, setDeleteAreaTarget]  = useState<SkillArea | null>(null)
  const [deleteCatTarget, setDeleteCatTarget]    = useState<{ area: SkillArea; cat: SkillAreaCategory } | null>(null)

  const getLevel = (memberId: string, skillId: string): SkillLevel => {
    const ms = memberSkills.find((m) => m.memberId === memberId && m.skillId === skillId)
    return (ms?.level ?? 0) as SkillLevel
  }

  function getSkillRisk(skillId: string): SkillRisk {
    const levels = memberSkills.filter((ms) => ms.skillId === skillId && ms.level > 0)
    if (levels.length === 0) return 'red'
    if (levels.length === 1) return 'orange'
    if (levels.filter((ms) => ms.level === 5).length < 2) return 'yellow'
    return 'none'
  }

  // Build lookup maps
  const catById  = new Map<string, SkillAreaCategory>()
  const areaById = new Map<string, SkillArea>()
  for (const area of skillAreas) {
    areaById.set(area.id, area)
    for (const cat of area.categories) catById.set(cat.id, cat)
  }

  // Area + text filter first (risk counts are based on this set), then the risk filter
  const baseSkills = skills
    .filter((s) => {
      if (filterArea === ALL) return true
      const cat = s.categoryId ? catById.get(s.categoryId) : null
      return cat?.areaId === filterArea
    })
    .filter((s) => !filterText.trim() || s.name.toLowerCase().includes(filterText.trim().toLowerCase()))
  const riskCounts: Record<Risk, number> = { red: 0, orange: 0, yellow: 0 }
  for (const s of baseSkills) {
    const r = getSkillRisk(s.id)
    if (r !== 'none') riskCounts[r]++
  }
  const filteredSkills = riskFilter.size === 0 ? baseSkills : baseSkills.filter((s) => riskFilter.has(getSkillRisk(s.id) as Risk))

  const grouped: SkillGroups = []
  for (const area of [...skillAreas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    const cats: { cat: SkillAreaCategory; skills: Skill[] }[] = []
    for (const cat of [...area.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
      const catSkills = filteredSkills.filter((s) => s.categoryId === cat.id).sort((a, b) => a.name.localeCompare(b.name))
      if (catSkills.length > 0) cats.push({ cat, skills: catSkills })
    }
    if (cats.length > 0) grouped.push({ area, cats })
  }
  const uncategorised = filteredSkills
    .filter((s) => !s.categoryId || !catById.has(s.categoryId))
    .sort((a, b) => a.name.localeCompare(b.name))

  const ratedLevels = memberSkills.filter((ms) => ms.level > 0 && filteredSkills.some((s) => s.id === ms.skillId))
  const teamAvg = ratedLevels.length > 0
    ? (ratedLevels.reduce((s, ms) => s + ms.level, 0) / ratedLevels.length).toFixed(1)
    : null

  const isFiltered = filterArea !== ALL || !!filterText.trim() || riskFilter.size > 0
  function resetFilters() {
    setFilterArea(ALL)
    setFilterText('')
    setRiskFilter(new Set())
  }
  function toggleRisk(r: Risk) {
    setRiskFilter((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  // ─── Skill CRUD ─────────────────────────────────────────────────────────────
  function openAddSkill() {
    setEditSkill(null)
    setSkillForm({ name: '', categoryId: null, description: '' })
    setShowSkillModal(true)
  }
  function openEditSkill(sk: Skill) {
    setEditSkill(sk)
    setSkillForm({ name: sk.name, categoryId: sk.categoryId ?? null, description: sk.description ?? '' })
    setShowSkillModal(true)
  }

  async function handleSkillSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!skillForm.name.trim() || skillSaving) return
    setSkillSaving(true)
    try {
      if (editSkill) {
        await updateSkill(editSkill.id, { name: skillForm.name, categoryId: skillForm.categoryId, description: skillForm.description })
        toast.success(t('common.saved'))
      } else {
        await addSkill({ name: skillForm.name, categoryId: skillForm.categoryId, description: skillForm.description })
        toast.success(t('competencies.skillAdded', { name: skillForm.name.trim() }))
      }
      setShowSkillModal(false)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSkillSaving(false)
    }
  }

  /** Runs an area/category mutation and reports failures. */
  async function run(action: () => Promise<unknown>, successMsg?: string) {
    try {
      await action()
      if (successMsg) toast.success(successMsg)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleAddArea(e?: FormEvent) {
    e?.preventDefault()
    const name = newAreaName.trim()
    if (!name) return
    try {
      await run(() => addSkillArea(name))
      setNewAreaName('')
    } catch { /* reported via toast */ }
  }

  async function handleAddCategory(areaId: string) {
    const name = (newCatName[areaId] ?? '').trim()
    if (!name) return
    try {
      await run(() => addSkillAreaCategory(areaId, name))
      setNewCatName((m) => ({ ...m, [areaId]: '' }))
    } catch { /* reported via toast */ }
  }

  const tabItems = [
    { value: 'matrix' as Tab, label: t('competencies.competencyMatrix'), icon: Grid3x3 },
    { value: 'katalog' as Tab, label: t('competencies.skillsCatalog'), icon: List, count: skills.length },
  ]

  return (
    <Page size="full" className={tab === 'matrix' ? 'flex flex-col lg:h-full' : ''}>
      <PageHeader
        icon={Star}
        title={t('competencies.title')}
        subtitle={t('competencies.subtitleStats', { skills: skills.length, members: members.length })}
        className="!mb-5"
        actions={canWrite && (
          <>
            <Button variant="secondary" icon={<Settings2 />} onClick={() => setShowAreasModal(true)}>
              {t('competencies.manageAreas')}
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={openAddSkill}>
              {t('competencies.addSkill')}
            </Button>
          </>
        )}
      >
        <Tabs<Tab> items={tabItems} value={tab} onChange={setTab} aria-label={t('competencies.title')} />
      </PageHeader>

      {isReadOnly && (
        <ReadOnlyBanner
          className="mb-4"
          note={
            canWriteMatrix ? t('common.readOnlyMatrixEditable') :
            canWriteOwnMatrix ? t('common.readOnlyOwnMatrixEditable') : undefined
          }
        />
      )}

      {/* ── Toolbar: search · areas · risk filter · team average ── */}
      {skills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              size="sm"
              value={filterText}
              onChange={setFilterText}
              placeholder={t('competencies.filterPlaceholder')}
              aria-label={t('competencies.filterPlaceholder')}
              className="w-full shrink-0 sm:w-56"
            />
            {skillAreas.length > 0 && (
              <Tabs<string>
                variant="pills"
                size="sm"
                value={filterArea}
                onChange={setFilterArea}
                aria-label={t('competencies.areaFilter')}
                items={[
                  { value: ALL, label: t('common.all') },
                  ...[...skillAreas]
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                    .map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-label mr-0.5">{t('competencies.riskLabel')}</span>
            {RISKS.map((r) => (
              <Chip
                key={r}
                active={riskFilter.has(r)}
                dotColor={RISK_COLOR[r]}
                count={riskCounts[r]}
                onClick={() => toggleRisk(r)}
                title={t(`competencies.risk_${r}_hint`)}
              >
                {t(`competencies.risk_${r}`)}
              </Chip>
            ))}
            {teamAvg && (
              <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20" title={t('competencies.teamAvgHint')}>
                {t('competencies.teamAvgShort')}
                <span className="font-semibold tabular-nums">{teamAvg}</span>
              </span>
            )}
            {isFiltered && (
              <Button variant="ghost" size="xs" icon={<X />} onClick={resetFilters}>{t('common.resetFilters')}</Button>
            )}
          </div>
        </div>
      )}

      {tab === 'matrix' ? (
        <CompetencyMatrix
          members={members}
          grouped={grouped}
          uncategorised={uncategorised}
          totalSkills={skills.length}
          getLevel={getLevel}
          getSkillRisk={getSkillRisk}
          setMemberSkillLevel={setMemberSkillLevel}
          canWrite={canWriteMatrix}
          canWriteOwn={canWriteOwnMatrix}
          currentMemberId={currentMemberId}
          canSeeFooter={canSeeMatrixFooter}
          onResetFilters={resetFilters}
        />
      ) : (
        <SkillCatalog
          grouped={grouped}
          uncategorised={uncategorised}
          totalSkills={skills.length}
          memberSkills={memberSkills}
          members={members}
          getSkillRisk={getSkillRisk}
          onEdit={openEditSkill}
          onDelete={(sk) => setDeleteSkillTarget(sk)}
          onAdd={openAddSkill}
          onResetFilters={resetFilters}
          canWrite={canWrite}
        />
      )}

      {/* ── Skill Modal ──────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showSkillModal}
        onClose={() => { if (!skillSaving) setShowSkillModal(false) }}
        title={editSkill ? t('competencies.editSkill') : t('competencies.newSkill')}
        description={editSkill ? editSkill.name : t('competencies.newSkillHint')}
        icon={editSkill ? <Pencil /> : <Sparkles />}
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSkillModal(false)} disabled={skillSaving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="skill-form" loading={skillSaving} disabled={!skillForm.name.trim()}>
              {editSkill ? t('common.save') : t('common.add')}
            </Button>
          </>
        }
      >
        <form id="skill-form" onSubmit={handleSkillSubmit} className="space-y-5">
          <Field label={t('common.name')} htmlFor="skill-name" required>
            <input
              id="skill-name"
              type="text"
              autoFocus
              autoComplete="off"
              value={skillForm.name}
              onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('competencies.namePlaceholder')}
              className="form-input"
            />
          </Field>

          <fieldset>
            <legend className="form-label">{t('competencies.category')}</legend>
            {skillAreas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('competencies.noAreasDefined')}
              </p>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {skillAreas.map((area) => (
                  <div key={area.id}>
                    <p className="section-label mb-1.5">{area.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {area.categories.length === 0 ? (
                        <span className="text-xs italic text-slate-400">{t('competencies.noCategories')}</span>
                      ) : (
                        area.categories.map((cat) => (
                          <Chip
                            key={cat.id}
                            active={skillForm.categoryId === cat.id}
                            icon={skillForm.categoryId === cat.id ? <Check /> : undefined}
                            onClick={() => setSkillForm((f) => ({ ...f, categoryId: f.categoryId === cat.id ? null : cat.id }))}
                          >
                            {cat.name}
                          </Chip>
                        ))
                      )}
                    </div>
                  </div>
                ))}
                {skillForm.categoryId && (
                  <Button variant="ghost" size="xs" icon={<X />} onClick={() => setSkillForm((f) => ({ ...f, categoryId: null }))}>
                    {t('competencies.clearCategory')}
                  </Button>
                )}
              </div>
            )}
          </fieldset>

          <Field label={t('competencies.descriptionLabel')} htmlFor="skill-description">
            <textarea
              id="skill-description"
              value={skillForm.description}
              onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="form-textarea"
              placeholder={t('competencies.descriptionPlaceholder')}
            />
          </Field>
        </form>
      </Modal>

      {/* ── Areas Management Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={showAreasModal}
        onClose={() => setShowAreasModal(false)}
        title={t('competencies.manageAreas')}
        description={t('competencies.manageAreasHint')}
        icon={<FolderTree />}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setShowAreasModal(false)}>{t('common.close')}</Button>}
      >
        <div className="space-y-4">
          {/* Initial focus anchor: avoids jumping into the first "new category" field */}
          <div data-autofocus tabIndex={-1} className="sr-only" />
          {skillAreas.length === 0 && (
            <EmptyState compact icon={<FolderTree />} title={t('competencies.noAreasDefined')} />
          )}
          {skillAreas.map((area) => (
            <div key={area.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <InlineEdit
                  value={area.name}
                  onSave={(name) => { run(() => updateSkillArea(area.id, name)).catch(() => {}) }}
                  className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                />
                <IconButton
                  size="xs"
                  variant="danger"
                  icon={<Trash2 />}
                  label={t('competencies.deleteArea')}
                  onClick={() => setDeleteAreaTarget(area)}
                />
              </div>
              <div className="space-y-0.5 p-2">
                {area.categories.map((cat) => (
                  <div key={cat.id} className="group flex items-center gap-2 rounded-lg py-0.5 pl-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <div className="min-w-0 flex-1">
                      <InlineEdit
                        value={cat.name}
                        onSave={(name) => { run(() => updateSkillAreaCategory(area.id, cat.id, name)).catch(() => {}) }}
                        className="max-w-full text-sm text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <span className="text-2xs tabular-nums text-slate-400 dark:text-slate-500" title={t('competencies.skillsInCategory')}>
                      {skills.filter((s) => s.categoryId === cat.id).length}
                    </span>
                    <IconButton
                      size="xs"
                      variant="danger"
                      icon={<X />}
                      label={t('competencies.deleteCategory')}
                      onClick={() => setDeleteCatTarget({ area, cat })}
                      className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    />
                  </div>
                ))}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAddCategory(area.id) }}
                  className="flex items-center gap-2 pl-2 pr-1 pt-1.5"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    value={newCatName[area.id] ?? ''}
                    onChange={(e) => setNewCatName((m) => ({ ...m, [area.id]: e.target.value }))}
                    placeholder={t('competencies.newCategoryPlaceholder')}
                    aria-label={t('competencies.newCategoryPlaceholder')}
                    className="form-input form-sm flex-1"
                  />
                  <IconButton
                    type="submit"
                    size="sm"
                    icon={<Check />}
                    label={t('common.add')}
                    disabled={!(newCatName[area.id] ?? '').trim()}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  />
                </form>
              </div>
            </div>
          ))}

          {/* Add new area */}
          <form onSubmit={handleAddArea} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <input
              type="text"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder={t('competencies.newAreaPlaceholder')}
              aria-label={t('competencies.newAreaPlaceholder')}
              className="form-input flex-1"
            />
            <Button type="submit" variant="primary" icon={<Plus />} disabled={!newAreaName.trim()}>
              {t('competencies.addArea')}
            </Button>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteSkillTarget}
        onClose={() => setDeleteSkillTarget(null)}
        onConfirm={() => deleteSkillTarget && run(() => deleteSkill(deleteSkillTarget.id), t('common.deleted'))}
        title={t('competencies.removeSkill')}
        message={t('competencies.removeConfirm', { name: deleteSkillTarget?.name })}
        confirmLabel={t('common.remove')}
      />
      <ConfirmDialog
        isOpen={!!deleteAreaTarget}
        onClose={() => setDeleteAreaTarget(null)}
        onConfirm={() => deleteAreaTarget && run(() => deleteSkillArea(deleteAreaTarget.id), t('common.deleted'))}
        title={t('competencies.deleteArea')}
        message={t('competencies.deleteAreaConfirm', { name: deleteAreaTarget?.name })}
        confirmLabel={t('common.delete')}
      />
      <ConfirmDialog
        isOpen={!!deleteCatTarget}
        onClose={() => setDeleteCatTarget(null)}
        onConfirm={() => deleteCatTarget && run(() => deleteSkillAreaCategory(deleteCatTarget.area.id, deleteCatTarget.cat.id), t('common.deleted'))}
        title={t('competencies.deleteCategory')}
        message={t('competencies.deleteCategoryConfirm', { name: deleteCatTarget?.cat.name })}
        confirmLabel={t('common.delete')}
      />
    </Page>
  )
}
