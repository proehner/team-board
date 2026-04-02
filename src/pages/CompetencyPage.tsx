import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Star, Edit2, Trash2, Info } from 'lucide-react'
import type { Skill, SkillCategory, SkillLevel, TeamMember, MemberSkill } from '@/types'

const CATEGORIES: SkillCategory[] = [
  'Frontend', 'Backend', 'DevOps', 'Testing', 'Datenbank', 'Soft Skills', 'Sonstiges',
]

const LEVEL_BG: Record<SkillLevel, string> = {
  0: 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600',
  1: 'bg-blue-50 text-blue-400',
  2: 'bg-blue-100 text-blue-600',
  3: 'bg-indigo-200 text-indigo-700',
  4: 'bg-indigo-400 text-white',
  5: 'bg-indigo-700 text-white',
}

type Tab = 'matrix' | 'katalog'

export default function CompetencyPage() {
  const { t } = useTranslation()
  const members = useStore((s) => s.members).filter((m) => m.isActive)
  const skills = useStore((s) => s.skills)
  const memberSkills = useStore((s) => s.memberSkills)
  const addSkill = useStore((s) => s.addSkill)
  const updateSkill = useStore((s) => s.updateSkill)
  const deleteSkill = useStore((s) => s.deleteSkill)
  const setMemberSkillLevel = useStore((s) => s.setMemberSkillLevel)

  const [tab, setTab] = useState<Tab>('matrix')
  const [filterCategory, setFilterCategory] = useState<SkillCategory | 'Alle'>('Alle')
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [deleteSkillTarget, setDeleteSkillTarget] = useState<Skill | null>(null)
  const [skillForm, setSkillForm] = useState({ name: '', category: 'Frontend' as SkillCategory, description: '' })

  // Popover state for cell editing
  const [activeCell, setActiveCell] = useState<{ memberId: string; skillId: string } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeCell) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveCell(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeCell])

  const getLevel = (memberId: string, skillId: string): SkillLevel => {
    const ms = memberSkills.find((m) => m.memberId === memberId && m.skillId === skillId)
    return (ms?.level ?? 0) as SkillLevel
  }

  const filteredSkills =
    filterCategory === 'Alle'
      ? skills
      : skills.filter((s) => s.category === filterCategory)

  const groupedSkills = CATEGORIES.reduce((acc, cat) => {
    const catSkills = filteredSkills.filter((s) => s.category === cat)
    if (catSkills.length > 0) acc[cat] = catSkills
    return acc
  }, {} as Record<string, Skill[]>)

  function openAddSkill() {
    setEditSkill(null)
    setSkillForm({ name: '', category: 'Frontend', description: '' })
    setShowSkillModal(true)
  }

  function openEditSkill(sk: Skill) {
    setEditSkill(sk)
    setSkillForm({ name: sk.name, category: sk.category, description: sk.description ?? '' })
    setShowSkillModal(true)
  }

  async function handleSkillSubmit() {
    if (!skillForm.name.trim()) return
    try {
      if (editSkill) {
        await updateSkill(editSkill.id, skillForm)
      } else {
        await addSkill(skillForm)
      }
      setShowSkillModal(false)
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('competencies.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('competencies.subtitle', { count: members.length })}</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAddSkill}>
          {t('competencies.addSkill')}
        </Button>
      </div>

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

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {(['Alle', ...CATEGORIES] as (SkillCategory | 'Alle')[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filterCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
            }`}
          >
            {cat === 'Alle' ? t('common.all') : cat}
          </button>
        ))}
      </div>

      {tab === 'matrix' ? (
        <MatrixTab
          members={members}
          groupedSkills={groupedSkills}
          getLevel={getLevel}
          activeCell={activeCell}
          setActiveCell={setActiveCell}
          setMemberSkillLevel={setMemberSkillLevel}
          popoverRef={popoverRef}
        />
      ) : (
        <CatalogTab
          filteredSkills={filteredSkills}
          memberSkills={memberSkills}
          members={members}
          onEdit={openEditSkill}
          onDelete={(sk) => setDeleteSkillTarget(sk)}
        />
      )}

      {/* Skill Modal */}
      <Modal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        title={editSkill ? t('competencies.editSkill') : t('competencies.newSkill')}
        footer={
          <>
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
            <select
              value={skillForm.category}
              onChange={(e) => setSkillForm((f) => ({ ...f, category: e.target.value as SkillCategory }))}
              className="form-input"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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

      <ConfirmDialog
        isOpen={!!deleteSkillTarget}
        onClose={() => setDeleteSkillTarget(null)}
        onConfirm={() => { if (deleteSkillTarget) deleteSkill(deleteSkillTarget.id) }}
        title={t('competencies.removeSkill')}
        message={t('competencies.removeConfirm', { name: deleteSkillTarget?.name })}
        confirmLabel={t('common.remove')}
      />
    </div>
  )
}

interface MatrixTabProps {
  members: TeamMember[]
  groupedSkills: Record<string, Skill[]>
  getLevel: (memberId: string, skillId: string) => SkillLevel
  activeCell: { memberId: string; skillId: string } | null
  setActiveCell: (cell: { memberId: string; skillId: string } | null) => void
  setMemberSkillLevel: (memberId: string, skillId: string, level: SkillLevel) => void
  popoverRef: React.RefObject<HTMLDivElement>
}

function MatrixTab({ members, groupedSkills, getLevel, activeCell, setActiveCell, setMemberSkillLevel, popoverRef }: MatrixTabProps) {
  const { t } = useTranslation()
  if (members.length === 0 || Object.keys(groupedSkills).length === 0) {
    return (
      <EmptyState
        icon={<Star className="w-12 h-12" />}
        title={t('competencies.noData')}
        description={t('competencies.noDataSubtitle')}
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="text-sm min-w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-52 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
              {t('competencies.skillColumn')}
            </th>
            {members.map((m) => (
              <th key={m.id} className="px-3 py-3 text-center text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[90px]">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                  </div>
                  <span className="truncate max-w-[80px]">{m.name.split(' ')[0]}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedSkills).map(([category, catSkills]) => (
            <React.Fragment key={`cat-${category}`}>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <td
                  colSpan={members.length + 1}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0"
                >
                  {category}
                </td>
              </tr>
              {catSkills.map((skill) => (
                <tr key={skill.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10 w-52">
                    <div className="flex items-center gap-1">
                      {skill.description && (
                        <span title={skill.description}>
                          <Info className="w-3.5 h-3.5 text-slate-300" />
                        </span>
                      )}
                      {skill.name}
                    </div>
                  </td>
                  {members.map((m) => {
                    const level = getLevel(m.id, skill.id)
                    const isActive = activeCell?.memberId === m.id && activeCell?.skillId === skill.id
                    return (
                      <td key={m.id} className="px-2 py-1.5 text-center relative">
                        <button
                          onClick={() => setActiveCell(isActive ? null : { memberId: m.id, skillId: skill.id })}
                          className={`w-16 h-8 rounded-lg text-xs font-semibold transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${LEVEL_BG[level]}`}
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
                                onClick={() => {
                                  setMemberSkillLevel(m.id, skill.id, l)
                                  setActiveCell(null)
                                }}
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
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
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
  )
}

interface CatalogTabProps {
  filteredSkills: Skill[]
  memberSkills: MemberSkill[]
  members: TeamMember[]
  onEdit: (sk: Skill) => void
  onDelete: (sk: Skill) => void
}

function CatalogTab({ filteredSkills, memberSkills, members, onEdit, onDelete }: CatalogTabProps) {
  const { t } = useTranslation()
  if (filteredSkills.length === 0) {
    return (
      <EmptyState
        icon={<Star className="w-12 h-12" />}
        title={t('competencies.noSkills')}
        description={t('competencies.noSkillsSubtitle')}
      />
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredSkills.map((sk) => {
        const levels = memberSkills.filter((ms) => ms.skillId === sk.id && ms.level > 0)
        const expertCount = levels.filter((ms) => ms.level >= 4).length
        const avgLevel = levels.length > 0
          ? Math.round(levels.reduce((s, ms) => s + ms.level, 0) / levels.length * 10) / 10
          : 0

        return (
          <div key={sk.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{sk.name}</p>
                <span className="inline-block mt-0.5 px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                  {sk.category}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(sk)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(sk)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {sk.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{sk.description}</p>}
            <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('competencies.membersRated', { rated: levels.length, total: members.length })}</span>
              {avgLevel > 0 && <span>{t('competencies.avgLevel', { level: avgLevel })}</span>}
              {expertCount > 0 && <span><span className="font-semibold text-slate-700 dark:text-slate-300">{expertCount}</span> {t('competencies.experts')}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
