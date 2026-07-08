import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { formatDate, todayISO, daysUntil } from '@/utils/date'
import {
  Plus, RefreshCw, Edit2, Trash2, Wand2, BarChart2, Settings,
  Archive, ChevronDown, List, Layers, CalendarRange, MoreHorizontal,
  ChevronRight, ChevronUp, Users, BookOpen, Save, X, Pencil,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ResponsibilityAssignment, ResponsibilityType, ResponsibilityTypeConfig, Sprint } from '@/types'
import { assignmentsApi, responsibilityTypeAttachmentsApi } from '@/api/client'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { differenceInDays, parseISO, addDays, format } from 'date-fns'
import { de } from 'date-fns/locale'

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLOR_OPTIONS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#f97316', '#0ea5e9',
  '#ec4899', '#84cc16', '#a855f7', '#e11d48',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type AssignmentStatus = 'active' | 'upcoming' | 'ended'
type ViewMode = 'list' | 'grouped' | 'timeline'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatus(a: ResponsibilityAssignment): AssignmentStatus {
  const today = todayISO()
  if (a.endDate < today) return 'ended'
  if (a.startDate > today) return 'upcoming'
  return 'active'
}

function addDaysToISO(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RotationPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('rotation')
  const members        = useStore((s) => s.members).filter((m) => m.isActive)
  const allMembers     = useStore((s) => s.members)
  const sprints        = useStore((s) => s.sprints)
  const assignments    = useStore((s) => s.assignments)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)

  const addAssignment          = useStore((s) => s.addAssignment)
  const updateAssignment       = useStore((s) => s.updateAssignment)
  const deleteAssignment       = useStore((s) => s.deleteAssignment)
  const suggestNextAssignee    = useStore((s) => s.suggestNextAssignee)
  const addResponsibilityType    = useStore((s) => s.addResponsibilityType)
  const updateResponsibilityType = useStore((s) => s.updateResponsibilityType)
  const deleteResponsibilityType = useStore((s) => s.deleteResponsibilityType)
  const archiveOldAssignments  = useStore((s) => s.archiveOldAssignments)

  const typeNames = responsibilityTypes.map((rt) => rt.name)
  const colorOf   = (typeName: string) =>
    responsibilityTypes.find((rt) => rt.name === typeName)?.color ?? '#6366f1'

  // ─── Suggestions ────────────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  useEffect(() => {
    if (typeNames.length === 0) return
    let cancelled = false
    Promise.all(typeNames.map(async (n) => [n, await suggestNextAssignee(n)] as const))
      .then((results) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const [n, id] of results) { if (id) map[n] = id }
        setSuggestions(map)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.length, responsibilityTypes.length])

  // ─── Filters & view mode ────────────────────────────────────────────────────
  const [filterType,   setFilterType]   = useState<string>('all')
  const [filterMember, setFilterMember] = useState<string>('all')
  const [viewMode,     setViewMode]     = useState<ViewMode>('list')

  // ─── Assignment modal ────────────────────────────────────────────────────────
  const [showModal,    setShowModal]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<ResponsibilityAssignment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResponsibilityAssignment | null>(null)
  const [form,         setForm]         = useState<AssignmentFormData>(makeDefaultForm())
  const [formErrors,   setFormErrors]   = useState<Partial<AssignmentFormData>>({})
  const [assignmentSaveError, setAssignmentSaveError] = useState('')

  function makeDefaultForm(type?: ResponsibilityType, memberId?: string): AssignmentFormData {
    const today = todayISO()
    return {
      type: type ?? typeNames[0] ?? '',
      memberId: memberId ?? '',
      sprintId: '',
      startDate: today,
      endDate: addDaysToISO(today, 13),
      notes: '',
    }
  }

  async function openAdd(type?: string) {
    const suggested = type ? await suggestNextAssignee(type) : null
    setEditTarget(null)
    setForm(makeDefaultForm(type, suggested ?? ''))
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

  function setDurationPreset(days: number) {
    const end = addDaysToISO(form.startDate, days - 1)
    setForm((f) => ({ ...f, endDate: end }))
  }

  function validateAssignment(): boolean {
    const e: Partial<AssignmentFormData> = {}
    if (!form.type)      e.type      = t('rotation.responsibilityRequired')
    if (!form.memberId)  e.memberId  = t('rotation.memberRequired')
    if (!form.startDate) e.startDate = t('rotation.startDateRequired')
    if (!form.endDate)   e.endDate   = t('rotation.endDateRequired')
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = t('rotation.endDateAfterStart')
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleAssignmentSubmit() {
    if (!validateAssignment()) return
    const data = {
      type: form.type, memberId: form.memberId,
      sprintId: form.sprintId || undefined,
      startDate: form.startDate, endDate: form.endDate,
      notes: form.notes, isAutoSuggested: false, isSynthetic: false, isArchived: false,
    }
    try {
      if (editTarget) await updateAssignment(editTarget.id, data)
      else             await addAssignment(data)
      setShowModal(false)
    } catch (err) {
      setAssignmentSaveError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  // ─── Type management modal ───────────────────────────────────────────────────
  const [showTypeModal,      setShowTypeModal]      = useState(false)
  const [editTypeTarget,     setEditTypeTarget]     = useState<ResponsibilityTypeConfig | null>(null)
  const [deleteTypeTarget,   setDeleteTypeTarget]   = useState<ResponsibilityTypeConfig | null>(null)
  const [typeForm,           setTypeForm]           = useState<TypeFormData>({ name: '', color: COLOR_OPTIONS[0] })
  const [typeFormError,      setTypeFormError]      = useState('')

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
      if (editTypeTarget) await updateResponsibilityType(editTypeTarget.id, typeForm)
      else                 await addResponsibilityType(typeForm)
      setShowTypeModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTypeFormError(msg.includes('existiert') ? t('rotation.nameExists') : t('admin.errorSaving'))
    }
  }

  // ─── Type documentation modal ────────────────────────────────────────────────
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [docsTarget,    setDocsTarget]    = useState<ResponsibilityTypeConfig | null>(null)
  const [docsEditing,   setDocsEditing]   = useState(false)
  const [docsValue,     setDocsValue]     = useState('')
  const [docsSaving,    setDocsSaving]    = useState(false)
  const [docsError,     setDocsError]     = useState('')

  function openDocs(rt: ResponsibilityTypeConfig) {
    setDocsTarget(rt)
    setDocsValue(rt.documentation ?? '')
    setDocsEditing(canWrite && !rt.documentation)
    setDocsError('')
    setShowDocsModal(true)
  }

  function closeDocsModal() {
    setShowDocsModal(false)
    setDocsTarget(null)
    setDocsEditing(false)
  }

  async function handleDocsImageUpload(file: File): Promise<string> {
    const att = await responsibilityTypeAttachmentsApi.upload(docsTarget!.id, file)
    return att.filename
  }

  async function saveDocs() {
    if (!docsTarget) return
    setDocsSaving(true)
    setDocsError('')
    try {
      await updateResponsibilityType(docsTarget.id, { documentation: docsValue })
      setDocsTarget((prev) => (prev ? { ...prev, documentation: docsValue } : prev))
      setDocsEditing(false)
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : t('admin.errorSaving'))
    } finally {
      setDocsSaving(false)
    }
  }

  // ─── Stats modal ─────────────────────────────────────────────────────────────
  const [showStats, setShowStats] = useState(false)

  const stats = useMemo(() =>
    typeNames.reduce((acc, type) => {
      const ta = assignments.filter((a) => a.type === type && !a.isSynthetic && !a.isArchived)
      acc[type] = members.map((m) => ({
        member: m,
        total: ta.filter((a) => a.memberId === m.id).length,
        active: ta.filter((a) => a.memberId === m.id && getStatus(a) === 'active').length,
      })).sort((a, b) => b.total - a.total)
      return acc
    }, {} as Record<string, { member: typeof members[0]; total: number; active: number }[]>),
  [assignments, typeNames, members])

  // ─── Cleanup modal ────────────────────────────────────────────────────────────
  const [showCleanup,    setShowCleanup]    = useState(false)
  const [cleanupBefore,  setCleanupBefore]  = useState(todayISO)
  const [cleanupPreview, setCleanupPreview] = useState<{ count: number; items: ResponsibilityAssignment[] } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupDone,    setCleanupDone]    = useState<number | null>(null)

  function openCleanup() {
    setCleanupDone(null); setCleanupPreview(null); setCleanupBefore(todayISO()); setShowCleanup(true)
  }
  async function loadCleanupPreview(before: string) {
    setCleanupLoading(true)
    try { setCleanupPreview(await assignmentsApi.archivePreview(before)) }
    finally { setCleanupLoading(false) }
  }
  async function handleCleanupConfirm() {
    setCleanupLoading(true)
    try { setCleanupDone(await archiveOldAssignments(cleanupBefore)); setCleanupPreview(null) }
    finally { setCleanupLoading(false) }
  }

  // ─── More-menu dropdown ───────────────────────────────────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node))
        setShowMoreMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Collapsed groups (grouped view) ─────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  function toggleGroup(name: string) {
    setCollapsedGroups((s) => {
      const n = new Set(s)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const visibleAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (a.isSynthetic || a.isArchived) return false
      if (filterType   !== 'all' && a.type     !== filterType)   return false
      if (filterMember !== 'all' && a.memberId !== filterMember) return false
      return true
    })
  }, [assignments, filterType, filterMember])

  const sorted = useMemo(() =>
    [...visibleAssignments].sort((a, b) => {
      const sa = getStatus(a), sb = getStatus(b)
      const order: Record<AssignmentStatus, number> = { active: 0, upcoming: 1, ended: 2 }
      if (order[sa] !== order[sb]) return order[sa] - order[sb]
      if (sa === 'upcoming') return a.startDate.localeCompare(b.startDate)
      if (sa === 'active')   return a.endDate.localeCompare(b.endDate)
      return b.endDate.localeCompare(a.endDate)
    }),
  [visibleAssignments])

  // Active assignments per type (for Active Now section)
  const activeByType = useMemo(() =>
    responsibilityTypes.reduce((acc, rt) => {
      acc[rt.name] = assignments.find(
        (a) => a.type === rt.name && !a.isSynthetic && !a.isArchived && getStatus(a) === 'active'
      ) ?? null
      return acc
    }, {} as Record<string, ResponsibilityAssignment | null>),
  [assignments, responsibilityTypes])

  const nonSyntheticCount = assignments.filter((a) => !a.isSynthetic && !a.isArchived).length

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('rotation.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('rotation.count', { count: nonSyntheticCount })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* More menu */}
          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="secondary"
              onClick={() => setShowMoreMenu((v) => !v)}
              icon={<MoreHorizontal className="w-4 h-4" />}
              iconRight={showMoreMenu ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              className="h-10"
            />
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-20">
                {canWrite && <MenuButton icon={<Settings className="w-4 h-4" />} label={t('rotation.types')} onClick={() => { openAddType(); setShowMoreMenu(false) }} />}
                <MenuButton icon={<BarChart2 className="w-4 h-4" />} label={t('rotation.statistics')} onClick={() => { setShowStats(true); setShowMoreMenu(false) }} />
                {canWrite && <MenuButton icon={<Archive className="w-4 h-4" />} label={t('rotation.cleanup')} onClick={() => { openCleanup(); setShowMoreMenu(false) }} />}
              </div>
            )}
          </div>
          {canWrite && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openAdd()}>
              {t('rotation.newAssignment')}
            </Button>
          )}
        </div>
      </div>
      {isReadOnly && <ReadOnlyBanner />}

      {/* ── Active Now ── */}
      {responsibilityTypes.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            {t('rotation.activeNow')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {responsibilityTypes.map((rt) => {
              const active = activeByType[rt.name]
              const member = active ? allMembers.find((m) => m.id === active.memberId) : null
              const daysLeft = active ? daysUntil(active.endDate) : null
              const suggestedMember = suggestions[rt.name] ? allMembers.find((m) => m.id === suggestions[rt.name]) : null
              return (
                <div
                  key={rt.id}
                  role="button"
                  tabIndex={canWrite ? 0 : -1}
                  onClick={() => canWrite && openAdd(rt.name)}
                  onKeyDown={(e) => {
                    if (canWrite && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAdd(rt.name) }
                  }}
                  className={`text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 transition-all group ${canWrite ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate flex-1 min-w-0">{rt.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openDocs(rt) }}
                      title={t('rotation.documentation')}
                      className={`shrink-0 p-0.5 rounded transition-colors ${rt.documentation ? 'text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {member ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={member.name} color={member.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{member.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {daysLeft !== null && daysLeft >= 0
                            ? t('rotation.daysLeft', { count: daysLeft + 1 })
                            : t('rotation.endsToday')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Wand2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t('rotation.noActiveAssignment')}</p>
                        {suggestedMember && (
                          <p className="text-xs text-indigo-500 truncate">{t('rotation.suggestedShort')}: {suggestedMember.name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Filters + View Toggle ── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Type filter */}
          <TypeChip label={t('common.all')} active={filterType === 'all'} color="#64748b" onClick={() => setFilterType('all')} />
          {responsibilityTypes.map((rt) => (
            <TypeChip key={rt.id} label={rt.name} active={filterType === rt.name} color={rt.color} onClick={() => setFilterType(rt.name)} />
          ))}
          {/* Member filter */}
          {members.length > 1 && (
            <div className="relative">
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              >
                <option value="all">{t('rotation.allMembers')}</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <Users className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
          {([
            { mode: 'list' as ViewMode, icon: <List className="w-3.5 h-3.5" />, label: t('rotation.viewList') },
            { mode: 'grouped' as ViewMode, icon: <Layers className="w-3.5 h-3.5" />, label: t('rotation.viewGrouped') },
            { mode: 'timeline' as ViewMode, icon: <CalendarRange className="w-3.5 h-3.5" />, label: t('rotation.viewTimeline') },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      {sorted.length === 0 && viewMode !== 'timeline' ? (
        <EmptyState
          icon={<RefreshCw className="w-12 h-12" />}
          title={filterType !== 'all' || filterMember !== 'all' ? t('rotation.noAssignmentsForFilter') : t('rotation.newAssignment')}
          description=""
          action={filterType === 'all' && filterMember === 'all' && canWrite ? (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => openAdd()}>
              {t('rotation.newAssignment')}
            </Button>
          ) : undefined}
        />
      ) : viewMode === 'list' ? (
        <ListView
          assignments={sorted}
          allMembers={allMembers}
          sprints={sprints}
          colorOf={colorOf}
          onEdit={openEdit}
          onDelete={(a) => setDeleteTarget(a)}
        />
      ) : viewMode === 'grouped' ? (
        <GroupedView
          responsibilityTypes={responsibilityTypes}
          assignments={visibleAssignments}
          allMembers={allMembers}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onEdit={openEdit}
          onDelete={(a) => setDeleteTarget(a)}
          onAdd={openAdd}
          t={t}
        />
      ) : (
        <TimelineView
          responsibilityTypes={responsibilityTypes}
          assignments={visibleAssignments}
          allMembers={allMembers}
          sprints={sprints}
          t={t}
        />
      )}

      {/* ── Assignment Modal ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? t('common.edit') : t('rotation.newAssignment')}
        footer={
          <>
            {assignmentSaveError && <p className="flex-1 text-sm text-red-600">{assignmentSaveError}</p>}
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleAssignmentSubmit}>{editTarget ? t('common.save') : t('common.create')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('rotation.responsibility')}
              {formErrors.type && <span className="text-red-500 text-xs ml-1">{formErrors.type}</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {responsibilityTypes.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: rt.name }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === rt.name
                      ? 'text-white border-transparent'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                  style={form.type === rt.name ? { backgroundColor: rt.color, borderColor: rt.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: form.type === rt.name ? 'rgba(255,255,255,0.6)' : rt.color }} />
                  {rt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Member */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('sprintDetail.memberColumn')}
                {formErrors.memberId && <span className="text-red-500 text-xs ml-1">{formErrors.memberId}</span>}
              </label>
              <button type="button" onClick={autoSuggest} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Auto
              </button>
            </div>
            <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))} className="form-input">
              <option value="">{t('rotation.selectMember')}</option>
              {members.map((m) => {
                const count = assignments.filter((a) => a.type === form.type && a.memberId === m.id && !a.isSynthetic && !a.isArchived).length
                return <option key={m.id} value={m.id}>{m.name} ({count}×)</option>
              })}
            </select>
          </div>

          {/* Dates + presets */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sprints.startDate')}</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="form-input" />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('sprints.endDate')}
                  {formErrors.endDate && <span className="text-red-500 text-xs ml-1">{formErrors.endDate}</span>}
                </label>
                <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 dark:text-slate-500 self-center">{t('rotation.setDuration')}:</span>
              {[
                { label: t('rotation.oneWeek'),   days: 7  },
                { label: t('rotation.twoWeeks'),  days: 14 },
                { label: t('rotation.oneMonth'),  days: 30 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationPreset(days)}
                  className="px-2 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sprint */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pulse.sprintOptional')}</label>
            <select value={form.sprintId} onChange={(e) => setForm((f) => ({ ...f, sprintId: e.target.value }))} className="form-input">
              <option value="">{t('pulse.noSprint')}</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sprints.notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="form-textarea" />
          </div>
        </div>
      </Modal>

      {/* ── Type Management Modal ── */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => { setShowTypeModal(false); setEditTypeTarget(null) }}
        title={t('rotation.types')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {responsibilityTypes.map((rt) => (
              <div key={rt.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{rt.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">
                  {assignments.filter((a) => a.type === rt.name && !a.isSynthetic && !a.isArchived).length}×
                </span>
                <button onClick={() => openDocs(rt)} title={t('rotation.documentation')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openEditType(rt)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTypeTarget(rt)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {responsibilityTypes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">{t('rotation.noTypes')}</p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {editTypeTarget ? editTypeTarget.name : t('rotation.addType')}
            </h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => { setTypeForm((f) => ({ ...f, name: e.target.value })); setTypeFormError('') }}
                  placeholder={t('rotation.typeNamePlaceholder')}
                  className="form-input"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('rotation.color')}</label>
                <div className="flex flex-wrap gap-1.5 w-48">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTypeForm((f) => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${typeForm.color === c ? 'border-slate-700 dark:border-slate-300 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {typeFormError && <p className="text-xs text-red-500">{typeFormError}</p>}
            <div className="flex gap-2">
              {editTypeTarget && (
                <Button variant="secondary" onClick={() => { setEditTypeTarget(null); setTypeForm({ name: '', color: COLOR_OPTIONS[0] }); setTypeFormError('') }}>
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

      {/* ── Type Documentation Modal ── */}
      <Modal
        isOpen={showDocsModal}
        onClose={closeDocsModal}
        title={docsTarget ? `${t('rotation.documentation')} – ${docsTarget.name}` : t('rotation.documentation')}
        size="xl"
        footer={
          docsEditing ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!docsTarget?.documentation) { closeDocsModal(); return }
                  setDocsValue(docsTarget.documentation)
                  setDocsEditing(false)
                  setDocsError('')
                }}
              >
                <X className="w-4 h-4" />{t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={saveDocs} disabled={docsSaving}>
                <Save className="w-4 h-4" />{docsSaving ? '…' : t('common.save')}
              </Button>
            </>
          ) : canWrite ? (
            <Button variant="secondary" onClick={() => setDocsEditing(true)}>
              <Pencil className="w-4 h-4" />{t('common.edit')}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {docsError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{docsError}</p>}
          {docsEditing ? (
            <MarkdownEditor
              value={docsValue}
              onChange={setDocsValue}
              placeholder={t('rotation.documentationPlaceholder')}
              rows={14}
              onImageUpload={handleDocsImageUpload}
            />
          ) : docsTarget?.documentation ? (
            <MarkdownRenderer content={docsTarget.documentation} />
          ) : (
            <p className="text-sm text-slate-400 italic">{t('rotation.noDocumentation')}</p>
          )}
        </div>
      </Modal>

      {/* ── Stats Modal ── */}
      <Modal isOpen={showStats} onClose={() => setShowStats(false)} title={t('rotation.statistics')} size="lg">
        <div className="space-y-6">
          {responsibilityTypes.map((rt) => {
            const typeStats = stats[rt.name] ?? []
            const maxCount = Math.max(...typeStats.map((s) => s.total), 1)
            return (
              <div key={rt.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rt.color }} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{rt.name}</h3>
                  <span className="text-xs text-slate-400 ml-auto">
                    {assignments.filter((a) => a.type === rt.name && !a.isSynthetic && !a.isArchived).length} {t('rotation.totalCount')}
                  </span>
                </div>
                <div className="space-y-2">
                  {typeStats.map(({ member, total, active }) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" />
                      <span className="text-xs text-slate-600 dark:text-slate-400 w-24 shrink-0 truncate">{member.name}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${(total / maxCount) * 100}%`, backgroundColor: rt.color }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-6 text-right">{total}</span>
                      {active > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium w-12">{t('rotation.activeNow')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {responsibilityTypes.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">{t('rotation.noTypes')}</p>
          )}
        </div>
      </Modal>

      {/* ── Cleanup Modal ── */}
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
                  {cleanupLoading ? '…' : t('rotation.archiveCount', { count: cleanupPreview.count })}
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
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {t('rotation.archivedSuccess', { count: cleanupDone })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('rotation.archiveBefore')}</label>
              <input
                type="date"
                value={cleanupBefore}
                onChange={(e) => { setCleanupBefore(e.target.value); setCleanupPreview(null) }}
                className="form-input"
              />
            </div>
            <Button variant="secondary" onClick={() => loadCleanupPreview(cleanupBefore)} disabled={cleanupLoading || !cleanupBefore}>
              {cleanupLoading ? '…' : t('rotation.previewArchive')}
            </Button>
            {cleanupPreview && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`px-3 py-2 text-xs font-medium ${cleanupPreview.count === 0 ? 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                  {cleanupPreview.count === 0 ? t('rotation.nothingToArchive') : t('rotation.willBeArchived', { count: cleanupPreview.count })}
                </div>
                {cleanupPreview.items.slice(0, 8).map((a) => {
                  const member = allMembers.find((m) => m.id === a.memberId)
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(a.type) }} />
                      <span className="text-slate-500 dark:text-slate-400 w-28 shrink-0 truncate">{a.type}</span>
                      <span className="flex-1 font-medium text-slate-700 dark:text-slate-300">{member?.name ?? '—'}</span>
                      <span className="text-slate-400">{formatDate(a.startDate)} – {formatDate(a.endDate)}</span>
                    </div>
                  )
                })}
                {cleanupPreview.count > 8 && (
                  <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                    … {t('rotation.andMore', { count: cleanupPreview.count - 8 })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm dialogs ── */}
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
            try { await deleteResponsibilityType(deleteTypeTarget.id) }
            catch { /* deletion errors are surfaced by the store */ }
          }
        }}
        title={t('common.delete')}
        message={deleteTypeTarget?.name ?? ''}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const { t } = useTranslation()
  const styles: Record<AssignmentStatus, string> = {
    active:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    upcoming: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    ended:    'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${styles[status]}`}>
      {t(`rotation.status_${status}`)}
    </span>
  )
}

type MemberLike = { id: string; name: string; avatarColor: string }
type SprintLike = { id: string; name: string }

function AssignmentCard({
  a, allMembers, sprints, colorOf, onEdit, onDelete,
}: {
  a: ResponsibilityAssignment
  allMembers: MemberLike[]
  sprints: SprintLike[]
  colorOf: (t: string) => string
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
}) {
  const member = allMembers.find((m) => m.id === a.memberId)
  const sprint = a.sprintId ? sprints.find((s) => s.id === a.sprintId) : null
  const status = getStatus(a)
  if (!member) return null

  const durationDays = differenceInDays(parseISO(a.endDate), parseISO(a.startDate)) + 1
  const daysLeftVal  = daysUntil(a.endDate)

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 flex items-start gap-4 transition-colors ${
      status === 'ended' ? 'border-slate-200 dark:border-slate-800 opacity-60' :
      status === 'active' ? 'border-emerald-200 dark:border-emerald-800/50' :
      'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="w-1 h-full min-h-[3rem] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: colorOf(a.type) }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{a.type}</span>
          <StatusBadge status={status} />
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
        {a.notes && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 line-clamp-1 italic">{a.notes}</p>
        )}
      </div>
      <div className="text-right shrink-0 space-y-1 min-w-[5rem]">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <div>{formatDate(a.startDate)}</div>
          <div>– {formatDate(a.endDate)}</div>
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {durationDays}d
          {status === 'active' && daysLeftVal >= 0 && (
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">· {daysLeftVal + 1}d left</span>
          )}
          {status === 'upcoming' && (
            <span className="ml-1 text-blue-500">· in {daysUntil(a.startDate)}d</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0 mt-0.5">
        <button onClick={() => onEdit(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ListView({
  assignments, allMembers, sprints, colorOf, onEdit, onDelete,
}: {
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  sprints: SprintLike[]
  colorOf: (t: string) => string
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
}) {
  return (
    <div className="space-y-2">
      {assignments.map((a) => (
        <AssignmentCard key={a.id} a={a} allMembers={allMembers} sprints={sprints} colorOf={colorOf} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}

function GroupedView({
  responsibilityTypes, assignments, allMembers,
  collapsedGroups, onToggleGroup, onEdit, onDelete, onAdd, t,
}: {
  responsibilityTypes: ResponsibilityTypeConfig[]
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  collapsedGroups: Set<string>
  onToggleGroup: (name: string) => void
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
  onAdd: (type: string) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div className="space-y-3">
      {responsibilityTypes.map((rt) => {
        const group = [...assignments.filter((a) => a.type === rt.name)]
          .sort((a, b) => {
            const order: Record<AssignmentStatus, number> = { active: 0, upcoming: 1, ended: 2 }
            const sa = getStatus(a), sb = getStatus(b)
            if (order[sa] !== order[sb]) return order[sa] - order[sb]
            if (sa === 'upcoming') return a.startDate.localeCompare(b.startDate)
            if (sa === 'active')   return a.endDate.localeCompare(b.endDate)
            return b.endDate.localeCompare(a.endDate)
          })
        const collapsed = collapsedGroups.has(rt.name)
        const activeCount = group.filter((a) => getStatus(a) === 'active').length

        return (
          <div key={rt.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => onToggleGroup(rt.name)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
              <span className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-200">{rt.name}</span>
              {activeCount > 0 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                  {activeCount} aktiv
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">{group.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(rt.name) }}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ml-1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>
            {!collapsed && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {group.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">{t('rotation.noAssignmentsForFilter')}</p>
                ) : group.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge status={getStatus(a)} />
                        {a.isAutoSuggested && <Wand2 className="w-3 h-3 text-indigo-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar name={allMembers.find((m) => m.id === a.memberId)?.name ?? '?'} color={allMembers.find((m) => m.id === a.memberId)?.avatarColor ?? '#ccc'} size="xs" />
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{allMembers.find((m) => m.id === a.memberId)?.name}</span>
                      </div>
                      {a.notes && <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">{a.notes}</p>}
                    </div>
                    <div className="text-xs text-slate-400 text-right shrink-0 space-y-0.5">
                      <div>{formatDate(a.startDate)}</div>
                      <div>– {formatDate(a.endDate)}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => onEdit(a)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(a)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline (Gantt) View ────────────────────────────────────────────────────
const RANGE_PRESETS = [
  { label: '4W',  weeksBack: 1, weeksAhead:  3 },
  { label: '8W',  weeksBack: 2, weeksAhead:  6 },
  { label: '12W', weeksBack: 2, weeksAhead: 10 },
  { label: '6M',  weeksBack: 4, weeksAhead: 22 },
] as const

const BAR_H     = 22  // px height per bar
const BAR_GAP   =  3  // px gap between stacked bars in the same row
const BAR_PAD_V =  5  // px vertical padding above/below all bars

function layoutBars(
  assignments: ResponsibilityAssignment[],
  timelineStart: Date,
  totalDays: number,
): { a: ResponsibilityAssignment; row: number }[] {
  const visible = assignments.filter((a) => {
    const s = differenceInDays(parseISO(a.startDate), timelineStart)
    const e = differenceInDays(parseISO(a.endDate), timelineStart)
    return e >= 0 && s < totalDays
  })
  const sorted = [...visible].sort((x, y) => x.startDate.localeCompare(y.startDate))
  const trackEnds: number[] = []
  return sorted.map((a) => {
    const startDay = differenceInDays(parseISO(a.startDate), timelineStart)
    const endDay   = differenceInDays(parseISO(a.endDate), timelineStart)
    // track is free only if it ended strictly before this bar starts (same-day = overlap)
    let idx = trackEnds.findIndex((e) => e < startDay)
    if (idx === -1) { idx = trackEnds.length; trackEnds.push(endDay) }
    else trackEnds[idx] = endDay
    return { a, row: idx }
  })
}

function sprintColors(status: string) {
  if (status === 'Aktiv')         return { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.40)',  color: '#6366f1' }
  if (status === 'Abgeschlossen') return { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)',  color: '#10b981' }
  if (status === 'Abgebrochen')   return { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' }
  return                                 { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.30)', color: '#64748b' }
}

function TimelineView({
  responsibilityTypes, assignments, allMembers, sprints, t,
}: {
  responsibilityTypes: ResponsibilityTypeConfig[]
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  sprints: Sprint[]
  t: (key: string) => string
}) {
  const [rangePreset, setRangePreset] = useState(1)
  const { weeksBack, weeksAhead } = RANGE_PRESETS[rangePreset]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const timelineStart = new Date(today)
  timelineStart.setDate(today.getDate() - weeksBack * 7)
  const dow = timelineStart.getDay()
  timelineStart.setDate(timelineStart.getDate() + (dow === 0 ? -6 : 1 - dow))

  const totalWeeks = weeksBack + weeksAhead
  const totalDays  = totalWeeks * 7

  const weeks = Array.from({ length: totalWeeks }, (_, i) => {
    const ws = addDays(timelineStart, i * 7)
    return {
      start: ws,
      label: format(ws, 'd. MMM', { locale: de }),
      isCurrentWeek: ws <= today && addDays(ws, 6) >= today,
    }
  })

  const todayOffset = differenceInDays(today, timelineStart)
  const todayPct    = (todayOffset / totalDays) * 100

  function barStyle(startISO: string, endISO: string, color: string) {
    const s = parseISO(startISO)
    const e = parseISO(endISO)
    const startDay = Math.max(0, differenceInDays(s, timelineStart))
    const endDay   = Math.min(totalDays - 1, differenceInDays(e, timelineStart))
    if (endDay < 0 || startDay >= totalDays) return null
    const left  = (startDay / totalDays) * 100
    const width = ((endDay - startDay + 1) / totalDays) * 100
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: color }
  }

  function sprintPos(startISO: string, endISO: string) {
    const startDay = Math.max(0, differenceInDays(parseISO(startISO), timelineStart))
    const endDay   = Math.min(totalDays - 1, differenceInDays(parseISO(endISO), timelineStart))
    if (endDay < 0 || startDay >= totalDays) return null
    return {
      left:  `${(startDay / totalDays) * 100}%`,
      width: `${Math.max((endDay - startDay + 1) / totalDays * 100, 0.5)}%`,
    }
  }

  const visibleSprints = sprints.filter((s) => sprintPos(s.startDate, s.endDate) !== null)

  if (responsibilityTypes.length === 0) {
    return <div className="text-center py-12 text-sm text-slate-400">{t('rotation.noTypes')}</div>
  }

  const WEEK_MIN_PX = 52

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Range selector */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
          {RANGE_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setRangePreset(i)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                rangePreset === i
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable chart */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${144 + totalWeeks * WEEK_MIN_PX}px` }}>

          {/* Week header */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <div className="w-36 shrink-0 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
              {t('rotation.responsibility')}
            </div>
            <div className="flex flex-1">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className={`flex-1 min-w-0 px-1 py-2 text-[10px] text-center font-medium border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                    w.isCurrentWeek ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {w.label}
                </div>
              ))}
            </div>
          </div>

          {/* Sprint band */}
          {visibleSprints.length > 0 && (
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/20">
              <div className="w-36 shrink-0 flex items-center px-3 border-r border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sprints</span>
              </div>
              <div className="flex-1 relative h-8">
                <div className="absolute inset-0 flex pointer-events-none">
                  {weeks.map((w, i) => (
                    <div key={i} className={`flex-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${w.isCurrentWeek ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`} />
                  ))}
                </div>
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/40 dark:bg-red-500/40 z-10 pointer-events-none" style={{ left: `${todayPct}%` }} />
                {visibleSprints.map((s) => {
                  const pos = sprintPos(s.startDate, s.endDate)
                  if (!pos) return null
                  const c = sprintColors(s.status)
                  return (
                    <div
                      key={s.id}
                      className="absolute top-1 bottom-1 rounded flex items-center px-1.5 overflow-hidden"
                      style={{ left: pos.left, width: pos.width, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                      title={`${s.name} (${formatDate(s.startDate)} – ${formatDate(s.endDate)})`}
                    >
                      <span className="text-[9px] font-semibold truncate" style={{ color: c.color }}>{s.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rows */}
          {responsibilityTypes.map((rt) => {
            const layout    = layoutBars(assignments.filter((a) => a.type === rt.name), timelineStart, totalDays)
            const numSubRows = layout.length > 0 ? Math.max(...layout.map((l) => l.row)) + 1 : 0
            const rowMinH   = BAR_PAD_V * 2 + Math.max(1, numSubRows) * BAR_H + Math.max(0, numSubRows - 1) * BAR_GAP

            return (
              <div
                key={rt.id}
                className="flex border-b border-slate-100 dark:border-slate-800 last:border-b-0 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                style={{ minHeight: rowMinH }}
              >
                <div className="w-36 shrink-0 flex items-start gap-2 px-3 pt-[7px] border-r border-slate-100 dark:border-slate-800">
                  <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: rt.color }} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{rt.name}</span>
                </div>
                <div className="flex-1 relative" style={{ minHeight: rowMinH }}>
                  {/* Week grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {weeks.map((w, i) => (
                      <div
                        key={i}
                        className={`flex-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                          w.isCurrentWeek ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''
                        }`}
                      />
                    ))}
                  </div>

                  {/* Today line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-400 dark:bg-red-500 z-10 pointer-events-none"
                    style={{ left: `${todayPct}%` }}
                  />

                  {/* Assignment bars (stacked to avoid overlap) */}
                  {layout.map(({ a, row }) => {
                    const bs = barStyle(a.startDate, a.endDate, rt.color)
                    if (!bs) return null
                    const member = allMembers.find((m) => m.id === a.memberId)
                    const status = getStatus(a)
                    const topPx  = BAR_PAD_V + row * (BAR_H + BAR_GAP)
                    return (
                      <div
                        key={a.id}
                        className="absolute rounded flex items-center px-2 overflow-hidden"
                        style={{ ...bs, top: topPx, height: BAR_H, opacity: status === 'ended' ? 0.45 : 1 }}
                        title={`${a.type}: ${member?.name} (${formatDate(a.startDate)} – ${formatDate(a.endDate)})`}
                      >
                        {member && (
                          <span className="text-[10px] font-semibold text-white truncate drop-shadow-sm">
                            {member.name}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {layout.length === 0 && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs text-slate-300 dark:text-slate-600 italic">—</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Today legend */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <div className="w-3 h-0.5 bg-red-400" />
            {t('rotation.today')} ({format(today, 'd. MMM yyyy', { locale: de })})
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TypeChip ─────────────────────────────────────────────────────────────────
function TypeChip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
        active
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
      }`}
      style={active ? { backgroundColor: color, borderColor: color } : {}}
    >
      {label !== 'Alle' && label !== 'All' && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,0.7)' : color }} />
      )}
      {label}
    </button>
  )
}
