import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Pencil, Trash2, Lock, Globe, Monitor, Server } from 'lucide-react'
import type { RoadmapEndpoint, RoadmapScreen, HttpMethod, EndpointComplexity } from '@/types'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { HTTP_METHODS, METHOD_CLS, COMPLEXITIES, COMPLEXITY_META } from './roadmapConfig'

const rowActionsCls =
  'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'

export function MethodBadge({ method, className = '' }: { method: HttpMethod; className?: string }) {
  return (
    <span className={`inline-flex w-14 shrink-0 justify-center rounded-md px-1.5 py-0.5 font-mono text-2xs font-bold ring-1 ring-inset ${METHOD_CLS[method].badge} ${className}`}>
      {method}
    </span>
  )
}

/** Checkbox list to link endpoints to a screen */
function EndpointPicker({ endpoints, value, onChange }: { endpoints: RoadmapEndpoint[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin dark:divide-slate-800 dark:border-slate-700">
      {endpoints.map((ep) => (
        <label key={ep.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <input
            type="checkbox"
            checked={value.includes(ep.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, ep.id] : value.filter((id) => id !== ep.id))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <MethodBadge method={ep.method} />
          <span className="min-w-0 flex-1 truncate font-mono text-slate-700 dark:text-slate-300">{ep.path || '/'}</span>
          {ep.title && <span className="hidden truncate text-slate-400 sm:block">{ep.title}</span>}
        </label>
      ))}
    </div>
  )
}

// ─── Endpoint form modal ──────────────────────────────────────────────────────

interface EndpointFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Existing endpoint → edit mode (all fields); otherwise quick-create */
  endpoint?: RoadmapEndpoint
  onSubmit: (data: Partial<RoadmapEndpoint>) => Promise<void>
}

function endpointInitial(ep?: RoadmapEndpoint) {
  return {
    method:       ep?.method ?? ('GET' as HttpMethod),
    path:         ep?.path ?? '',
    title:        ep?.title ?? '',
    description:  ep?.description ?? '',
    requestBody:  ep?.requestBody ?? '',
    responseBody: ep?.responseBody ?? '',
    authRequired: ep?.authRequired ?? true,
    complexity:   ep?.complexity ?? ('m' as EndpointComplexity),
    notes:        ep?.notes ?? '',
  }
}

const ENDPOINT_FORM_ID = 'roadmap-endpoint-form'

export function EndpointFormModal({ isOpen, onClose, endpoint, onSubmit }: EndpointFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm]     = useState(() => endpointInitial(endpoint))
  const [saving, setSaving] = useState(false)
  const isEdit = !!endpoint

  useEffect(() => {
    if (isOpen) setForm(endpointInitial(endpoint))
  }, [isOpen, endpoint])

  const invalid = !isEdit && !form.path.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (invalid || saving) return
    setSaving(true)
    try {
      if (isEdit) {
        await onSubmit(form)
      } else {
        const { method, path, title, complexity, authRequired } = form
        await onSubmit({ method, path, title, complexity, authRequired })
      }
      toast.success(isEdit ? t('roadmap.toast.endpointSaved') : t('roadmap.toast.endpointCreated'))
      onClose()
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const id = (k: string) => `ep-${k}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose() }}
      title={isEdit ? t('roadmap.editEndpoint') : t('roadmap.addEndpoint')}
      icon={<Server />}
      size={isEdit ? 'lg' : 'md'}
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form={ENDPOINT_FORM_ID} loading={saving} disabled={invalid}>
            {isEdit ? t('common.save') : t('roadmap.addEndpoint')}
          </Button>
        </>
      }
    >
      <form id={ENDPOINT_FORM_ID} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('roadmap.endpointMethod')} htmlFor={id('method')}>
          <Select id={id('method')} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as HttpMethod })} className="font-mono">
            {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label={t('roadmap.endpointComplexity')} htmlFor={id('complexity')}>
          <Select id={id('complexity')} value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value as EndpointComplexity })}>
            {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_META[c].label}</option>)}
          </Select>
        </Field>
        <Field label={t('roadmap.endpointPath')} htmlFor={id('path')} required={!isEdit} className="sm:col-span-2">
          <input
            id={id('path')}
            autoFocus
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
            placeholder="/api/v1/resource"
            className="form-input font-mono"
          />
        </Field>
        <Field label={t('roadmap.endpointTitle')} htmlFor={id('title')} className="sm:col-span-2">
          <input
            id={id('title')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('roadmap.endpointTitlePlaceholder')}
            className="form-input"
          />
        </Field>
        {isEdit && (
          <>
            <Field label={t('roadmap.endpointDescription')} htmlFor={id('desc')} className="sm:col-span-2">
              <textarea id={id('desc')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="form-textarea" />
            </Field>
            <Field label={t('roadmap.endpointRequestBody')} htmlFor={id('req')}>
              <textarea
                id={id('req')} value={form.requestBody} rows={5}
                onChange={(e) => setForm({ ...form, requestBody: e.target.value })}
                placeholder={'{\n  "field": "type"\n}'}
                className="form-textarea font-mono text-xs"
              />
            </Field>
            <Field label={t('roadmap.endpointResponseBody')} htmlFor={id('res')}>
              <textarea
                id={id('res')} value={form.responseBody} rows={5}
                onChange={(e) => setForm({ ...form, responseBody: e.target.value })}
                placeholder={'{\n  "id": "string",\n  "data": []\n}'}
                className="form-textarea font-mono text-xs"
              />
            </Field>
            <Field label={t('roadmap.endpointNotes')} htmlFor={id('notes')} className="sm:col-span-2">
              <textarea id={id('notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="form-textarea" />
            </Field>
          </>
        )}
        <label htmlFor={id('auth')} className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
          <input
            type="checkbox" id={id('auth')} checked={form.authRequired}
            onChange={(e) => setForm({ ...form, authRequired: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            {t('roadmap.endpointAuth')}
          </span>
        </label>
      </form>
    </Modal>
  )
}

// ─── Endpoint row ─────────────────────────────────────────────────────────────

interface EndpointRowProps {
  endpoint: RoadmapEndpoint
  onUpdate: (data: Partial<RoadmapEndpoint>) => Promise<void>
  onDelete: () => Promise<void>
  canWrite?: boolean
}

export function EndpointRow({ endpoint, onUpdate, onDelete, canWrite = true }: EndpointRowProps) {
  const { t } = useTranslation()
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cc = COMPLEXITY_META[endpoint.complexity]
  const hasDetails = !!(endpoint.description || endpoint.requestBody || endpoint.responseBody || endpoint.notes)

  async function handleDelete() {
    try {
      await onDelete()
      toast.success(t('roadmap.toast.endpointDeleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
        >
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'} ${hasDetails ? '' : 'opacity-40'}`} />
          <MethodBadge method={endpoint.method} />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-800 dark:text-slate-200">
            {endpoint.path || <span className="font-sans italic text-slate-400">{t('roadmap.noPath')}</span>}
          </span>
          {endpoint.title && <span className="hidden max-w-[14rem] truncate text-xs text-slate-500 md:block dark:text-slate-400">{endpoint.title}</span>}
          <span className={`w-6 shrink-0 text-center text-xs font-semibold ${cc.text}`} title={t('roadmap.endpointComplexity')}>{cc.label}</span>
          <span title={endpoint.authRequired ? t('roadmap.endpointAuth') : t('roadmap.endpointPublic')} className="shrink-0">
            {endpoint.authRequired
              ? <Lock className="h-3.5 w-3.5 text-amber-500" aria-label={t('roadmap.endpointAuth')} />
              : <Globe className="h-3.5 w-3.5 text-slate-400" aria-label={t('roadmap.endpointPublic')} />}
          </span>
        </button>
        {canWrite && (
          <div className={rowActionsCls}>
            <IconButton size="xs" icon={<Pencil />} label={t('common.edit')} onClick={() => setEditing(true)} />
            <IconButton size="xs" variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => setConfirmDelete(true)} />
          </div>
        )}
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm animate-fade-in dark:border-slate-800 dark:bg-slate-800/30">
          {endpoint.title && <p className="font-medium text-slate-700 md:hidden dark:text-slate-200">{endpoint.title}</p>}
          {endpoint.description && <p className="text-slate-600 dark:text-slate-400">{endpoint.description}</p>}
          {(endpoint.requestBody || endpoint.responseBody) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {endpoint.requestBody && (
                <div className="min-w-0">
                  <p className="mb-1 section-label">{t('roadmap.endpointRequestBody')}</p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 scrollbar-thin dark:bg-slate-950/60 dark:text-slate-300">{endpoint.requestBody}</pre>
                </div>
              )}
              {endpoint.responseBody && (
                <div className="min-w-0">
                  <p className="mb-1 section-label">{t('roadmap.endpointResponseBody')}</p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 scrollbar-thin dark:bg-slate-950/60 dark:text-slate-300">{endpoint.responseBody}</pre>
                </div>
              )}
            </div>
          )}
          {endpoint.notes && <p className="text-xs italic text-slate-500 dark:text-slate-400">{endpoint.notes}</p>}
          {!hasDetails && !endpoint.title && <p className="text-xs text-slate-400">{t('roadmap.noDetails')}</p>}
        </div>
      )}

      {canWrite && (
        <>
          <EndpointFormModal isOpen={editing} onClose={() => setEditing(false)} endpoint={endpoint} onSubmit={onUpdate} />
          <ConfirmDialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            title={t('roadmap.deleteEndpointTitle')}
            message={t('roadmap.deleteEndpointConfirm', { name: `${endpoint.method} ${endpoint.path || '/'}` })}
            confirmLabel={t('common.delete')}
          />
        </>
      )}
    </div>
  )
}

// ─── Screen form modal ────────────────────────────────────────────────────────

interface ScreenFormModalProps {
  isOpen: boolean
  onClose: () => void
  screen?: RoadmapScreen
  endpoints: RoadmapEndpoint[]
  onSubmit: (data: Partial<RoadmapScreen>) => Promise<void>
}

function screenInitial(sc?: RoadmapScreen) {
  return {
    title:          sc?.title ?? '',
    route:          sc?.route ?? '',
    description:    sc?.description ?? '',
    components:     sc?.components.join(', ') ?? '',
    endpointIds:    sc?.endpointIds ?? ([] as string[]),
    wireframeNotes: sc?.wireframeNotes ?? '',
  }
}

const SCREEN_FORM_ID = 'roadmap-screen-form'

export function ScreenFormModal({ isOpen, onClose, screen, endpoints, onSubmit }: ScreenFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm]     = useState(() => screenInitial(screen))
  const [saving, setSaving] = useState(false)
  const isEdit = !!screen

  useEffect(() => {
    if (isOpen) setForm(screenInitial(screen))
  }, [isOpen, screen])

  const invalid = !isEdit && !form.title.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (invalid || saving) return
    setSaving(true)
    try {
      if (isEdit) {
        await onSubmit({
          ...form,
          components: form.components.split(',').map((c) => c.trim()).filter(Boolean),
        })
      } else {
        await onSubmit({ title: form.title, route: form.route, endpointIds: form.endpointIds })
      }
      toast.success(isEdit ? t('roadmap.toast.screenSaved') : t('roadmap.toast.screenCreated'))
      onClose()
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const id = (k: string) => `sc-${k}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose() }}
      title={isEdit ? t('roadmap.editScreen') : t('roadmap.addScreen')}
      icon={<Monitor />}
      size={isEdit ? 'lg' : 'md'}
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form={SCREEN_FORM_ID} loading={saving} disabled={invalid}>
            {isEdit ? t('common.save') : t('roadmap.addScreen')}
          </Button>
        </>
      }
    >
      <form id={SCREEN_FORM_ID} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('roadmap.screenTitle')} htmlFor={id('title')} required={!isEdit}>
          <input
            id={id('title')} autoFocus value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('roadmap.screenTitlePlaceholder')}
            className="form-input"
          />
        </Field>
        <Field label={t('roadmap.screenRoute')} htmlFor={id('route')}>
          <input
            id={id('route')} value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            placeholder="/dashboard"
            className="form-input font-mono"
          />
        </Field>
        {isEdit && (
          <>
            <Field label={t('roadmap.screenDescription')} htmlFor={id('desc')} className="sm:col-span-2">
              <textarea id={id('desc')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="form-textarea" />
            </Field>
            <Field label={t('roadmap.screenComponents')} htmlFor={id('components')} hint={t('roadmap.tagsSeparator')} className="sm:col-span-2">
              <input
                id={id('components')} value={form.components}
                onChange={(e) => setForm({ ...form, components: e.target.value })}
                placeholder={t('roadmap.screenComponentsPlaceholder')}
                className="form-input"
              />
            </Field>
          </>
        )}
        {endpoints.length > 0 && (
          <div className="sm:col-span-2">
            <span className="form-label">{t('roadmap.screenLinkedEndpoints')}</span>
            <EndpointPicker endpoints={endpoints} value={form.endpointIds} onChange={(ids) => setForm({ ...form, endpointIds: ids })} />
          </div>
        )}
        {isEdit && (
          <Field label={t('roadmap.screenWireframeNotes')} htmlFor={id('wire')} className="sm:col-span-2">
            <textarea id={id('wire')} value={form.wireframeNotes} onChange={(e) => setForm({ ...form, wireframeNotes: e.target.value })} rows={3} className="form-textarea" />
          </Field>
        )}
      </form>
    </Modal>
  )
}

// ─── Screen row ───────────────────────────────────────────────────────────────

interface ScreenRowProps {
  screen: RoadmapScreen
  endpoints: RoadmapEndpoint[]
  onUpdate: (data: Partial<RoadmapScreen>) => Promise<void>
  onDelete: () => Promise<void>
  canWrite?: boolean
}

export function ScreenRow({ screen, endpoints, onUpdate, onDelete, canWrite = true }: ScreenRowProps) {
  const { t } = useTranslation()
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const linkedEps = endpoints.filter((e) => screen.endpointIds.includes(e.id))
  const hasDetails = !!(screen.description || screen.components.length || linkedEps.length || screen.wireframeNotes)

  async function handleDelete() {
    try {
      await onDelete()
      toast.success(t('roadmap.toast.screenDeleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
        >
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'} ${hasDetails ? '' : 'opacity-40'}`} />
          <Monitor className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {screen.title || <span className="font-normal italic text-slate-400">{t('roadmap.noTitle')}</span>}
          </span>
          {screen.route && <span className="hidden max-w-[12rem] truncate font-mono text-xs text-slate-500 sm:block dark:text-slate-400">{screen.route}</span>}
          {linkedEps.length > 0 && (
            <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" title={t('roadmap.screenLinkedEndpoints')}>
              {linkedEps.length} EP
            </span>
          )}
        </button>
        {canWrite && (
          <div className={rowActionsCls}>
            <IconButton size="xs" icon={<Pencil />} label={t('common.edit')} onClick={() => setEditing(true)} />
            <IconButton size="xs" variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => setConfirmDelete(true)} />
          </div>
        )}
      </div>
      {expanded && (
        <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm animate-fade-in dark:border-slate-800 dark:bg-slate-800/30">
          {screen.route && <p className="font-mono text-xs text-slate-500 sm:hidden dark:text-slate-400">{screen.route}</p>}
          {screen.description && <p className="text-slate-600 dark:text-slate-400">{screen.description}</p>}
          {screen.components.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {screen.components.map((c, i) => (
                <span key={i} className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">{c}</span>
              ))}
            </div>
          )}
          {linkedEps.length > 0 && (
            <div className="space-y-1">
              <p className="section-label">{t('roadmap.screenLinkedEndpoints')}</p>
              <ul className="space-y-1">
                {linkedEps.map((ep) => (
                  <li key={ep.id} className="flex items-center gap-2 text-xs">
                    <MethodBadge method={ep.method} />
                    <span className="font-mono text-slate-600 dark:text-slate-300">{ep.path}</span>
                    {ep.title && <span className="truncate text-slate-400">— {ep.title}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {screen.wireframeNotes && (
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-500 dark:text-slate-400">{screen.wireframeNotes}</pre>
          )}
          {!hasDetails && <p className="text-xs text-slate-400">{t('roadmap.noDetails')}</p>}
        </div>
      )}

      {canWrite && (
        <>
          <ScreenFormModal isOpen={editing} onClose={() => setEditing(false)} screen={screen} endpoints={endpoints} onSubmit={onUpdate} />
          <ConfirmDialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            title={t('roadmap.deleteScreenTitle')}
            message={t('roadmap.deleteScreenConfirm', { name: screen.title || t('roadmap.noTitle') })}
            confirmLabel={t('common.delete')}
          />
        </>
      )}
    </div>
  )
}
