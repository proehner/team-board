import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bug, Plus, Search, X, ChevronRight, Tag, Monitor, Ticket,
  AlertTriangle, AlertCircle, Info, CheckCircle2, Wrench,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import type { KnownError, KnownErrorSeverity, KnownErrorStatus } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import { format } from 'date-fns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: KnownErrorSeverity[] = ['critical', 'high', 'medium', 'low']

function SeverityBadge({ severity }: { severity: KnownErrorSeverity }) {
  const { t } = useTranslation()
  const cfg = {
    critical: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: AlertCircle },
    high:     { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', Icon: AlertTriangle },
    medium:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Info },
    low:      { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', Icon: Info },
  }[severity]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {t(`knownErrors.severity.${severity}`)}
    </span>
  )
}

function StatusBadge({ status }: { status: KnownErrorStatus }) {
  const { t } = useTranslation()
  const cfg = {
    open:       { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: AlertCircle },
    workaround: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Wrench },
    resolved:   { cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', Icon: CheckCircle2 },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {t(`knownErrors.status.${status}`)}
    </span>
  )
}

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

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelCls = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnownErrorDBPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const knownErrors      = useStore((s) => s.knownErrors)
  const software         = useStore((s) => s.software)
  const addKnownError    = useStore((s) => s.addKnownError)
  const deleteKnownError = useStore((s) => s.deleteKnownError)

  const [search,         setSearch]         = useState('')
  const [filterSeverity, setFilterSeverity] = useState<KnownErrorSeverity | 'all'>('all')
  const [filterStatus,   setFilterStatus]   = useState<KnownErrorStatus | 'all'>('all')
  const [filterSoftware, setFilterSoftware] = useState<string>('all')

  const [modalOpen,    setModalOpen]    = useState(false)
  const [form,         setForm]         = useState<KnownErrorForm>(emptyForm())
  const [formError,    setFormError]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnownError | null>(null)

  // ─── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return knownErrors
      .filter((ke) => {
        if (filterSeverity !== 'all' && ke.severity !== filterSeverity) return false
        if (filterStatus   !== 'all' && ke.status   !== filterStatus)   return false
        if (filterSoftware !== 'all' && !ke.softwareIds.includes(filterSoftware)) return false
        if (q && !ke.title.toLowerCase().includes(q) &&
                 !ke.description.toLowerCase().includes(q) &&
                 !(ke.ticketNumber ?? '').toLowerCase().includes(q) &&
                 !ke.tags.some((tag) => tag.toLowerCase().includes(q))) return false
        return true
      })
      .sort((a, b) => {
        const si = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
        return si !== 0 ? si : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [knownErrors, search, filterSeverity, filterStatus, filterSoftware])

  // ─── Create ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError(t('knownErrors.titleRequired')); return }
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
        tags:         form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setModalOpen(false)
      navigate(`/known-errors/${id}`)
    } catch {
      setFormError(t('knownErrors.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteKnownError(deleteTarget.id)
    setDeleteTarget(null)
  }

  function toggleSoftware(id: string) {
    setForm((f) => ({
      ...f,
      softwareIds: f.softwareIds.includes(id)
        ? f.softwareIds.filter((s) => s !== id)
        : [...f.softwareIds, id],
    }))
  }

  const softwareMap = useMemo(
    () => Object.fromEntries(software.map((s) => [s.id, s.name])),
    [software],
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bug className="w-6 h-6 text-indigo-500" />
            {t('knownErrors.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('knownErrors.count', { count: knownErrors.length })}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" />
          {t('knownErrors.newEntry')}
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('knownErrors.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as KnownErrorSeverity | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">{t('knownErrors.allSeverities')}</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as KnownErrorStatus | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">{t('knownErrors.allStatuses')}</option>
          <option value="open">{t('knownErrors.status.open')}</option>
          <option value="workaround">{t('knownErrors.status.workaround')}</option>
          <option value="resolved">{t('knownErrors.status.resolved')}</option>
        </select>

        {software.length > 0 && (
          <select
            value={filterSoftware}
            onChange={(e) => setFilterSoftware(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('knownErrors.allSoftware')}</option>
            {software.map((sw) => (
              <option key={sw.id} value={sw.id}>{sw.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bug className="w-10 h-10 text-slate-300" />}
          title={knownErrors.length === 0 ? t('knownErrors.noEntries') : t('knownErrors.noResults')}
          description={knownErrors.length === 0 ? t('knownErrors.noEntriesSubtitle') : t('knownErrors.noResultsSubtitle')}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ke) => (
            <div
              key={ke.id}
              onClick={() => navigate(`/known-errors/${ke.id}`)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm cursor-pointer transition-all group"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {ke.title}
                  </h3>
                  <SeverityBadge severity={ke.severity} />
                  <StatusBadge status={ke.status} />
                </div>

                {ke.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {ke.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {ke.ticketNumber && (
                    <span className="flex items-center gap-1 font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                      <Ticket className="w-3 h-3" />
                      {ke.ticketNumber}
                    </span>
                  )}
                  {ke.softwareIds.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      {ke.softwareIds.map((id) => softwareMap[id] ?? id).join(', ')}
                    </span>
                  )}
                  {ke.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {ke.tags.join(', ')}
                    </span>
                  )}
                  <span>{format(new Date(ke.createdAt), 'dd.MM.yyyy')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(ke) }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                  title={t('common.delete')}
                >
                  <X className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('knownErrors.newEntry')}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? t('knownErrors.saving') : t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>
          )}

          {/* Title + Ticket */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>{t('knownErrors.fields.title')} *</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t('knownErrors.fields.titlePlaceholder')}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('knownErrors.fields.ticketNumber')}</label>
              <input
                value={form.ticketNumber}
                onChange={(e) => setForm((f) => ({ ...f, ticketNumber: e.target.value }))}
                placeholder={t('knownErrors.fields.ticketNumberPlaceholder')}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          {/* Severity + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('knownErrors.fields.severity')}</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as KnownErrorSeverity }))}
                className={inputCls}
              >
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('knownErrors.fields.status')}</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as KnownErrorStatus }))}
                className={inputCls}
              >
                <option value="open">{t('knownErrors.status.open')}</option>
                <option value="workaround">{t('knownErrors.status.workaround')}</option>
                <option value="resolved">{t('knownErrors.status.resolved')}</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>{t('knownErrors.fields.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('knownErrors.fields.descriptionPlaceholder')}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Solution with Markdown editor */}
          <div>
            <label className={labelCls}>{t('knownErrors.fields.solution')}</label>
            <MarkdownEditor
              value={form.solution}
              onChange={(v) => setForm((f) => ({ ...f, solution: v }))}
              placeholder={t('knownErrors.fields.solutionPlaceholder')}
              rows={6}
            />
          </div>

          {/* Software */}
          {software.length > 0 && (
            <div>
              <label className={labelCls}>{t('knownErrors.fields.affectedSoftware')}</label>
              <div className="flex flex-wrap gap-2">
                {software.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => toggleSoftware(sw.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.softwareIds.includes(sw.id)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    {sw.name}
                    {sw.version && <span className="opacity-60">v{sw.version}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className={labelCls}>{t('knownErrors.fields.tags')}</label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder={t('knownErrors.fields.tagsPlaceholder')}
              className={inputCls}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('knownErrors.deleteEntry')}
        message={t('knownErrors.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}
