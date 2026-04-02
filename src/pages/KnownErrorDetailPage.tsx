import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bug, Pencil, Trash2, Tag, Monitor, Ticket,
  AlertTriangle, AlertCircle, Info, CheckCircle2, Wrench, Save, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import type { KnownErrorSeverity, KnownErrorStatus } from '@/types'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { format } from 'date-fns'

// ─── Severity & Status badges ─────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: KnownErrorSeverity }) {
  const { t } = useTranslation()
  const cfg = {
    critical: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: AlertCircle },
    high:     { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', Icon: AlertTriangle },
    medium:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Info },
    low:      { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', Icon: Info },
  }[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cfg.cls}`}>
      <cfg.Icon className="w-4 h-4" />
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cfg.cls}`}>
      <cfg.Icon className="w-4 h-4" />
      {t(`knownErrors.status.${status}`)}
    </span>
  )
}

const SEVERITY_ORDER: KnownErrorSeverity[] = ['critical', 'high', 'medium', 'low']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnownErrorDetailPage() {
  const { errorId } = useParams<{ errorId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const knownErrors      = useStore((s) => s.knownErrors)
  const software         = useStore((s) => s.software)
  const updateKnownError = useStore((s) => s.updateKnownError)
  const deleteKnownError = useStore((s) => s.deleteKnownError)

  const ke = knownErrors.find((k) => k.id === errorId)

  const [editing,       setEditing]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState('')

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

  if (!ke) {
    return (
      <div className="p-4 sm:p-6">
        <button onClick={() => navigate('/known-errors')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('knownErrors.backToList')}
        </button>
        <p className="text-slate-500">{t('knownErrors.notFound')}</p>
      </div>
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
    setSaveError('')
    setEditing(true)
  }

  async function saveEdit() {
    if (!editTitle.trim()) { setSaveError(t('knownErrors.titleRequired')); return }
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
        tags:         editTags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setEditing(false)
    } catch {
      setSaveError(t('knownErrors.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await deleteKnownError(ke!.id)
    navigate('/known-errors')
  }

  function toggleSoftware(id: string) {
    setEditSoftwareIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelCls = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/known-errors')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('knownErrors.backToList')}
      </button>

      {/* Header card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
        {editing ? (
          <>
            {saveError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>{t('knownErrors.fields.title')} *</label>
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('knownErrors.fields.ticketNumber')}</label>
                <input
                  value={editTicketNumber}
                  onChange={(e) => setEditTicketNumber(e.target.value)}
                  placeholder={t('knownErrors.fields.ticketNumberPlaceholder')}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('knownErrors.fields.severity')}</label>
                <select value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as KnownErrorSeverity)} className={inputCls}>
                  {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{t(`knownErrors.severity.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('knownErrors.fields.status')}</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as KnownErrorStatus)} className={inputCls}>
                  <option value="open">{t('knownErrors.status.open')}</option>
                  <option value="workaround">{t('knownErrors.status.workaround')}</option>
                  <option value="resolved">{t('knownErrors.status.resolved')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}><X className="w-4 h-4" />{t('common.cancel')}</Button>
              <Button variant="primary" onClick={saveEdit} disabled={saving}><Save className="w-4 h-4" />{saving ? t('knownErrors.saving') : t('common.save')}</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Bug className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{ke.title}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <SeverityBadge severity={ke.severity} />
                  <StatusBadge status={ke.status} />
                  {ke.ticketNumber && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <Ticket className="w-4 h-4" />
                      {ke.ticketNumber}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  <Pencil className="w-4 h-4" />
                  {t('common.edit')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
              <span>{t('knownErrors.createdAt')}: {format(new Date(ke.createdAt), 'dd.MM.yyyy HH:mm')}</span>
              <span>{t('knownErrors.updatedAt')}: {format(new Date(ke.updatedAt), 'dd.MM.yyyy HH:mm')}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem description */}
          <Section title={t('knownErrors.fields.description')} icon={<AlertCircle className="w-4 h-4" />}>
            {editing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={5}
                placeholder={t('knownErrors.fields.descriptionPlaceholder')}
                className={`${inputCls} resize-none`}
              />
            ) : ke.description ? (
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{ke.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">{t('knownErrors.noContent')}</p>
            )}
          </Section>

          {/* Solution — with Markdown */}
          <Section title={t('knownErrors.fields.solution')} icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}>
            {editing ? (
              <MarkdownEditor
                value={editSolution}
                onChange={setEditSolution}
                placeholder={t('knownErrors.fields.solutionPlaceholder')}
                rows={10}
              />
            ) : ke.solution ? (
              <MarkdownRenderer content={ke.solution} />
            ) : (
              <p className="text-sm text-slate-400 italic">{t('knownErrors.noContent')}</p>
            )}
          </Section>

          {/* Workaround — with Markdown */}
          {(editing || ke.workaround) && (
            <Section title={t('knownErrors.fields.workaround')} icon={<Wrench className="w-4 h-4 text-amber-500" />}>
              {editing ? (
                <MarkdownEditor
                  value={editWorkaround}
                  onChange={setEditWorkaround}
                  placeholder={t('knownErrors.fields.workaroundPlaceholder')}
                  rows={5}
                />
              ) : ke.workaround ? (
                <MarkdownRenderer content={ke.workaround} />
              ) : null}
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Affected Software */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              {t('knownErrors.fields.affectedSoftware')}
            </h3>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {software.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => toggleSoftware(sw.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      editSoftwareIds.includes(sw.id)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {sw.name}
                    {sw.version && <span className="opacity-60">v{sw.version}</span>}
                  </button>
                ))}
                {software.length === 0 && (
                  <p className="text-xs text-slate-400">{t('knownErrors.noSoftwareConfigured')}</p>
                )}
              </div>
            ) : ke.softwareIds.length > 0 ? (
              <div className="space-y-2">
                {ke.softwareIds.map((id) => {
                  const sw = softwareMap[id]
                  if (!sw) return null
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{sw.name}</p>
                        {(sw.vendor || sw.version) && (
                          <p className="text-xs text-slate-400">
                            {[sw.vendor, sw.version ? `v${sw.version}` : undefined].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">{t('knownErrors.noSoftwareAssigned')}</p>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              {t('knownErrors.fields.tags')}
            </h3>
            {editing ? (
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder={t('knownErrors.fields.tagsPlaceholder')}
                className={inputCls}
              />
            ) : ke.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ke.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">{t('knownErrors.noTags')}</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('knownErrors.deleteEntry')}
        message={t('knownErrors.deleteConfirm', { title: ke.title })}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
        variant="danger"
      />
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}
