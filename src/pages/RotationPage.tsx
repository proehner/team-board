import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, todayISO } from '@/utils/date'
import { Plus, RefreshCw, Edit2, Trash2, Wand2, BarChart2, Settings, Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ResponsibilityAssignment, ResponsibilityType, ResponsibilityTypeConfig } from '@/types'
import { assignmentsApi } from '@/api/client'

// ─── Colour palette for new types ────────────────────────────────────────────
const COLOR_OPTIONS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#f97316', '#0ea5e9',
  '#ec4899', '#84cc16', '#a855f7', '#e11d48',
]

interface AssignmentFormData {
  type: string
  memberId: string
  sprintId: string
  startDate: string
  endDate: string
  notes: string
}

interface TypeFormData {
  name: string
  color: string
}

export default function RotationPage() {
  const { t } = useTranslation()
  const members = useStore((s) => s.members).filter((m) => m.isActive)
  const allMembers = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)
  const addAssignment = useStore((s) => s.addAssignment)
  const updateAssignment = useStore((s) => s.updateAssignment)
  const deleteAssignment = useStore((s) => s.deleteAssignment)
  const suggestNextAssignee = useStore((s) => s.suggestNextAssignee)
  const addResponsibilityType = useStore((s) => s.addResponsibilityType)
  const updateResponsibilityType = useStore((s) => s.updateResponsibilityType)
  const deleteResponsibilityType = useStore((s) => s.deleteResponsibilityType)

  const typeNames = responsibilityTypes.map((t) => t.name)
  const colorOf = (typeName: string) =>
    responsibilityTypes.find((t) => t.name === typeName)?.color ?? '#6366f1'

  const [filterType, setFilterType] = useState<string>('all')
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (typeNames.length === 0) return
    let cancelled = false
    Promise.all(
      typeNames.map(async (t) => {
        const id = await suggestNextAssignee(t)
        return [t, id] as const
      }),
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const [t, id] of results) { if (id) map[t] = id }
      setSuggestions(map)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length, responsibilityTypes.length])

  // ─── Assignment modal ──────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ResponsibilityAssignment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResponsibilityAssignment | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [form, setForm] = useState<AssignmentFormData>(defaultForm())
  const [formErrors, setFormErrors] = useState<Partial<AssignmentFormData>>({})

  // ─── Cleanup modal ────────────────────────────────────────────────────────
  const archiveOldAssignments = useStore((s) => s.archiveOldAssignments)
  const [showCleanup, setShowCleanup] = useState(false)
  const [cleanupBefore, setCleanupBefore] = useState(todayISO)
  const [cleanupPreview, setCleanupPreview] = useState<{ count: number; items: ResponsibilityAssignment[] } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<number | null>(null)

  async function openCleanup() {
    setCleanupDone(null)
    setCleanupPreview(null)
    setCleanupBefore(todayISO())
    setShowCleanup(true)
  }

  async function loadCleanupPreview(before: string) {
    setCleanupLoading(true)
    try {
      const preview = await assignmentsApi.archivePreview(before)
      setCleanupPreview(preview)
    } finally {
      setCleanupLoading(false)
    }
  }

  async function handleCleanupConfirm() {
    setCleanupLoading(true)
    try {
      const archived = await archiveOldAssignments(cleanupBefore)
      setCleanupDone(archived)
      setCleanupPreview(null)
    } finally {
      setCleanupLoading(false)
    }
  }

  // ─── Type management modal ─────────────────────────────────────────────────
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editTypeTarget, setEditTypeTarget] = useState<ResponsibilityTypeConfig | null>(null)
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<ResponsibilityTypeConfig | null>(null)
  const [typeForm, setTypeForm] = useState<TypeFormData>({ name: '', color: COLOR_OPTIONS[0] })
  const [typeFormError, setTypeFormError] = useState('')

  function defaultForm(type?: ResponsibilityType, memberId?: string): AssignmentFormData {
    const today = todayISO()
    const twoWeeks = new Date()
    twoWeeks.setDate(twoWeeks.getDate() + 13)
    return {
      type: type ?? typeNames[0] ?? '',
      memberId: memberId ?? '',
      sprintId: '',
      startDate: today,
      endDate: twoWeeks.toISOString().split('T')[0],
      notes: '',
    }
  }

  async function openAdd(type?: string) {
    const suggested = type ? await suggestNextAssignee(type) : null
    setEditTarget(null)
    setForm(defaultForm(type, suggested ?? ''))
    setFormErrors({})
    setShowModal(true)
  }

  function openEdit(a: ResponsibilityAssignment) {
    setEditTarget(a)
    setForm({ type: a.type, memberId: a.memberId, sprintId: a.sprintId ?? '', startDate: a.startDate, endDate: a.endDate, notes: a.notes })
    setFormErrors({})
    setShowModal(true)
  }

  async function autoSuggest() {
    const id = await suggestNextAssignee(form.type)
    if (id) setForm((f) => ({ ...f, memberId: id }))
  }

  function validateAssignment(): boolean {
    const e: Partial<AssignmentFormData> = {}
    if (!form.type) e.type = t('rotation.responsibilityRequired')
    if (!form.memberId) e.memberId = t('rotation.memberRequired')
    if (!form.startDate) e.startDate = t('rotation.startDateRequired')
    if (!form.endDate) e.endDate = t('rotation.endDateRequired')
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      e.endDate = t('rotation.endDateAfterStart')
    }
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAssignmentSubmit() {
    if (!validateAssignment()) return
    const data = {
      type: form.type,
      memberId: form.memberId,
      sprintId: form.sprintId || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes,
      isAutoSuggested: false,
      isSynthetic: false,
      isArchived: false,
    }
    try {
      if (editTarget) {
        await updateAssignment(editTarget.id, data)
      } else {
        await addAssignment(data)
      }
      setShowModal(false)
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  // ─── Type form handlers ────────────────────────────────────────────────────
  function openAddType() {
    setEditTypeTarget(null)
    setTypeForm({ name: '', color: COLOR_OPTIONS[responsibilityTypes.length % COLOR_OPTIONS.length] })
    setTypeFormError('')
    setShowTypeModal(true)
  }

  function openEditType(rt: ResponsibilityTypeConfig) {
    setEditTypeTarget(rt)
    setTypeForm({ name: rt.name, color: rt.color })
    setTypeFormError('')
    setShowTypeModal(true)
  }

  async function handleTypeSubmit() {
    if (!typeForm.name.trim()) { setTypeFormError(t('rotation.nameRequired')); return }
    try {
      if (editTypeTarget) {
        await updateResponsibilityType(editTypeTarget.id, typeForm)
      } else {
        await addResponsibilityType(typeForm)
      }
      setShowTypeModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTypeFormError(msg.includes('existiert') ? t('rotation.nameExists') : t('admin.errorSaving'))
    }
  }

  // ─── Derived ───────────────────────────────────────────────────────────────
  const visibleAssignments = filterType === 'all'
    ? assignments.filter((a) => !a.isSynthetic)
    : assignments.filter((a) => a.type === filterType && !a.isSynthetic)
  const sorted = [...visibleAssignments].sort((a, b) => b.startDate.localeCompare(a.startDate))

  const stats = typeNames.reduce((acc, type) => {
    const typeAssignments = assignments.filter((a) => a.type === type && !a.isSynthetic)
    acc[type] = members.map((m) => ({
      member: m,
      count: typeAssignments.filter((a) => a.memberId === m.id).length,
    })).sort((a, b) => b.count - a.count)
    return acc
  }, {} as Record<string, { member: typeof members[0]; count: number }[]>)

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('rotation.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('rotation.count', { count: assignments.filter((a) => !a.isSynthetic).length })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Archive className="w-4 h-4" />} onClick={openCleanup}>
            {t('rotation.cleanup')}
          </Button>
          <Button variant="secondary" icon={<Settings className="w-4 h-4" />} onClick={() => { openAddType(); setShowTypeModal(true) }}>
            {t('rotation.types')}
          </Button>
          <Button variant="secondary" icon={<BarChart2 className="w-4 h-4" />} onClick={() => setShowStats(true)}>
            {t('rotation.statistics')}
          </Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openAdd()}>
            {t('rotation.newAssignment')}
          </Button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <TypeChip label={t('common.all')} active={filterType === 'all'} color="#64748b" onClick={() => setFilterType('all')} />
        {responsibilityTypes.map((t) => (
          <TypeChip key={t.id} label={t.name} active={filterType === t.name} color={t.color} onClick={() => setFilterType(t.name)} />
        ))}
      </div>

      {/* Quick-add buttons per type */}
      {responsibilityTypes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {responsibilityTypes.map((rt) => {
            const suggestedMember = suggestions[rt.name] ? allMembers.find((m) => m.id === suggestions[rt.name]) : null
            return (
              <button
                key={rt.id}
                onClick={() => openAdd(rt.name)}
                className="text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rt.color }} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{rt.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                  {suggestedMember ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={suggestedMember.name} color={suggestedMember.avatarColor} size="xs" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{suggestedMember.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{t('rotation.suggestion')}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Assignment list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="w-12 h-12" />}
          title={t('rotation.newAssignment')}
          description=""
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openAdd()}>{t('rotation.newAssignment')}</Button>}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const member = allMembers.find((m) => m.id === a.memberId)
            const sprint = a.sprintId ? sprints.find((s) => s.id === a.sprintId) : null
            if (!member) return null
            return (
              <div key={a.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4">
                <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: colorOf(a.type) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{a.type}</span>
                    {sprint && <Badge label={sprint.name} variant="info" />}
                    {a.isAutoSuggested && (
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-500">
                        <Wand2 className="w-3 h-3" /> Auto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={member.name} color={member.avatarColor} size="xs" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{member.name}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 text-right shrink-0">
                  <div>{formatDate(a.startDate)}</div>
                  <div>– {formatDate(a.endDate)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assignment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? t('common.edit') : t('rotation.newAssignment')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleAssignmentSubmit}>{editTarget ? t('common.save') : t('common.create')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('rotation.title').split(' & ')[1] ?? 'Responsibility'} {formErrors.type && <span className="text-red-500 text-xs ml-1">{formErrors.type}</span>}
            </label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="form-input">
              <option value=""></option>
              {responsibilityTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('sprintDetail.memberColumn')} {formErrors.memberId && <span className="text-red-500 text-xs ml-1">{formErrors.memberId}</span>}
              </label>
              <button type="button" onClick={autoSuggest} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Auto
              </button>
            </div>
            <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))} className="form-input">
              <option value="">{t('rotation.selectMember')}</option>
              {members.map((m) => {
                const count = assignments.filter((a) => a.type === form.type && a.memberId === m.id && !a.isSynthetic).length
                return <option key={m.id} value={m.id}>{m.name} ({count}×)</option>
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sprints.startDate')}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="form-input" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('sprints.endDate')} {formErrors.endDate && <span className="text-red-500 text-xs">{formErrors.endDate}</span>}
              </label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="form-input" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pulse.sprintOptional')}</label>
            <select value={form.sprintId} onChange={(e) => setForm((f) => ({ ...f, sprintId: e.target.value }))} className="form-input">
              <option value="">{t('pulse.noSprint')}</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sprints.notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="form-textarea" />
          </div>
        </div>
      </Modal>

      {/* Type Management Modal */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => { setShowTypeModal(false); setEditTypeTarget(null) }}
        title={t('rotation.types')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {responsibilityTypes.map((rt) => (
              <div key={rt.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{rt.name}</span>
                <button onClick={() => openEditType(rt)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTypeTarget(rt)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {responsibilityTypes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4"></p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {editTypeTarget ? editTypeTarget.name : t('rotation.newAssignment')}
            </h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => { setTypeForm((f) => ({ ...f, name: e.target.value })); setTypeFormError('') }}
                  className="form-input"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Color</label>
                <div className="flex flex-wrap gap-1.5 w-48">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTypeForm((f) => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${typeForm.color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {typeFormError && <p className="text-xs text-red-500">{typeFormError}</p>}
            <div className="flex gap-2">
              {editTypeTarget && (
                <Button variant="secondary" onClick={() => { setEditTypeTarget(null); setTypeForm({ name: '', color: COLOR_OPTIONS[0] }) }}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button variant="primary" icon={editTypeTarget ? undefined : <Plus className="w-4 h-4" />} onClick={handleTypeSubmit}>
                {editTypeTarget ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Stats Modal */}
      <Modal isOpen={showStats} onClose={() => setShowStats(false)} title={t('rotation.statistics')} size="lg">
        <div className="space-y-6">
          {responsibilityTypes.map((rt) => {
            const typeStats = stats[rt.name] ?? []
            const maxCount = Math.max(...typeStats.map((s) => s.count), 1)
            return (
              <div key={rt.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rt.color }} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{rt.name}</h3>
                </div>
                <div className="space-y-1.5">
                  {typeStats.map(({ member, count }) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" />
                      <span className="text-xs text-slate-600 dark:text-slate-400 w-24 shrink-0 truncate">{member.name}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: rt.color }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Cleanup Modal */}
      <Modal
        isOpen={showCleanup}
        onClose={() => setShowCleanup(false)}
        title={t('rotation.cleanup')}
        footer={
          cleanupDone === null ? (
            <>
              <Button variant="secondary" onClick={() => setShowCleanup(false)}>{t('common.cancel')}</Button>
              {cleanupPreview && cleanupPreview.count > 0 && (
                <Button variant="primary" onClick={handleCleanupConfirm} disabled={cleanupLoading}>
                  {cleanupLoading ? '…' : `${cleanupPreview.count}`}
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" onClick={() => setShowCleanup(false)}>{t('common.confirm')}</Button>
          )
        }
      >
        {cleanupDone !== null ? (
          <div className="text-center py-6 space-y-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {cleanupDone} archived.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Archive entries that ended before:</label>
              <input
                type="date"
                value={cleanupBefore}
                onChange={(e) => { setCleanupBefore(e.target.value); setCleanupPreview(null) }}
                className="form-input"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => loadCleanupPreview(cleanupBefore)}
              disabled={cleanupLoading || !cleanupBefore}
            >
              {cleanupLoading ? '…' : 'Preview'}
            </Button>
            {cleanupPreview && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`px-3 py-2 text-xs font-medium ${cleanupPreview.count === 0 ? 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400' : 'bg-amber-50 text-amber-700'}`}>
                  {cleanupPreview.count === 0 ? 'Nothing to archive.' : `${cleanupPreview.count} entries will be archived`}
                </div>
                {cleanupPreview.items.slice(0, 8).map((a) => {
                  const member = allMembers.find((m) => m.id === a.memberId)
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(a.type) }} />
                      <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0">{a.type}</span>
                      <span className="flex-1 font-medium text-slate-700 dark:text-slate-300">{member?.name ?? '—'}</span>
                      <span className="text-slate-400 dark:text-slate-500">{formatDate(a.startDate)} – {formatDate(a.endDate)}</span>
                    </div>
                  )
                })}
                {cleanupPreview.count > 8 && (
                  <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
                    … and {cleanupPreview.count - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteAssignment(deleteTarget.id) }}
        title={t('common.delete')}
        message=""
        confirmLabel={t('common.delete')}
      />

      <ConfirmDialog
        isOpen={!!deleteTypeTarget}
        onClose={() => setDeleteTypeTarget(null)}
        onConfirm={async () => {
          if (deleteTypeTarget) {
            try {
              await deleteResponsibilityType(deleteTypeTarget.id)
            } catch {
              alert(t('admin.errorDeleting'))
            }
          }
        }}
        title={t('common.delete')}
        message={deleteTypeTarget?.name ?? ''}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

function TypeChip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
        active ? 'text-white border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
      }`}
      style={active ? { backgroundColor: color, borderColor: color } : {}}
    >
      {label !== 'Alle' && label !== 'All' && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,0.7)' : color }} />}
      {label}
    </button>
  )
}
