import { useState, useMemo, useEffect, useCallback, useId, useRef, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { usePagePermission } from '@/hooks/usePagePermission'
import {
  Bug, Pencil, Trash2, Tag, Monitor, Ticket, AlertCircle, CheckCircle2, Wrench,
  MoreHorizontal, Copy, CalendarPlus, History, Info, ArrowLeft, CircleDot,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useStore } from '@/store'
import type { KnownErrorSeverity, KnownErrorStatus, KnownErrorComment } from '@/types'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Panel from '@/components/knownErrors/Panel'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { attachmentsApi, knownErrorCommentsApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import {
  SEVERITY_ORDER, STATUS_ORDER, SeverityBadge, StatusBadge,
} from '@/components/knownErrors/KnownErrorBadges'
import SoftwarePicker from '@/components/knownErrors/SoftwarePicker'
import AttachmentsCard from '@/components/knownErrors/AttachmentsCard'
import CommentThread from '@/components/knownErrors/CommentThread'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// ─── Comments ─────────────────────────────────────────────────────────────────

function CommentsPanel({ knownErrorId, canWrite }: { knownErrorId: string; canWrite: boolean }) {
  const { t }  = useTranslation()
  const user   = useAuthStore((s) => s.user)
  const [comments, setComments] = useState<KnownErrorComment[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    try { setComments(await knownErrorCommentsApi.list(knownErrorId)) }
    catch (err) { toast.error(t('common.loadError'), { description: errorMessage(err) }) }
    finally { setLoading(false) }
  }, [knownErrorId, t])

  useEffect(() => { load() }, [load])

  return (
    <CommentThread
      comments={comments}
      loading={loading}
      canWrite={canWrite}
      onSend={async (content) => {
        const c = await knownErrorCommentsApi.create(knownErrorId, content, user?.displayName ?? '')
        setComments((prev) => [...prev, c])
      }}
      onDelete={async (c) => {
        await knownErrorCommentsApi.delete(knownErrorId, c.id)
        setComments((prev) => prev.filter((x) => x.id !== c.id))
      }}
      labels={{
        title:         t('knownErrors.comments.title'),
        empty:         t('knownErrors.comments.empty'),
        placeholder:   t('commentThread.placeholder'),
        anonymous:     t('knownErrors.comments.anonymous'),
        deleteTitle:   t('knownErrors.comments.deleteTitle'),
        deleteConfirm: t('knownErrors.comments.deleteConfirm'),
      }}
    />
  )
}

// ─── Small layout helpers ─────────────────────────────────────────────────────

function MetaRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="mb-1.5 flex items-center gap-1.5 section-label [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-slate-700 dark:text-slate-300">{children}</dd>
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm italic text-slate-400 dark:text-slate-500">{children}</p>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnownErrorDetailPage() {
  const { errorId } = useParams<{ errorId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const uid = useId()

  const knownErrors      = useStore((s) => s.knownErrors)
  const software         = useStore((s) => s.software)
  const updateKnownError = useStore((s) => s.updateKnownError)
  const deleteKnownError = useStore((s) => s.deleteKnownError)

  const ke = knownErrors.find((k) => k.id === errorId)

  const { canWrite, isReadOnly } = usePagePermission('known-errors')

  const [editing,       setEditing]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const { isBlocked, confirmLeave, cancelLeave, guardedNavigate } = useUnsavedChanges(editing)
  const [attachRefresh, setAttachRefresh] = useState(0)
  const [titleError,    setTitleError]    = useState('')

  const [editTitle,        setEditTitle]        = useState('')
  const [editTicketNumber, setEditTicketNumber] = useState('')
  const [editDescription,  setEditDescription]  = useState('')
  const [editSolution,     setEditSolution]     = useState('')
  const [editWorkaround,   setEditWorkaround]   = useState('')
  const [editSeverity,     setEditSeverity]     = useState<KnownErrorSeverity>('medium')
  const [editStatus,       setEditStatus]       = useState<KnownErrorStatus>('open')
  const [editSoftwareIds,  setEditSoftwareIds]  = useState<string[]>([])
  const [editTags,         setEditTags]         = useState('')

  const softwareMap = useMemo(
    () => Object.fromEntries(software.map((s) => [s.id, s])),
    [software],
  )

  // Ctrl/Cmd+S saves while editing
  const saveRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (!editing) return
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  if (!ke) {
    return (
      <Page size="narrow">
        <PageHeader back={{ to: '/known-errors', label: t('knownErrors.backToList') }} title={t('knownErrors.title')} />
        <div className="surface">
          <EmptyState
            icon={<Bug />}
            title={t('knownErrors.notFound')}
            action={
              <Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate('/known-errors')}>
                {t('knownErrors.backToList')}
              </Button>
            }
          />
        </div>
      </Page>
    )
  }

  function startEdit() {
    setEditTitle(ke!.title)
    setEditTicketNumber(ke!.ticketNumber ?? '')
    setEditDescription(ke!.description)
    setEditSolution(ke!.solution)
    setEditWorkaround(ke!.workaround ?? '')
    setEditSeverity(ke!.severity)
    setEditStatus(ke!.status)
    setEditSoftwareIds([...ke!.softwareIds])
    setEditTags(ke!.tags.join(', '))
    setTitleError('')
    setEditing(true)
  }

  async function saveEdit() {
    if (saving) return
    if (!editTitle.trim()) { setTitleError(t('knownErrors.titleRequired')); return }
    setSaving(true)
    try {
      await updateKnownError(ke!.id, {
        title:        editTitle.trim(),
        ticketNumber: editTicketNumber.trim() || undefined,
        description:  editDescription,
        solution:     editSolution,
        workaround:   editWorkaround || undefined,
        severity:     editSeverity,
        status:       editStatus,
        softwareIds:  editSoftwareIds,
        tags:         editTags.split(',').map((x) => x.trim()).filter(Boolean),
      })
      setEditing(false)
      toast.success(t('common.saved'))
    } catch (err) {
      toast.error(t('knownErrors.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }
  saveRef.current = saveEdit

  async function handleDelete() {
    try {
      await deleteKnownError(ke!.id)
      toast.success(t('common.deleted'), { description: ke!.title })
      navigate('/known-errors')
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  function toggleSoftware(id: string) {
    setEditSoftwareIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  /** Upload an image and return just the stored filename (for markdown insertion). */
  async function handleImageUpload(file: File): Promise<string> {
    const att = await attachmentsApi.upload(ke!.id, file)
    setAttachRefresh((n) => n + 1)
    return att.filename
  }

  async function copyTicket() {
    if (!ke?.ticketNumber) return
    try {
      await navigator.clipboard.writeText(ke.ticketNumber)
      toast.success(t('common.copied'), { description: ke.ticketNumber })
    } catch {
      toast.error(t('common.unknownError'))
    }
  }

  const fmt = (d: string) => format(new Date(d), 'dd.MM.yyyy HH:mm')

  // ─── Sections ──────────────────────────────────────────────────────────────
  const sections: {
    key: string
    title: string
    icon: ReactNode
    value: string
    edit: string
    setEdit: (v: string) => void
    placeholder: string
    rows: number
    show: boolean
  }[] = [
    {
      key: 'description',
      title: t('knownErrors.fields.description'),
      icon: <AlertCircle className="text-slate-500 dark:text-slate-400" />,
      value: ke.description, edit: editDescription, setEdit: setEditDescription,
      placeholder: t('knownErrors.fields.descriptionPlaceholder'), rows: 6, show: true,
    },
    {
      key: 'solution',
      title: t('knownErrors.fields.solution'),
      icon: <CheckCircle2 className="text-emerald-500 dark:text-emerald-400" />,
      value: ke.solution, edit: editSolution, setEdit: setEditSolution,
      placeholder: t('knownErrors.fields.solutionPlaceholder'), rows: 10, show: true,
    },
    {
      key: 'workaround',
      title: t('knownErrors.fields.workaround'),
      icon: <Wrench className="text-amber-500 dark:text-amber-400" />,
      value: ke.workaround ?? '', edit: editWorkaround, setEdit: setEditWorkaround,
      placeholder: t('knownErrors.fields.workaroundPlaceholder'), rows: 5, show: editing || !!ke.workaround,
    },
  ]

  return (
    <Page size="default">
      <PageHeader
        back={{ onClick: () => guardedNavigate('/known-errors'), label: t('knownErrors.backToList') }}
        title={ke.title}
        documentTitle={ke.title}
        meta={editing && <Badge variant="indigo" dot label={t('knownErrors.editMode')} />}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5">
              <SeverityBadge severity={ke.severity} />
              <StatusBadge status={ke.status} />
            </span>
            {ke.ticketNumber && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/70">
                <Ticket className="h-3 w-3 text-slate-400" />
                {ke.ticketNumber}
              </span>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {t('knownErrors.updatedAgo', { date: format(new Date(ke.updatedAt), 'dd.MM.yyyy') })}
            </span>
          </span>
        }
        actions={
          canWrite && !editing && (
            <>
              <Button variant="secondary" icon={<Pencil />} onClick={startEdit}>
                {t('common.edit')}
              </Button>
              <DropdownMenu
                trigger={(p) => (
                  <IconButton {...p} variant="secondary" size="md" icon={<MoreHorizontal />} label={t('common.moreActions')} />
                )}
                items={[
                  ...(ke.ticketNumber
                    ? [{ label: t('knownErrors.copyTicket'), icon: <Copy />, onClick: copyTicket }, { type: 'divider' as const }]
                    : []),
                  { label: t('knownErrors.deleteEntry'), icon: <Trash2 />, danger: true, onClick: () => setConfirmDelete(true) },
                ]}
              />
            </>
          )
        }
      />

      {isReadOnly && <ReadOnlyBanner className="-mt-1 mb-6" />}

      {editing && (
        <Card className="mb-6">
          <Field label={t('knownErrors.fields.title')} htmlFor={`${uid}-title`} required error={titleError}>
            <input
              id={`${uid}-title`}
              autoFocus
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); if (titleError) setTitleError('') }}
              aria-invalid={!!titleError}
              className="form-input text-base font-medium"
            />
          </Field>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {sections.filter((s) => s.show).map((s) => (
            <Panel key={s.key} title={s.title} icon={s.icon}>
              {editing ? (
                <MarkdownEditor
                  value={s.edit}
                  onChange={s.setEdit}
                  placeholder={s.placeholder}
                  rows={s.rows}
                  onImageUpload={handleImageUpload}
                />
              ) : s.value ? (
                <MarkdownRenderer content={s.value} />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <Muted>{t('knownErrors.noContent')}</Muted>
                  {canWrite && (
                    <Button size="xs" variant="ghost" icon={<Pencil />} onClick={startEdit}>{t('common.edit')}</Button>
                  )}
                </div>
              )}
            </Panel>
          ))}

          <AttachmentsCard
            key={`att-${ke.id}`}
            ns="knownErrors.attachments"
            load={() => attachmentsApi.list(ke.id)}
            upload={(file) => attachmentsApi.upload(ke.id, file)}
            remove={(att) => attachmentsApi.delete(ke.id, att.id)}
            fileUrl={attachmentsApi.fileUrl}
            canWrite={canWrite}
            refreshKey={attachRefresh}
          />

          <CommentsPanel key={`com-${ke.id}`} knownErrorId={ke.id} canWrite={canWrite} />
        </div>

        {/* ── Side panel (meta) ─────────────────────────────────────────── */}
        <aside className={`space-y-4 lg:sticky lg:top-6 lg:self-start ${editing ? 'order-first lg:order-none' : ''}`}>
          {editing ? (
            <Panel title={t('knownErrors.details')} icon={<Info />} bodyClassName="p-4">
              <div className="space-y-4">
                <Field label={t('knownErrors.fields.status')} htmlFor={`${uid}-status`}>
                  <Select id={`${uid}-status`} value={editStatus} onChange={(e) => setEditStatus(e.target.value as KnownErrorStatus)}>
                    {STATUS_ORDER.map((s) => <option key={s} value={s}>{t(`knownErrors.status.${s}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t('knownErrors.fields.severity')} htmlFor={`${uid}-sev`}>
                  <Select id={`${uid}-sev`} value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as KnownErrorSeverity)}>
                    {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t('knownErrors.fields.ticketNumber')} htmlFor={`${uid}-ticket`} optional>
                  <input
                    id={`${uid}-ticket`}
                    value={editTicketNumber}
                    onChange={(e) => setEditTicketNumber(e.target.value)}
                    placeholder={t('knownErrors.fields.ticketNumberPlaceholder')}
                    className="form-input font-mono"
                  />
                </Field>
                <div>
                  <p className="form-label">{t('knownErrors.fields.affectedSoftware')}</p>
                  {software.length > 0 ? (
                    <SoftwarePicker software={software} selected={editSoftwareIds} onToggle={toggleSoftware} />
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('knownErrors.noSoftwareConfigured')}</p>
                  )}
                </div>
                <Field label={t('knownErrors.fields.tags')} htmlFor={`${uid}-tags`} hint={t('knownErrors.tagsHint')}>
                  <input
                    id={`${uid}-tags`}
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder={t('knownErrors.fields.tagsPlaceholder')}
                    className="form-input"
                  />
                </Field>
              </div>
            </Panel>
          ) : (
            <Panel title={t('knownErrors.details')} icon={<Info />} bodyClassName="">
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                  <MetaRow label={t('knownErrors.fields.status')} icon={<CircleDot />}>
                    <StatusBadge status={ke.status} />
                  </MetaRow>
                  <MetaRow label={t('knownErrors.fields.severity')} icon={<AlertCircle />}>
                    <SeverityBadge severity={ke.severity} />
                  </MetaRow>
                </div>
                {ke.ticketNumber && (
                  <MetaRow label={t('knownErrors.fields.ticketNumber')} icon={<Ticket />}>
                    <span className="flex items-center gap-1">
                      <span className="truncate font-mono text-sm text-slate-800 dark:text-slate-200">{ke.ticketNumber}</span>
                      <IconButton size="xs" icon={<Copy />} label={t('knownErrors.copyTicket')} onClick={copyTicket} />
                    </span>
                  </MetaRow>
                )}
                <MetaRow label={t('knownErrors.fields.affectedSoftware')} icon={<Monitor />}>
                  {ke.softwareIds.length > 0 ? (
                    <ul className="space-y-2">
                      {ke.softwareIds.map((id) => {
                        const sw = softwareMap[id]
                        if (!sw) return null
                        return (
                          <li key={id} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 dark:text-slate-200">{sw.name}</p>
                              {(sw.vendor || sw.version) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {[sw.vendor, sw.version ? `v${sw.version}` : undefined].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <Muted>{t('knownErrors.noSoftwareAssigned')}</Muted>
                  )}
                </MetaRow>
                <MetaRow label={t('knownErrors.fields.tags')} icon={<Tag />}>
                  {ke.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ke.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Muted>{t('knownErrors.noTags')}</Muted>
                  )}
                </MetaRow>
                <div className="space-y-1.5 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5 text-slate-400" />
                    {t('knownErrors.createdAt')} <span className="tabular-nums text-slate-700 dark:text-slate-300">{fmt(ke.createdAt)}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    {t('knownErrors.updatedAt')} <span className="tabular-nums text-slate-700 dark:text-slate-300">{fmt(ke.updatedAt)}</span>
                  </p>
                </div>
              </dl>
            </Panel>
          )}
        </aside>
      </div>

      {/* Sticky save bar while editing */}
      {editing && (
        <div className="sticky bottom-4 z-20 mt-6 animate-slide-up">
          <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-popover backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <span className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:block" aria-hidden />
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t('knownErrors.unsavedChanges')}</p>
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd className="kbd">S</kbd> {t('knownErrors.toSave')}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="flex-1 sm:flex-none">{t('common.cancel')}</Button>
            <Button variant="primary" onClick={saveEdit} loading={saving} className="flex-1 sm:flex-none">{t('common.save')}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('knownErrors.deleteEntry')}
        message={t('knownErrors.deleteConfirm', { title: ke.title })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isBlocked}
        onClose={cancelLeave}
        onConfirm={confirmLeave}
        title={t('confirmDialog.unsavedTitle')}
        message={t('confirmDialog.unsavedMessage')}
        confirmLabel={t('confirmDialog.unsavedLeave')}
        cancelLabel={t('confirmDialog.unsavedStay')}
        variant="warning"
      />
    </Page>
  )
}
