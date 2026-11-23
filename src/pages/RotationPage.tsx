import { useState, useMemo, type FormEvent } from 'react'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import Avatar from '@/components/ui/Avatar'
import Chip from '@/components/ui/Chip'
import Select from '@/components/ui/Select'
import Tabs from '@/components/ui/Tabs'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import AssignmentFormModal from '@/components/rotation/AssignmentFormModal'
import RotationPlanModal from '@/components/rotation/RotationPlanModal'
import RotationParticipantsModal from '@/components/rotation/RotationParticipantsModal'
import ResponsibilityCard from '@/components/rotation/ResponsibilityCard'
import RotationTimeline from '@/components/rotation/RotationTimeline'
import { ListView, GroupedView } from '@/components/rotation/AssignmentList'
import { compareAssignments } from '@/components/rotation/rotationUi'
import { usePagePermission } from '@/hooks/usePagePermission'
import { formatDate, formatDateShort, todayISO } from '@/utils/date'
import {
  assignmentStatus as getStatus, nextFreePeriod, nextOpenSprint, rankCandidates, suggestedCandidate,
} from '@/utils/rotation'
import {
  Plus, RefreshCw, Pencil, Trash2, BarChart2, Settings2, Archive, ChevronDown, ChevronUp, List, Layers,
  CalendarRange, MoreHorizontal, Users, BookOpen, Save, CalendarPlus, UserCheck, CalendarClock, X, Check, SearchX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ResponsibilityAssignment, ResponsibilityTypeConfig, TeamMember } from '@/types'
import { assignmentsApi, responsibilityTypeAttachmentsApi } from '@/api/client'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLOR_OPTIONS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#f97316', '#0ea5e9',
  '#ec4899', '#84cc16', '#a855f7', '#e11d48',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = 'list' | 'grouped' | 'timeline'

interface TypeFormData {
  name: string
  color: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RotationPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('rotation')
  const allMembers     = useStore((s) => s.members)
  const members        = useMemo(() => allMembers.filter((m) => m.isActive), [allMembers])
  const sprints        = useStore((s) => s.sprints)
  const assignments    = useStore((s) => s.assignments)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)

  const deleteAssignment         = useStore((s) => s.deleteAssignment)
  const addResponsibilityType    = useStore((s) => s.addResponsibilityType)
  const updateResponsibilityType = useStore((s) => s.updateResponsibilityType)
  const deleteResponsibilityType = useStore((s) => s.deleteResponsibilityType)
  const archiveOldAssignments    = useStore((s) => s.archiveOldAssignments)

  const typeNames = responsibilityTypes.map((rt) => rt.name)
  const colorOf   = (typeName: string) =>
    responsibilityTypes.find((rt) => rt.name === typeName)?.color ?? '#6366f1'

  // ─── Filters & view mode ────────────────────────────────────────────────────
  const [filterTypes,  setFilterTypes]  = useState<Set<string>>(new Set())
  const [filterMember, setFilterMember] = useState<string>('all')
  const [viewMode,     setViewMode]     = useState<ViewMode>('list')
  const [showPast,     setShowPast]     = useState(false)

  function toggleFilterType(name: string) {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  function resetFilters() {
    setFilterTypes(new Set())
    setFilterMember('all')
  }
  const typeMatches = (name: string) => filterTypes.size === 0 || filterTypes.has(name)
  const visibleTypes = responsibilityTypes.filter((rt) => typeMatches(rt.name))

  // ─── Assignment dialogs ─────────────────────────────────────────────────────
  const [formModal, setFormModal] = useState<{ open: boolean; assignment?: ResponsibilityAssignment; presetType?: string }>({ open: false })
  const [showPlan,         setShowPlan]         = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [deleteTarget,     setDeleteTarget]     = useState<ResponsibilityAssignment | null>(null)

  const openCreate = (presetType?: string) => setFormModal({ open: true, presetType })
  const openEdit   = (a: ResponsibilityAssignment) => { if (canWrite) setFormModal({ open: true, assignment: a }) }

  // ─── Type management modal ───────────────────────────────────────────────────
  const [showTypeModal,      setShowTypeModal]      = useState(false)
  const [editTypeTarget,     setEditTypeTarget]     = useState<ResponsibilityTypeConfig | null>(null)
  const [deleteTypeTarget,   setDeleteTypeTarget]   = useState<ResponsibilityTypeConfig | null>(null)
  const [typeForm,           setTypeForm]           = useState<TypeFormData>({ name: '', color: COLOR_OPTIONS[0] })
  const [typeFormError,      setTypeFormError]      = useState('')
  const [typeSaving,         setTypeSaving]         = useState(false)

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

  function cancelEditType() {
    setEditTypeTarget(null)
    setTypeForm({ name: '', color: COLOR_OPTIONS[responsibilityTypes.length % COLOR_OPTIONS.length] })
    setTypeFormError('')
  }

  async function handleTypeSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (typeSaving) return
    if (!typeForm.name.trim()) { setTypeFormError(t('rotation.nameRequired')); return }
    setTypeSaving(true)
    try {
      if (editTypeTarget) await updateResponsibilityType(editTypeTarget.id, typeForm)
      else                 await addResponsibilityType(typeForm)
      toast.success(editTypeTarget ? t('common.saved') : t('rotation.typeCreated', { name: typeForm.name.trim() }))
      setEditTypeTarget(null)
      setTypeForm({ name: '', color: COLOR_OPTIONS[(responsibilityTypes.length + 1) % COLOR_OPTIONS.length] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTypeFormError(msg.includes('already exists') ? t('rotation.nameExists') : t('admin.errorSaving'))
    } finally {
      setTypeSaving(false)
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
      toast.success(t('common.saved'))
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [assignments, typeNames.join('|'), members])

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
    catch (err) { toast.error(t('common.loadError'), { description: errorMessage(err) }) }
    finally { setCleanupLoading(false) }
  }
  async function handleCleanupConfirm() {
    setCleanupLoading(true)
    try { setCleanupDone(await archiveOldAssignments(cleanupBefore)); setCleanupPreview(null) }
    catch (err) { toast.error(t('common.saveError'), { description: errorMessage(err) }) }
    finally { setCleanupLoading(false) }
  }

  // ─── Collapsed groups (grouped view) ─────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  function toggleGroup(name: string) {
    setCollapsedGroups((s) => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })
  }

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const realAssignments = useMemo(() => assignments.filter((a) => !a.isSynthetic && !a.isArchived), [assignments])

  const filtered = useMemo(() => realAssignments.filter((a) =>
    (filterTypes.size === 0 || filterTypes.has(a.type)) && (filterMember === 'all' || a.memberId === filterMember),
  ), [realAssignments, filterTypes, filterMember])

  // Past assignments are history – hidden from list and groups unless asked for
  const pastCount = filtered.filter((a) => getStatus(a) === 'ended').length
  const visibleAssignments = useMemo(
    () => (showPast ? filtered : filtered.filter((a) => getStatus(a) !== 'ended')),
    [filtered, showPast],
  )
  const sorted = useMemo(() => [...visibleAssignments].sort(compareAssignments), [visibleAssignments])

  // Per responsibility: who's on duty now, who's next – or who should be next
  const overview = useMemo(() => responsibilityTypes.map((rt) => {
    const ofType = realAssignments.filter((a) => a.type === rt.name)
    const current = ofType.filter((a) => getStatus(a) === 'active').sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
    const next = ofType.filter((a) => getStatus(a) === 'upcoming').sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    let suggestion: TeamMember | undefined
    if (!next) {
      const sprint = nextOpenSprint(sprints, assignments, rt.name)
      const period = sprint ?? nextFreePeriod(assignments, rt.name)
      suggestion = suggestedCandidate(rankCandidates({ type: rt, members, assignments, period, sprint }))?.member
    }
    return { rt, current, next, suggestion }
  }), [responsibilityTypes, realAssignments, assignments, sprints, members])

  const nonSyntheticCount = realAssignments.length
  const vacantCount = overview.filter((o) => !o.current).length
  const filterActive = filterTypes.size > 0 || filterMember !== 'all'

  async function confirmDeleteAssignment() {
    if (!deleteTarget) return
    try {
      await deleteAssignment(deleteTarget.id)
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function confirmDeleteType() {
    if (!deleteTypeTarget) return
    try {
      await deleteResponsibilityType(deleteTypeTarget.id)
      if (editTypeTarget?.id === deleteTypeTarget.id) cancelEditType()
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const viewItems = [
    { value: 'list' as ViewMode, label: t('rotation.viewList'), icon: List },
    { value: 'grouped' as ViewMode, label: t('rotation.viewGrouped'), icon: Layers },
    { value: 'timeline' as ViewMode, label: t('rotation.viewTimeline'), icon: CalendarRange },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Page size="wide">
      <PageHeader
        icon={RefreshCw}
        title={t('rotation.title')}
        subtitle={t('rotation.count', { count: nonSyntheticCount })}
        actions={
          <>
            <DropdownMenu
              trigger={(p) => <IconButton {...p} variant="secondary" size="md" icon={<MoreHorizontal />} label={t('common.moreActions')} />}
              items={[
                ...(canWrite ? [{ label: t('rotation.types'), icon: <Settings2 />, onClick: openAddType }] : []),
                { label: t('rotation.participants'), icon: <UserCheck />, onClick: () => setShowParticipants(true) },
                { label: t('rotation.statistics'), icon: <BarChart2 />, onClick: () => setShowStats(true) },
                ...(canWrite ? [{ type: 'divider' as const }, { label: t('rotation.cleanup'), icon: <Archive />, onClick: openCleanup }] : []),
              ]}
            />
            {canWrite && responsibilityTypes.length > 0 && (
              <>
                <Button variant="secondary" icon={<Plus />} onClick={() => openCreate()}>
                  {t('rotation.singleAssignment')}
                </Button>
                <Button variant="primary" icon={<CalendarPlus />} onClick={() => setShowPlan(true)}>
                  {t('rotation.planRotation')}
                </Button>
              </>
            )}
          </>
        }
      />

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      {responsibilityTypes.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<RefreshCw />}
            title={t('rotation.noTypes')}
            description={t('rotation.emptyNoTypes')}
            action={canWrite ? (
              <Button variant="primary" icon={<Settings2 />} onClick={openAddType}>{t('rotation.types')}</Button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Current & next per responsibility ── */}
          <section>
            <SectionHeader
              title={t('rotation.currentAndNext')}
              count={responsibilityTypes.length}
              action={vacantCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {t('rotation.vacantCount', { count: vacantCount })}
                </span>
              ) : undefined}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.map(({ rt, current, next, suggestion }) => (
                <ResponsibilityCard
                  key={rt.id}
                  rt={rt}
                  current={current}
                  next={next}
                  suggestion={suggestion}
                  allMembers={allMembers}
                  canWrite={canWrite}
                  onEdit={openEdit}
                  onPlanNext={() => openCreate(rt.name)}
                  onDocs={() => openDocs(rt)}
                />
              ))}
            </div>
          </section>

          {/* ── Assignments: toolbar + view ── */}
          <section>
            <SectionHeader title={t('rotation.assignmentsHeading')} count={viewMode === 'timeline' ? filtered.length : sorted.length} />
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {responsibilityTypes.map((rt) => (
                  <Chip
                    key={rt.id}
                    active={filterTypes.has(rt.name)}
                    dotColor={rt.color}
                    onClick={() => toggleFilterType(rt.name)}
                    title={rt.name}
                  >
                    <span className="max-w-[13rem] truncate">{rt.name}</span>
                  </Chip>
                ))}
                {filterActive && (
                  <Button variant="ghost" size="xs" icon={<X />} onClick={resetFilters}>{t('common.resetFilters')}</Button>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {members.length > 1 && (
                  <Select
                    size="sm"
                    icon={<Users />}
                    value={filterMember}
                    onChange={(e) => setFilterMember(e.target.value)}
                    aria-label={t('rotation.memberFilter')}
                    wrapperClassName="w-full sm:w-48"
                  >
                    <option value="all">{t('rotation.allMembers')}</option>
                    {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                )}
                <Tabs<ViewMode>
                  variant="segmented"
                  size="sm"
                  value={viewMode}
                  onChange={setViewMode}
                  items={viewItems}
                  aria-label={t('rotation.viewMode')}
                />
              </div>
            </div>

            {viewMode === 'timeline' ? (
              <RotationTimeline
                responsibilityTypes={visibleTypes}
                assignments={filtered}
                allMembers={allMembers}
                sprints={sprints}
                canWrite={canWrite}
                onEdit={openEdit}
                onAdd={openCreate}
              />
            ) : sorted.length === 0 && pastCount === 0 ? (
              <div className="surface">
                {filterActive ? (
                  <EmptyState
                    icon={<SearchX />}
                    title={t('rotation.noAssignmentsForFilter')}
                    description={t('rotation.noAssignmentsForFilterHint')}
                    action={<Button variant="secondary" onClick={resetFilters}>{t('common.resetFilters')}</Button>}
                  />
                ) : (
                  <EmptyState
                    icon={<CalendarClock />}
                    title={t('rotation.emptyTitle')}
                    description={t('rotation.emptyHint')}
                    action={canWrite ? (
                      <Button variant="primary" icon={<CalendarPlus />} onClick={() => setShowPlan(true)}>
                        {t('rotation.planRotation')}
                      </Button>
                    ) : undefined}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.length === 0 ? (
                  <div className="surface">
                    <EmptyState
                      compact
                      icon={<CalendarClock />}
                      title={t('rotation.noCurrentAssignments')}
                      description={canWrite ? t('rotation.noCurrentHint') : undefined}
                      action={
                        <div className="flex flex-wrap justify-center gap-2">
                          {canWrite && (
                            <Button variant="primary" size="sm" icon={<CalendarPlus />} onClick={() => setShowPlan(true)}>
                              {t('rotation.planRotation')}
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" icon={<ChevronDown />} onClick={() => setShowPast(true)}>
                            {t('rotation.showPast', { count: pastCount })}
                          </Button>
                        </div>
                      }
                    />
                  </div>
                ) : viewMode === 'list' ? (
                  <ListView
                    assignments={sorted}
                    allMembers={allMembers}
                    sprints={sprints}
                    colorOf={colorOf}
                    canWrite={canWrite}
                    onEdit={openEdit}
                    onDelete={(a) => setDeleteTarget(a)}
                  />
                ) : (
                  <GroupedView
                    responsibilityTypes={visibleTypes}
                    assignments={visibleAssignments}
                    allMembers={allMembers}
                    sprints={sprints}
                    collapsedGroups={collapsedGroups}
                    canWrite={canWrite}
                    onToggleGroup={toggleGroup}
                    onEdit={openEdit}
                    onDelete={(a) => setDeleteTarget(a)}
                    onAdd={openCreate}
                  />
                )}
                {pastCount > 0 && (sorted.length > 0 || showPast) && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={showPast ? <ChevronUp /> : <ChevronDown />}
                      onClick={() => setShowPast((v) => !v)}
                    >
                      {showPast ? t('rotation.hidePast') : t('rotation.showPast', { count: pastCount })}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Assignment dialogs ── */}
      <AssignmentFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false })}
        assignment={formModal.assignment}
        presetType={formModal.presetType}
        onDelete={(a) => setDeleteTarget(a)}
      />
      <RotationPlanModal isOpen={showPlan} onClose={() => setShowPlan(false)} />
      <RotationParticipantsModal isOpen={showParticipants} onClose={() => setShowParticipants(false)} canWrite={canWrite} />

      {/* ── Type Management Modal ── */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => { setShowTypeModal(false); setEditTypeTarget(null) }}
        title={t('rotation.types')}
        description={t('rotation.typesHint')}
        icon={<Settings2 />}
        size="lg"
        footer={<Button variant="secondary" onClick={() => { setShowTypeModal(false); setEditTypeTarget(null) }}>{t('common.close')}</Button>}
      >
        <div className="space-y-5">
          {responsibilityTypes.length === 0 ? (
            <EmptyState compact icon={<RefreshCw />} title={t('rotation.noTypes')} />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {responsibilityTypes.map((rt) => {
                const count = assignments.filter((a) => a.type === rt.name && !a.isSynthetic && !a.isArchived).length
                const editing = editTypeTarget?.id === rt.id
                return (
                  <li key={rt.id} className={`flex items-center gap-3 py-2 pl-3.5 pr-2 ${editing ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''}`}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={rt.name}>{rt.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500" title={t('rotation.totalCount')}>
                      {t('rotation.assignmentCount', { count })}
                    </span>
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton size="sm" icon={<BookOpen />} label={t('rotation.documentation')} onClick={() => openDocs(rt)} />
                      <IconButton size="sm" icon={<Pencil />} label={t('common.edit')} onClick={() => openEditType(rt)} active={editing} />
                      <IconButton size="sm" variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => setDeleteTypeTarget(rt)} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={handleTypeSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {editTypeTarget ? t('rotation.editTypeNamed', { name: editTypeTarget.name }) : t('rotation.addType')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label={t('common.name')} htmlFor="type-name" error={typeFormError || undefined} required>
                <input
                  id="type-name"
                  type="text"
                  autoComplete="off"
                  value={typeForm.name}
                  onChange={(e) => { setTypeForm((f) => ({ ...f, name: e.target.value })); setTypeFormError('') }}
                  placeholder={t('rotation.typeNamePlaceholder')}
                  aria-invalid={!!typeFormError}
                  className="form-input"
                />
              </Field>
              <fieldset>
                <legend className="form-label">{t('rotation.color')}</legend>
                <div role="radiogroup" aria-label={t('rotation.color')} className="grid w-max grid-cols-6 gap-1.5">
                  {COLOR_OPTIONS.map((c) => {
                    const selected = typeForm.color === c
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={c}
                        onClick={() => setTypeForm((f) => ({ ...f, color: c }))}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                          selected ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2">
              {editTypeTarget && (
                <Button variant="secondary" onClick={cancelEditType} disabled={typeSaving}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button variant="primary" type="submit" loading={typeSaving} icon={editTypeTarget ? <Save /> : <Plus />}>
                {editTypeTarget ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── Type Documentation Modal ── */}
      <Modal
        isOpen={showDocsModal}
        onClose={closeDocsModal}
        title={docsTarget?.name ?? t('rotation.documentation')}
        description={t('rotation.documentation')}
        icon={<BookOpen />}
        size="xl"
        dismissible={!docsEditing}
        footer={
          docsEditing ? (
            <>
              <Button
                variant="secondary"
                disabled={docsSaving}
                onClick={() => {
                  if (!docsTarget?.documentation) { closeDocsModal(); return }
                  setDocsValue(docsTarget.documentation)
                  setDocsEditing(false)
                  setDocsError('')
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="primary" icon={<Save />} onClick={saveDocs} loading={docsSaving}>
                {t('common.save')}
              </Button>
            </>
          ) : canWrite ? (
            <>
              <Button variant="secondary" onClick={closeDocsModal}>{t('common.close')}</Button>
              <Button variant="primary" icon={<Pencil />} onClick={() => setDocsEditing(true)}>
                {t('common.edit')}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {docsError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20">
              {docsError}
            </p>
          )}
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
            <EmptyState compact icon={<BookOpen />} title={t('rotation.noDocumentation')} />
          )}
        </div>
      </Modal>

      {/* ── Stats Modal ── */}
      <Modal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        title={t('rotation.statistics')}
        description={t('rotation.statisticsHint')}
        icon={<BarChart2 />}
        size="lg"
      >
        {responsibilityTypes.length === 0 ? (
          <EmptyState compact icon={<BarChart2 />} title={t('rotation.noTypes')} />
        ) : (
          <div className="space-y-6">
            {responsibilityTypes.map((rt) => {
              const typeStats = stats[rt.name] ?? []
              const maxCount = Math.max(...typeStats.map((s) => s.total), 1)
              const total = assignments.filter((a) => a.type === rt.name && !a.isSynthetic && !a.isArchived).length
              return (
                <section key={rt.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                    <h3 className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{rt.name}</h3>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">{total} {t('rotation.totalCount')}</span>
                  </div>
                  <div className="space-y-1.5">
                    {typeStats.map(({ member, total: memberTotal, active }) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar name={member.name} color={member.avatarColor} size="xs" />
                        <span className="w-28 shrink-0 truncate text-xs text-slate-600 dark:text-slate-400 sm:w-36" title={member.name}>{member.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${(memberTotal / maxCount) * 100}%`, backgroundColor: rt.color }} />
                        </div>
                        <span className="w-6 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">{memberTotal}</span>
                        <span className="w-16 shrink-0 text-xs">
                          {active > 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('rotation.activeNow')}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </Modal>

      {/* ── Cleanup Modal ── */}
      <Modal
        isOpen={showCleanup}
        onClose={() => { if (!cleanupLoading) setShowCleanup(false) }}
        title={t('rotation.cleanup')}
        description={t('rotation.cleanupHint')}
        icon={<Archive />}
        footer={
          cleanupDone === null ? (
            <>
              <Button variant="secondary" onClick={() => setShowCleanup(false)} disabled={cleanupLoading}>{t('common.cancel')}</Button>
              {cleanupPreview && cleanupPreview.count > 0 && (
                <Button variant="primary" icon={<Archive />} onClick={handleCleanupConfirm} loading={cleanupLoading}>
                  {t('rotation.archiveCount', { count: cleanupPreview.count })}
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" onClick={() => setShowCleanup(false)}>{t('common.close')}</Button>
          )
        }
      >
        {cleanupDone !== null ? (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {t('rotation.archivedSuccess', { count: cleanupDone })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label={t('rotation.archiveBefore')} htmlFor="cleanup-before">
              <div className="flex gap-2">
                <input
                  id="cleanup-before"
                  type="date"
                  value={cleanupBefore}
                  onChange={(e) => { setCleanupBefore(e.target.value); setCleanupPreview(null) }}
                  className="form-input"
                />
                <Button variant="secondary" onClick={() => loadCleanupPreview(cleanupBefore)} disabled={!cleanupBefore} loading={cleanupLoading && !cleanupPreview}>
                  {t('rotation.previewArchive')}
                </Button>
              </div>
            </Field>
            {cleanupPreview && (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className={`px-3 py-2 text-xs font-medium ${
                  cleanupPreview.count === 0
                    ? 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                }`}>
                  {cleanupPreview.count === 0 ? t('rotation.nothingToArchive') : t('rotation.willBeArchived', { count: cleanupPreview.count })}
                </div>
                {cleanupPreview.items.slice(0, 8).map((a) => {
                  const member = allMembers.find((m) => m.id === a.memberId)
                  return (
                    <div key={a.id} className="flex items-center gap-3 border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(a.type) }} />
                      <span className="w-28 shrink-0 truncate text-slate-500 dark:text-slate-400">{a.type}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{member?.name ?? '—'}</span>
                      <span className="hidden whitespace-nowrap tabular-nums text-slate-400 sm:inline">{formatDate(a.startDate)} – {formatDate(a.endDate)}</span>
                    </div>
                  )
                })}
                {cleanupPreview.count > 8 && (
                  <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400 dark:border-slate-800">
                    {t('rotation.andMore', { count: cleanupPreview.count - 8 })}
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
        onConfirm={confirmDeleteAssignment}
        title={t('rotation.deleteAssignment')}
        message={deleteTarget ? t('rotation.deleteConfirm', {
          type: deleteTarget.type,
          name: allMembers.find((m) => m.id === deleteTarget.memberId)?.name ?? '—',
          start: formatDateShort(deleteTarget.startDate),
          end: formatDateShort(deleteTarget.endDate),
        }) : ''}
        confirmLabel={t('common.delete')}
      />
      <ConfirmDialog
        isOpen={!!deleteTypeTarget}
        onClose={() => setDeleteTypeTarget(null)}
        onConfirm={confirmDeleteType}
        title={t('rotation.deleteType')}
        message={t('rotation.deleteTypeConfirm', { name: deleteTypeTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
      />
    </Page>
  )
}
