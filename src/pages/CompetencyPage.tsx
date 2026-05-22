import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useAuthStore } from '@/store/auth'
import { Plus, Star, Edit2, Trash2, Info, Search, Settings, ChevronRight, X, Check } from 'lucide-react'
import type { Skill, SkillArea, SkillAreaCategory, SkillLevel, TeamMember, MemberSkill } from '@/types'

const LEVEL_BG: Record<SkillLevel, string> = {
  0: 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600',
  1: 'bg-blue-50 text-blue-400',
  2: 'bg-blue-100 text-blue-600',
  3: 'bg-indigo-200 text-indigo-700',
  4: 'bg-indigo-400 text-white',
  5: 'bg-indigo-700 text-white',
}

// Colored member-initial dots used in the catalog list
const CATALOG_DOT_BG: Record<SkillLevel, string> = {
  0: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
  1: 'bg-blue-50 text-blue-500 border border-blue-200',
  2: 'bg-blue-100 text-blue-700 border border-blue-300',
  3: 'bg-indigo-200 text-indigo-700 border border-indigo-300',
  4: 'bg-indigo-400 text-white',
  5: 'bg-indigo-700 text-white',
}

const RISK_DOT: Record<'red' | 'orange' | 'yellow', string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-amber-400',
}

type Tab = 'matrix' | 'katalog'
type CatalogSortKey = 'name' | 'avg' | 'coverage'

// ─── Inline editable label ────────────────────────────────────────────────────
function InlineEdit({ value, onSave, className = '' }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
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
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className={`border border-indigo-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-800 ${className}`}
      />
    )
  }
  return (
    <span
      className={`cursor-pointer hover:underline hover:decoration-dotted ${className}`}
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Klicken zum Bearbeiten"
    >
      {value}
    </span>
  )
}

// ─── Coverage Summary ─────────────────────────────────────────────────────────

function CoverageSummary({
  skills,
  memberSkills,
  members,
  getSkillRisk,
}: {
  skills: Skill[]
  memberSkills: MemberSkill[]
  members: TeamMember[]
  getSkillRisk: (id: string) => 'red' | 'orange' | 'yellow' | 'none'
}) {
  const { t } = useTranslation()
  if (skills.length === 0 || members.length === 0) return null

  const red    = skills.filter((sk) => getSkillRisk(sk.id) === 'red').length
  const orange = skills.filter((sk) => getSkillRisk(sk.id) === 'orange').length
  const yellow = skills.filter((sk) => getSkillRisk(sk.id) === 'yellow').length

  const totalPairs = skills.length * members.length
  const ratedPairs = memberSkills.filter((ms) => ms.level > 0 && skills.some((s) => s.id === ms.skillId)).length
  const coveragePct = totalPairs > 0 ? Math.round((ratedPairs / totalPairs) * 100) : 0

  const ratedLevels = memberSkills.filter((ms) => ms.level > 0 && skills.some((s) => s.id === ms.skillId))
  const teamAvg = ratedLevels.length > 0
    ? (ratedLevels.reduce((s, ms) => s + ms.level, 0) / ratedLevels.length).toFixed(1)
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{skills.length}</span>{' '}
        {t('competencies.totalSkillsLabel')}
      </span>

      {(red > 0 || orange > 0 || yellow > 0) && (
        <span className="flex items-center gap-3 text-xs">
          {red > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="font-semibold text-red-600 dark:text-red-400">{red}</span>
            </span>
          )}
          {orange > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              <span className="font-semibold text-orange-500 dark:text-orange-400">{orange}</span>
            </span>
          )}
          {yellow > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-semibold text-amber-500 dark:text-amber-400">{yellow}</span>
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500">{t('competencies.atRiskLabel')}</span>
        </span>
      )}

      <span className="text-slate-500 dark:text-slate-400">
        {t('competencies.coverageLabel')}{' '}
        <span className={`font-semibold ${
          coveragePct >= 70
            ? 'text-green-600 dark:text-green-400'
            : coveragePct >= 40
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
        }`}>
          {coveragePct}%
        </span>
      </span>

      {teamAvg && (
        <span className="text-slate-500 dark:text-slate-400">
          {t('competencies.teamAvgLabel')}{' '}
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{teamAvg}</span>
        </span>
      )}
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function CompetencyPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('kompetenzen')
  const { canWrite: canWriteMatrix, canWriteOwn: canWriteOwnMatrix } = usePagePermission('kompetenzen-matrix')
  const currentMemberId = useAuthStore((s) => s.user?.memberId)
  const members        = useStore((s) => s.members).filter((m) => m.isActive)
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
  const [filterArea, setFilterArea] = useState<string | 'Alle'>('Alle')
  const [filterText, setFilterText] = useState('')
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [deleteSkillTarget, setDeleteSkillTarget] = useState<Skill | null>(null)
  const [skillForm, setSkillForm] = useState<{ name: string; categoryId: string | null; description: string }>({ name: '', categoryId: null, description: '' })

  const [saveError, setSaveError] = useState('')
  const [showAreasModal, setShowAreasModal] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [newCatName, setNewCatName] = useState<Record<string, string>>({})
  const [deleteAreaTarget, setDeleteAreaTarget]  = useState<SkillArea | null>(null)
  const [deleteCatTarget, setDeleteCatTarget]    = useState<{ area: SkillArea; cat: SkillAreaCategory } | null>(null)

  const [activeCell, setActiveCell] = useState<{ memberId: string; skillId: string } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeCell) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setActiveCell(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeCell])

  const getLevel = (memberId: string, skillId: string): SkillLevel => {
    const ms = memberSkills.find((m) => m.memberId === memberId && m.skillId === skillId)
    return (ms?.level ?? 0) as SkillLevel
  }

  function getSkillRisk(skillId: string): 'red' | 'orange' | 'yellow' | 'none' {
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

  function getCategoryLabel(categoryId: string | null): string {
    if (!categoryId) return t('competencies.noCategoryShort')
    const cat  = catById.get(categoryId)
    const area = cat ? areaById.get(cat.areaId) : undefined
    return cat && area ? `${area.name} · ${cat.name}` : t('competencies.noCategoryShort')
  }

  const filteredSkills = skills
    .filter((s) => {
      if (filterArea === 'Alle') return true
      const cat = s.categoryId ? catById.get(s.categoryId) : null
      return cat?.areaId === filterArea
    })
    .filter((s) => !filterText.trim() || s.name.toLowerCase().includes(filterText.toLowerCase()))

  type Grouped = { area: SkillArea; cats: { cat: SkillAreaCategory; skills: Skill[] }[] }[]
  const grouped: Grouped = []
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

  async function handleSkillSubmit() {
    if (!skillForm.name.trim()) return
    setSaveError('')
    try {
      if (editSkill) {
        await updateSkill(editSkill.id, { name: skillForm.name, categoryId: skillForm.categoryId, description: skillForm.description })
      } else {
        await addSkill({ name: skillForm.name, categoryId: skillForm.categoryId, description: skillForm.description })
      }
      setShowSkillModal(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  async function handleAddArea() {
    const name = newAreaName.trim()
    if (!name) return
    await addSkillArea(name)
    setNewAreaName('')
  }

  async function handleAddCategory(areaId: string) {
    const name = (newCatName[areaId] ?? '').trim()
    if (!name) return
    await addSkillAreaCategory(areaId, name)
    setNewCatName((m) => ({ ...m, [areaId]: '' }))
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('competencies.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('competencies.subtitle', { count: members.length })}</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Settings className="w-4 h-4" />} onClick={() => setShowAreasModal(true)}>
              {t('competencies.manageAreas')}
            </Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAddSkill}>
              {t('competencies.addSkill')}
            </Button>
          </div>
        )}
      </div>
      {isReadOnly && (
        <ReadOnlyBanner note={
          canWriteMatrix ? t('common.readOnlyMatrixEditable') :
          canWriteOwnMatrix ? t('common.readOnlyOwnMatrixEditable') : undefined
        } />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {([['matrix', t('competencies.competencyMatrix')], ['katalog', t('competencies.skillsCatalog')]] as [Tab, string][]).map(([tabKey, label]) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === tabKey ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + Area filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('competencies.filterPlaceholder')}
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent w-44"
          />
        </div>
      </div>
      {skillAreas.length > 0 && (
        <div className="flex flex-wrap gap-2 -mt-1">
          {(['Alle', ...skillAreas.map((a) => a.id)] as (string | 'Alle')[]).map((areaId) => {
            const label = areaId === 'Alle' ? t('common.all') : (areaById.get(areaId)?.name ?? areaId)
            return (
              <button
                key={areaId}
                onClick={() => setFilterArea(areaId)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  filterArea === areaId
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Coverage summary strip */}
      <CoverageSummary
        skills={filteredSkills}
        memberSkills={memberSkills}
        members={members}
        getSkillRisk={getSkillRisk}
      />

      <div className="flex-1 min-h-0">
        {tab === 'matrix' ? (
          <MatrixTab
            members={members}
            grouped={grouped}
            uncategorised={uncategorised}
            getLevel={getLevel}
            getSkillRisk={getSkillRisk}
            activeCell={activeCell}
            setActiveCell={setActiveCell}
            setMemberSkillLevel={setMemberSkillLevel}
            popoverRef={popoverRef}
            canWrite={canWriteMatrix}
            canWriteOwn={canWriteOwnMatrix}
            currentMemberId={currentMemberId}
          />
        ) : (
          <CatalogTab
            grouped={grouped}
            uncategorised={uncategorised}
            memberSkills={memberSkills}
            members={members}
            getSkillRisk={getSkillRisk}
            onEdit={openEditSkill}
            onDelete={(sk) => setDeleteSkillTarget(sk)}
            canWrite={canWrite}
          />
        )}
      </div>

      {/* ── Skill Modal ──────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        title={editSkill ? t('competencies.editSkill') : t('competencies.newSkill')}
        footer={
          <>
            {saveError && <p className="flex-1 text-sm text-red-600">{saveError}</p>}
            <Button variant="secondary" onClick={() => setShowSkillModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSkillSubmit}>{editSkill ? t('common.save') : t('common.add')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('common.name')}</label>
            <input
              type="text"
              value={skillForm.name}
              onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('competencies.namePlaceholder')}
              className="form-input"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('competencies.category')}</label>
            {skillAreas.length === 0 ? (
              <p className="text-sm text-slate-400 italic">{t('competencies.noAreasDefined')}</p>
            ) : (
              <div className="space-y-3">
                {skillAreas.map((area) => (
                  <div key={area.id}>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{area.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {area.categories.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">{t('competencies.noCategories')}</span>
                      ) : (
                        area.categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSkillForm((f) => ({ ...f, categoryId: f.categoryId === cat.id ? null : cat.id }))}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                              skillForm.categoryId === cat.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
                {skillForm.categoryId && (
                  <button
                    type="button"
                    onClick={() => setSkillForm((f) => ({ ...f, categoryId: null }))}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> {t('competencies.clearCategory')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('competencies.descriptionLabel')}</label>
            <textarea
              value={skillForm.description}
              onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="form-textarea"
              placeholder={t('competencies.descriptionPlaceholder')}
            />
          </div>
        </div>
      </Modal>

      {/* ── Areas Management Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={showAreasModal}
        onClose={() => setShowAreasModal(false)}
        title={t('competencies.manageAreas')}
        footer={<Button variant="secondary" onClick={() => setShowAreasModal(false)}>{t('common.close')}</Button>}
      >
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {skillAreas.length === 0 && (
            <p className="text-sm text-slate-400 italic">{t('competencies.noAreasDefined')}</p>
          )}
          {skillAreas.map((area) => (
            <div key={area.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <InlineEdit
                  value={area.name}
                  onSave={(name) => updateSkillArea(area.id, name)}
                  className="font-semibold text-slate-800 dark:text-slate-200"
                />
                <button
                  onClick={() => setDeleteAreaTarget(area)}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title={t('competencies.deleteArea')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                {area.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <InlineEdit
                      value={cat.name}
                      onSave={(name) => updateSkillAreaCategory(area.id, cat.id, name)}
                      className="flex-1 text-sm text-slate-700 dark:text-slate-300"
                    />
                    <button
                      onClick={() => setDeleteCatTarget({ area, cat })}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-200 shrink-0" />
                  <input
                    type="text"
                    value={newCatName[area.id] ?? ''}
                    onChange={(e) => setNewCatName((m) => ({ ...m, [area.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(area.id) }}
                    placeholder={t('competencies.newCategoryPlaceholder')}
                    className="flex-1 text-sm border-b border-slate-300 dark:border-slate-600 bg-transparent py-0.5 focus:outline-none focus:border-indigo-400 text-slate-700 dark:text-slate-300 placeholder-slate-400"
                  />
                  <button
                    onClick={() => handleAddCategory(area.id)}
                    className="p-1 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add new area */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddArea() }}
              placeholder={t('competencies.newAreaPlaceholder')}
              className="flex-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 dark:text-slate-300 placeholder-slate-400"
            />
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleAddArea}>
              {t('competencies.addArea')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteSkillTarget}
        onClose={() => setDeleteSkillTarget(null)}
        onConfirm={() => { if (deleteSkillTarget) deleteSkill(deleteSkillTarget.id) }}
        title={t('competencies.removeSkill')}
        message={t('competencies.removeConfirm', { name: deleteSkillTarget?.name })}
        confirmLabel={t('common.remove')}
      />
      <ConfirmDialog
        isOpen={!!deleteAreaTarget}
        onClose={() => setDeleteAreaTarget(null)}
        onConfirm={() => { if (deleteAreaTarget) { deleteSkillArea(deleteAreaTarget.id); setDeleteAreaTarget(null) } }}
        title={t('competencies.deleteArea')}
        message={t('competencies.deleteAreaConfirm', { name: deleteAreaTarget?.name })}
        confirmLabel={t('common.delete')}
      />
      <ConfirmDialog
        isOpen={!!deleteCatTarget}
        onClose={() => setDeleteCatTarget(null)}
        onConfirm={() => { if (deleteCatTarget) { deleteSkillAreaCategory(deleteCatTarget.area.id, deleteCatTarget.cat.id); setDeleteCatTarget(null) } }}
        title={t('competencies.deleteCategory')}
        message={t('competencies.deleteCategoryConfirm', { name: deleteCatTarget?.cat.name })}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

// ─── Matrix Tab ───────────────────────────────────────────────────────────────

interface MatrixTabProps {
  members: TeamMember[]
  grouped: { area: SkillArea; cats: { cat: SkillAreaCategory; skills: Skill[] }[] }[]
  uncategorised: Skill[]
  getLevel: (memberId: string, skillId: string) => SkillLevel
  getSkillRisk: (skillId: string) => 'red' | 'orange' | 'yellow' | 'none'
  activeCell: { memberId: string; skillId: string } | null
  setActiveCell: (cell: { memberId: string; skillId: string } | null) => void
  setMemberSkillLevel: (memberId: string, skillId: string, level: SkillLevel) => void
  popoverRef: React.RefObject<HTMLDivElement>
  canWrite: boolean
  canWriteOwn: boolean
  currentMemberId: string | undefined
}

function MatrixTab({ members, grouped, uncategorised, getLevel, getSkillRisk, activeCell, setActiveCell, setMemberSkillLevel, popoverRef, canWrite, canWriteOwn, currentMemberId }: MatrixTabProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<{ row: string | null; col: string | null }>({ row: null, col: null })
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(new Set())
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Set<string>>(new Set())

  function toggleArea(id: string) {
    setCollapsedAreaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const hasData = members.length > 0 && (grouped.length > 0 || uncategorised.length > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon={<Star className="w-12 h-12" />}
        title={t('competencies.noData')}
        description={t('competencies.noDataSubtitle')}
      />
    )
  }

  const visibleMembers = members.filter((m) => !hiddenMemberIds.has(m.id))
  const allSkills = [...grouped.flatMap((g) => g.cats.flatMap((c) => c.skills)), ...uncategorised]

  function toggleMember(id: string) {
    setHiddenMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function renderSkillRow(skill: Skill) {
    const risk = getSkillRisk(skill.id)
    const rowActive = hovered.row === skill.id
    return (
      <tr
        key={skill.id}
        className="border-t border-slate-100 dark:border-slate-800"
        onMouseEnter={() => setHovered((h) => ({ ...h, row: skill.id }))}
        onMouseLeave={() => setHovered((h) => ({ ...h, row: null }))}
      >
        <td className={`px-4 py-2.5 text-sm font-medium sticky left-0 z-10 w-52 transition-colors ${rowActive ? 'bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}>
          <div className="flex items-center gap-1.5">
            {risk !== 'none' && <span className={`shrink-0 w-2 h-2 rounded-full ${RISK_DOT[risk]}`} />}
            {skill.description && (
              <span title={skill.description}><Info className="w-3.5 h-3.5 text-slate-300" /></span>
            )}
            {skill.name}
          </div>
        </td>
        {visibleMembers.map((m) => {
          const level = getLevel(m.id, skill.id)
          const isActive = activeCell?.memberId === m.id && activeCell?.skillId === skill.id
          const colActive = hovered.col === m.id
          const isIntersection = rowActive && colActive
          const canEditCell = canWrite || (canWriteOwn && m.id === currentMemberId)
          return (
            <td
              key={m.id}
              className={`px-2 py-1.5 text-center relative transition-colors ${
                isIntersection
                  ? 'bg-amber-100 dark:bg-amber-800/25'
                  : colActive
                    ? 'bg-indigo-50/70 dark:bg-indigo-900/20'
                    : rowActive
                      ? 'bg-amber-50/60 dark:bg-amber-900/10'
                      : ''
              }`}
              onMouseEnter={() => setHovered({ row: skill.id, col: m.id })}
            >
              <button
                onClick={() => canEditCell && setActiveCell(isActive ? null : { memberId: m.id, skillId: skill.id })}
                disabled={!canEditCell}
                className={`w-16 h-8 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${LEVEL_BG[level]} ${canEditCell ? 'hover:scale-110' : 'cursor-default'}`}
                title={t(`skillLevel.${level}`)}
              >
                {level === 0 ? '—' : level}
              </button>
              {isActive && (
                <div
                  ref={popoverRef}
                  className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex gap-1"
                >
                  {([0, 1, 2, 3, 4, 5] as SkillLevel[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => { setActiveCell(null); setMemberSkillLevel(m.id, skill.id, l) }}
                      title={t(`skillLevel.${l}`)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all hover:scale-110 ${LEVEL_BG[l]} ${level === l ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      {l === 0 ? '—' : l}
                    </button>
                  ))}
                </div>
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Member filter chips */}
      {members.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">{t('competencies.filterMembers')}</span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleMember(m.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
                hiddenMemberIds.has(m.id)
                  ? 'opacity-40 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 line-through'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 shadow-sm hover:border-indigo-400'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold shrink-0"
                style={{ backgroundColor: m.avatarColor }}
              >
                {m.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
              </div>
              {m.name.split(' ')[0]}
            </button>
          ))}
          {hiddenMemberIds.size > 0 && (
            <button
              onClick={() => setHiddenMemberIds(new Set())}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('competencies.showAllMembers')}
            </button>
          )}
        </div>
      )}

      {/* Scrollable matrix */}
      <div
        className="flex-1 min-h-0 overflow-auto scrollbar-thin rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        onMouseLeave={() => setHovered({ row: null, col: null })}
      >
        {visibleMembers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400 dark:text-slate-500 p-8">
            {t('competencies.showAllMembers')}
          </div>
        ) : (
          <table className="text-sm min-w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-52 sticky left-0 top-0 bg-slate-50 dark:bg-slate-800 z-30 border-b border-slate-200 dark:border-slate-700">
                  {t('competencies.skillColumn')}
                </th>
                {visibleMembers.map((m) => {
                  const colActive = hovered.col === m.id
                  return (
                    <th
                      key={m.id}
                      className={`px-3 py-3 text-center text-xs font-medium min-w-[90px] transition-colors sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700 ${colActive ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-transform ${colActive ? 'scale-115 ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                          style={{ backgroundColor: m.avatarColor }}
                        >
                          {m.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                        </div>
                        <span className="truncate max-w-[80px]">{m.name.split(' ')[0]}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody onMouseLeave={() => setHovered({ row: null, col: null })}>
              {grouped.map(({ area, cats }) => {
                const isCollapsed = collapsedAreaIds.has(area.id)
                const skillCount = cats.reduce((s, c) => s + c.skills.length, 0)
                return (
                <React.Fragment key={`area-${area.id}`}>
                  <tr
                    className="bg-indigo-50 dark:bg-indigo-950/30 cursor-pointer select-none group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    onClick={() => toggleArea(area.id)}
                  >
                    <td
                      colSpan={visibleMembers.length + 1}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest sticky left-0 bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
                        {area.name}
                        <span className="font-normal text-indigo-400 dark:text-indigo-500">({skillCount})</span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && cats.map(({ cat, skills }) => (
                    <React.Fragment key={`cat-${cat.id}`}>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <td
                          colSpan={visibleMembers.length + 1}
                          className="pl-8 pr-4 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0"
                        >
                          {cat.name}
                        </td>
                      </tr>
                      {skills.map(renderSkillRow)}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              )
              })}

              {uncategorised.length > 0 && (
                <React.Fragment>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <td
                      colSpan={visibleMembers.length + 1}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0"
                    >
                      {t('competencies.uncategorised')}
                    </td>
                  </tr>
                  {uncategorised.map(renderSkillRow)}
                </React.Fragment>
              )}
            </tbody>
            <MemberTotalsFooter members={visibleMembers} allSkills={allSkills} getLevel={getLevel} />
          </table>
        )}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {([0, 1, 2, 3, 4, 5] as SkillLevel[]).map((l) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-semibold ${LEVEL_BG[l]}`}>
                {l === 0 ? '—' : l}
              </div>
              <span>{t(`skillLevel.${l}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Member Totals Footer ─────────────────────────────────────────────────────

function MemberTotalsFooter({ members, allSkills, getLevel }: { members: TeamMember[]; allSkills: Skill[]; getLevel: (memberId: string, skillId: string) => SkillLevel }) {
  const { t } = useTranslation()
  if (allSkills.length === 0 || members.length === 0) return null
  const totals = members.map((m) => allSkills.reduce((sum, sk) => sum + getLevel(m.id, sk.id), 0))
  const teamAvg = totals.reduce((s, v) => s + v, 0) / members.length
  const teamMax = Math.max(...totals, 1)
  const avgMarkerPct = (teamAvg / teamMax) * 100
  return (
    <tfoot>
      <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
        <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 w-52">
          {t('competencies.totalRow', { avg: Math.round(teamAvg) })}
        </td>
        {members.map((m, i) => {
          const total = totals[i]
          const deviation = total - teamAvg
          const relDev = teamAvg > 0 ? deviation / teamAvg : 0
          const pct = (total / teamMax) * 100
          const status = relDev >= -0.1 ? 'ok' : relDev >= -0.3 ? 'warning' : 'critical'
          const barColor = status === 'ok' ? 'bg-green-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
          const textColor = status === 'ok' ? 'text-green-600 dark:text-green-400' : status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
          const deviationLabel = deviation >= 0 ? `+${Math.round(deviation)}` : `${Math.round(deviation)}`
          return (
            <td key={m.id} className="px-2 py-3 text-center min-w-[90px]">
              <div className="flex flex-col items-center gap-1" title={`${total} Pkt. · ${deviationLabel} vs. Ø`}>
                <span className={`text-sm font-bold ${textColor}`}>{total}</span>
                <div className="relative w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  {members.length > 1 && (
                    <div className="absolute inset-y-0 w-px bg-white/80 dark:bg-slate-900/80" style={{ left: `${avgMarkerPct}%` }} />
                  )}
                </div>
                <span className={`text-xs font-medium ${textColor}`}>{deviationLabel}</span>
              </div>
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
}

// ─── Catalog Tab ──────────────────────────────────────────────────────────────

interface CatalogTabProps {
  grouped: { area: SkillArea; cats: { cat: SkillAreaCategory; skills: Skill[] }[] }[]
  uncategorised: Skill[]
  memberSkills: MemberSkill[]
  members: TeamMember[]
  getSkillRisk: (skillId: string) => 'red' | 'orange' | 'yellow' | 'none'
  onEdit: (sk: Skill) => void
  onDelete: (sk: Skill) => void
  canWrite: boolean
}

const MAX_VISIBLE_DOTS = 9

function CatalogTab({ grouped, uncategorised, memberSkills, members, getSkillRisk, onEdit, onDelete, canWrite }: CatalogTabProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<CatalogSortKey>('name')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Set<string>>(new Set())

  const isEmpty = grouped.length === 0 && uncategorised.length === 0
  if (isEmpty) {
    return (
      <EmptyState
        icon={<Star className="w-12 h-12" />}
        title={t('competencies.noSkills')}
        description={t('competencies.noSkillsSubtitle')}
      />
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

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleArea(id: string) {
    setCollapsedAreaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function SkillRow({ sk }: { sk: Skill }) {
    const risk = getSkillRisk(sk.id)
    const { ratedCount, avgLevel, expertCount } = getStats(sk.id)
    const isExpanded = expandedIds.has(sk.id)

    const riskBorderColor = risk === 'red'
      ? 'border-l-red-500'
      : risk === 'orange'
        ? 'border-l-orange-400'
        : risk === 'yellow'
          ? 'border-l-amber-400'
          : 'border-l-transparent'

    const memberLevelData = members
      .map((m) => ({
        member: m,
        level: (memberSkills.find((ms) => ms.memberId === m.id && ms.skillId === sk.id)?.level ?? 0) as SkillLevel,
      }))
      .sort((a, b) => a.member.name.localeCompare(b.member.name))

    const visibleDots = memberLevelData.slice(0, MAX_VISIBLE_DOTS)
    const hiddenCount = memberLevelData.length - MAX_VISIBLE_DOTS

    return (
      <React.Fragment>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 border-l-[3px] ${riskBorderColor} hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition-colors`}
          onClick={() => toggleExpand(sk.id)}
        >
          {/* Risk dot – always occupies space */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${risk !== 'none' ? RISK_DOT[risk] : 'opacity-0'}`} />

          {/* Skill name + description tooltip */}
          <div className="flex items-center gap-1.5 min-w-0 w-40 shrink-0">
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{sk.name}</span>
            {sk.description && (
              <button onClick={(e) => e.stopPropagation()} title={sk.description} className="shrink-0">
                <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors" />
              </button>
            )}
          </div>

          {/* Member level dots */}
          <div className="flex items-center gap-[3px] flex-1 overflow-hidden">
            {visibleDots.map(({ member, level }) => (
              <div
                key={member.id}
                className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 select-none ${CATALOG_DOT_BG[level]}`}
                title={`${member.name}: ${t(`skillLevel.${level}`)}`}
              >
                {member.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
              </div>
            ))}
            {hiddenCount > 0 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-0.5 shrink-0">+{hiddenCount}</span>
            )}
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-3 text-xs shrink-0">
            <span className="text-slate-400 dark:text-slate-500 tabular-nums w-8 text-right">{ratedCount}/{members.length}</span>
            {avgLevel > 0 ? (
              <span className={`font-semibold tabular-nums w-8 text-right ${avgLevel >= 4 ? 'text-indigo-600 dark:text-indigo-400' : avgLevel >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                Ø {avgLevel.toFixed(1)}
              </span>
            ) : (
              <span className="w-8 text-right" />
            )}
            {expertCount > 0 ? (
              <span className="flex items-center gap-0.5 font-medium text-indigo-500 dark:text-indigo-400 w-8">
                <Star className="w-3 h-3 shrink-0" /> {expertCount}
              </span>
            ) : (
              <span className="w-8" />
            )}
          </div>

          {/* Hover actions */}
          {canWrite && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(sk) }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title={t('competencies.editSkill')}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(sk) }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title={t('competencies.removeSkill')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Expand chevron */}
          <ChevronRight className={`w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        </div>

        {/* Expanded member detail */}
        {isExpanded && (
          <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/30 border-l-[3px] border-l-transparent border-t border-slate-100 dark:border-slate-800">
            {sk.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">{sk.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {memberLevelData.map(({ member, level }) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-opacity ${
                    level === 0
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-semibold shrink-0"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {member.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{member.name.split(' ')[0]}</span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${LEVEL_BG[level]}`}>
                    {level === 0 ? '—' : level}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </React.Fragment>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pb-4">
      {/* Sort controls */}
      <div className="flex items-center gap-1 mb-3 text-xs">
        <span className="text-slate-400 dark:text-slate-500 mr-1">{t('competencies.sortBy')}</span>
        {([
          ['name', t('competencies.sortName')],
          ['avg', t('competencies.sortAvg')],
          ['coverage', t('competencies.sortCoverage')],
        ] as [CatalogSortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              sortKey === key
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped areas */}
      {grouped.map(({ area, cats }) => {
        const isCollapsed = collapsedAreaIds.has(area.id)
        const skillCount = cats.reduce((s, c) => s + c.skills.length, 0)
        return (
          <div key={area.id} className="mb-5">
            <button
              onClick={() => toggleArea(area.id)}
              className="flex items-center gap-2 w-full mb-1.5 group"
            >
              <ChevronRight className={`w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{area.name}</span>
              <span className="text-xs text-indigo-400 dark:text-indigo-500 font-normal">({skillCount})</span>
              <div className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/40" />
            </button>

            {!isCollapsed && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {cats.map(({ cat, skills }, catIdx) => (
                  <React.Fragment key={cat.id}>
                    <div className={`flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-700 ${catIdx === 0 ? 'border-t-0' : ''}`}>
                      <span className="w-1 h-4 rounded-full bg-indigo-300 dark:bg-indigo-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">({skills.length})</span>
                    </div>
                    {sortSkills(skills).map((sk) => <SkillRow key={sk.id} sk={sk} />)}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Uncategorised */}
      {uncategorised.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('competencies.uncategorised')}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">({uncategorised.length})</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {sortSkills(uncategorised).map((sk) => <SkillRow key={sk.id} sk={sk} />)}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400 dark:text-slate-500 mt-2">
        {([0, 1, 2, 3, 4, 5] as SkillLevel[]).map((l) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${CATALOG_DOT_BG[l]}`}>
              {l === 0 ? '—' : l}
            </div>
            <span>{t(`skillLevel.${l}`)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
