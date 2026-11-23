import { useState, useMemo, useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bug, Plus, Tag, Monitor, Ticket, MoreHorizontal, Trash2, ExternalLink, SearchX,
  ArrowDownWideNarrow, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useStore } from '@/store'
import type { KnownError, KnownErrorSeverity, KnownErrorStatus } from '@/types'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Field from '@/components/ui/Field'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast, errorMessage } from '@/store/toast'
import {
  SEVERITY_ORDER, STATUS_ORDER, SeverityBadge, StatusBadge, StatusTile,
} from '@/components/knownErrors/KnownErrorBadges'
import { stripMarkdown } from '@/components/knownErrors/utils'
import SoftwarePicker from '@/components/knownErrors/SoftwarePicker'

// ─── Form ─────────────────────────────────────────────────────────────────────

interface KnownErrorForm {
  title: string
  ticketNumber: string
  description: string
  solution: string
  workaround: string
  severity: KnownErrorSeverity
  status: KnownErrorStatus
  softwareIds: string[]
  tags: string
}

const emptyForm = (): KnownErrorForm => ({
  title: '',
  ticketNumber: '',
  description: '',
  solution: '',
  workaround: '',
  severity: 'medium',
  status: 'open',
  softwareIds: [],
  tags: '',
})

type SortKey = 'severity' | 'newest' | 'updated' | 'title'

const activeFilterCls = '!border-indigo-300 !bg-indigo-50/60 dark:!border-indigo-500/50 dark:!bg-indigo-500/10'

const parseTags = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnownErrorDBPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('known-errors')
  const navigate = useNavigate()
  const uid = useId()

  const knownErrors      = useStore((s) => s.knownErrors)
  const software         = useStore((s) => s.software)
  const addKnownError    = useStore((s) => s.addKnownError)
  const deleteKnownError = useStore((s) => s.deleteKnownError)

  const [search,         setSearch]         = useState('')
  const [filterSeverity, setFilterSeverity] = useState<KnownErrorSeverity | 'all'>('all')
  const [filterStatus,   setFilterStatus]   = useState<KnownErrorStatus | 'all'>('all')
  const [filterSoftware, setFilterSoftware] = useState<string>('all')
  const [sortBy,         setSortBy]         = useState<SortKey>('severity')

  const [modalOpen,    setModalOpen]    = useState(false)
  const [form,         setForm]         = useState<KnownErrorForm>(emptyForm())
  const [titleError,   setTitleError]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnownError | null>(null)

  const softwareMap = useMemo(
    () => Object.fromEntries(software.map((s) => [s.id, s.name])),
    [software],
  )

  // ─── Filtering ──────────────────────────────────────────────────────────────
  /** All filters except status — status tab counts are based on this. */
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return knownErrors.filter((ke) => {
      if (filterSeverity !== 'all' && ke.severity !== filterSeverity) return false
      if (filterSoftware !== 'all' && !ke.softwareIds.includes(filterSoftware)) return false
      if (q && !ke.title.toLowerCase().includes(q) &&
               !ke.description.toLowerCase().includes(q) &&
               !(ke.ticketNumber ?? '').toLowerCase().includes(q) &&
               !ke.tags.some((tag) => tag.toLowerCase().includes(q))) return false
      return true
    })
  }, [knownErrors, search, filterSeverity, filterSoftware])

  const statusCounts = useMemo(() => {
    const c: Record<KnownErrorStatus, number> = { open: 0, workaround: 0, resolved: 0 }
    for (const ke of baseFiltered) c[ke.status]++
    return c
  }, [baseFiltered])

  const filtered = useMemo(() => {
    const list = filterStatus === 'all' ? [...baseFiltered] : baseFiltered.filter((ke) => ke.status === filterStatus)
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'newest':  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'title':   return a.title.localeCompare(b.title)
        default: {
          const si = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
          return si !== 0 ? si : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
      }
    })
  }, [baseFiltered, filterStatus, sortBy])

  const isFiltered = !!search.trim() || filterSeverity !== 'all' || filterStatus !== 'all' || filterSoftware !== 'all'

  function resetFilters() {
    setSearch('')
    setFilterSeverity('all')
    setFilterStatus('all')
    setFilterSoftware('all')
  }

  // ─── Create ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyForm())
    setTitleError('')
    setModalOpen(true)
  }

  const formDirty = JSON.stringify(form) !== JSON.stringify(emptyForm())

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    if (!form.title.trim()) { setTitleError(t('knownErrors.titleRequired')); return }
    setSaving(true)
    try {
      const id = await addKnownError({
        title:        form.title.trim(),
        ticketNumber: form.ticketNumber.trim() || undefined,
        description:  form.description,
        solution:     form.solution,
        workaround:   form.workaround || undefined,
        severity:     form.severity,
        status:       form.status,
        softwareIds:  form.softwareIds,
        tags:         parseTags(form.tags),
      })
      setModalOpen(false)
      toast.success(t('common.created'), { description: form.title.trim() })
      navigate(`/known-errors/${id}`)
    } catch (err) {
      toast.error(t('knownErrors.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteKnownError(deleteTarget.id)
      toast.success(t('common.deleted'), { description: deleteTarget.title })
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  function toggleSoftware(id: string) {
    setForm((f) => ({
      ...f,
      softwareIds: f.softwareIds.includes(id)
        ? f.softwareIds.filter((s) => s !== id)
        : [...f.softwareIds, id],
    }))
  }

  const statusTabs = [
    { value: 'all' as const, label: t('common.all'), count: baseFiltered.length },
    ...STATUS_ORDER.map((s) => ({ value: s, label: t(`knownErrors.status.${s}`), count: statusCounts[s] })),
  ]

  const formTags = parseTags(form.tags)

  return (
    <Page size="default">
      <PageHeader
        icon={Bug}
        title={t('knownErrors.title')}
        subtitle={t('knownErrors.subtitle')}
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus />} onClick={openCreate}>
              {t('knownErrors.newEntry')}
            </Button>
          )
        }
      >
        {isReadOnly && <ReadOnlyBanner className="mb-5" />}

        <Tabs
          aria-label={t('knownErrors.fields.status')}
          items={statusTabs}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v)}
        />

        {/* Toolbar */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            size="sm"
            placeholder={t('knownErrors.searchPlaceholder')}
            className="w-full sm:w-60"
            aria-label={t('common.search')}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              size="sm"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as KnownErrorSeverity | 'all')}
              aria-label={t('knownErrors.fields.severity')}
              className={`sm:w-40 ${filterSeverity !== 'all' ? activeFilterCls : ''}`}
            >
              <option value="all">{t('knownErrors.allSeverities')}</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>
              ))}
            </Select>
            {software.length > 0 && (
              <Select
                size="sm"
                value={filterSoftware}
                onChange={(e) => setFilterSoftware(e.target.value)}
                aria-label={t('knownErrors.fields.affectedSoftware')}
                className={`sm:w-40 ${filterSoftware !== 'all' ? activeFilterCls : ''}`}
              >
                <option value="all">{t('knownErrors.allSoftware')}</option>
                {software.map((sw) => (
                  <option key={sw.id} value={sw.id}>{sw.name}</option>
                ))}
              </Select>
            )}
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" icon={<X />} onClick={resetFilters} className="self-start sm:self-auto">
              {t('common.resetFilters')}
            </Button>
          )}
          <Select
            size="sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label={t('common.sortBy')}
            title={t('common.sortBy')}
            icon={<ArrowDownWideNarrow />}
            wrapperClassName="sm:ml-auto sm:w-40"
          >
            <option value="severity">{t('knownErrors.sort.severity')}</option>
            <option value="newest">{t('knownErrors.sort.newest')}</option>
            <option value="updated">{t('knownErrors.sort.updated')}</option>
            <option value="title">{t('knownErrors.sort.title')}</option>
          </Select>
          <span className="sr-only" aria-live="polite">
            {isFiltered
              ? t('knownErrors.filteredCount', { shown: filtered.length, total: knownErrors.length })
              : t('knownErrors.count', { count: knownErrors.length })}
          </span>
        </div>
      </PageHeader>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface">
          {knownErrors.length === 0 ? (
            <EmptyState
              icon={<Bug />}
              title={t('knownErrors.noEntries')}
              description={t('knownErrors.noEntriesSubtitle')}
              action={canWrite && (
                <Button variant="primary" icon={<Plus />} onClick={openCreate}>{t('knownErrors.newEntry')}</Button>
              )}
            />
          ) : (
            <EmptyState
              icon={<SearchX />}
              title={t('knownErrors.noResults')}
              description={t('knownErrors.noResultsSubtitle')}
              action={<Button variant="secondary" onClick={resetFilters}>{t('common.resetFilters')}</Button>}
            />
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((ke) => {
            const preview = stripMarkdown(ke.description)
            const swNames = ke.softwareIds.map((id) => softwareMap[id]).filter(Boolean)
            return (
              <li key={ke.id} className="group relative">
                <Link
                  to={`/known-errors/${ke.id}`}
                  className="surface-interactive flex gap-3.5 p-4 pr-12 sm:gap-4 sm:pr-14"
                >
                  <StatusTile status={ke.status} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <h3 className="text-sm font-semibold leading-6 text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                        {ke.title}
                      </h3>
                      <time
                        dateTime={ke.createdAt}
                        title={`${t('knownErrors.createdAt')} ${format(new Date(ke.createdAt), 'dd.MM.yyyy HH:mm')}`}
                        className="hidden shrink-0 pt-0.5 text-xs tabular-nums text-slate-400 dark:text-slate-500 sm:block"
                      >
                        {format(new Date(ke.createdAt), 'dd.MM.yyyy')}
                      </time>
                    </div>

                    {preview && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {preview}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <SeverityBadge severity={ke.severity} />
                        <StatusBadge status={ke.status} />
                      </span>
                      {ke.ticketNumber && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/70">
                          <Ticket className="h-3 w-3 text-slate-400" />
                          {ke.ticketNumber}
                        </span>
                      )}
                      {swNames.length > 0 && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Monitor className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{swNames.join(', ')}</span>
                        </span>
                      )}
                      {ke.tags.length > 0 && (
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                          <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {ke.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-1.5 py-px text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {tag}
                            </span>
                          ))}
                          {ke.tags.length > 4 && (
                            <span className="text-[11px] text-slate-400" title={ke.tags.slice(4).join(', ')}>
                              +{ke.tags.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                      <time dateTime={ke.createdAt} className="tabular-nums text-slate-400 dark:text-slate-500 sm:hidden">
                        {format(new Date(ke.createdAt), 'dd.MM.yyyy')}
                      </time>
                    </div>
                  </div>
                </Link>

                <div className="absolute right-3 top-3 sm:right-3.5 sm:top-3.5">
                  <DropdownMenu
                    trigger={(p) => (
                      <IconButton
                        {...p}
                        icon={<MoreHorizontal />}
                        label={t('common.moreActions')}
                        className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                      />
                    )}
                    items={[
                      { label: t('common.open'), icon: <ExternalLink />, onClick: () => navigate(`/known-errors/${ke.id}`) },
                      ...(canWrite
                        ? [
                            { type: 'divider' as const },
                            { label: t('common.delete'), icon: <Trash2 />, danger: true, onClick: () => setDeleteTarget(ke) },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        dismissible={!formDirty}
        icon={<Bug />}
        title={t('knownErrors.newEntry')}
        description={t('knownErrors.createDescription')}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" form={`${uid}-form`} variant="primary" loading={saving}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <form id={`${uid}-form`} onSubmit={handleSave} className="space-y-5">
          {/* Title + Ticket */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label={t('knownErrors.fields.title')}
              htmlFor={`${uid}-title`}
              required
              error={titleError}
              className="sm:col-span-2"
            >
              <input
                id={`${uid}-title`}
                autoFocus
                value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); if (titleError) setTitleError('') }}
                placeholder={t('knownErrors.fields.titlePlaceholder')}
                aria-invalid={!!titleError}
                className="form-input"
              />
            </Field>
            <Field label={t('knownErrors.fields.ticketNumber')} htmlFor={`${uid}-ticket`} optional>
              <input
                id={`${uid}-ticket`}
                value={form.ticketNumber}
                onChange={(e) => setForm((f) => ({ ...f, ticketNumber: e.target.value }))}
                placeholder={t('knownErrors.fields.ticketNumberPlaceholder')}
                className="form-input font-mono"
              />
            </Field>
          </div>

          {/* Severity + Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('knownErrors.fields.severity')} htmlFor={`${uid}-sev`}>
              <Select
                id={`${uid}-sev`}
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as KnownErrorSeverity }))}
              >
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('knownErrors.fields.status')} htmlFor={`${uid}-status`}>
              <Select
                id={`${uid}-status`}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as KnownErrorStatus }))}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`knownErrors.status.${s}`)}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t('knownErrors.fields.description')} htmlFor={`${uid}-desc`}>
            <MarkdownEditor
              id={`${uid}-desc`}
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder={t('knownErrors.fields.descriptionPlaceholder')}
              rows={4}
            />
          </Field>

          <Field label={t('knownErrors.fields.solution')} htmlFor={`${uid}-solution`}>
            <MarkdownEditor
              id={`${uid}-solution`}
              value={form.solution}
              onChange={(v) => setForm((f) => ({ ...f, solution: v }))}
              placeholder={t('knownErrors.fields.solutionPlaceholder')}
              rows={6}
            />
          </Field>

          <Field label={t('knownErrors.fields.workaround')} htmlFor={`${uid}-workaround`} optional>
            <MarkdownEditor
              id={`${uid}-workaround`}
              value={form.workaround}
              onChange={(v) => setForm((f) => ({ ...f, workaround: v }))}
              placeholder={t('knownErrors.fields.workaroundPlaceholder')}
              rows={3}
            />
          </Field>

          {software.length > 0 && (
            <fieldset>
              <legend className="form-label">{t('knownErrors.fields.affectedSoftware')}</legend>
              <SoftwarePicker
                software={software}
                selected={form.softwareIds}
                onToggle={toggleSoftware}
              />
            </fieldset>
          )}

          <Field
            label={t('knownErrors.fields.tags')}
            htmlFor={`${uid}-tags`}
            hint={formTags.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1">
                {formTags.map((tag, i) => (
                  <span key={`${tag}-${i}`} className="rounded-full bg-slate-100 px-2 py-px text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{tag}</span>
                ))}
              </span>
            ) : t('knownErrors.tagsHint')}
          >
            <input
              id={`${uid}-tags`}
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder={t('knownErrors.fields.tagsPlaceholder')}
              className="form-input"
            />
          </Field>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('knownErrors.deleteEntry')}
        message={t('knownErrors.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </Page>
  )
}
