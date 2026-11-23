import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Field from '@/components/ui/Field'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Pencil, Trash2, Layers, Check, Info } from 'lucide-react'
import type { CapacityActivity } from '@/types'

const COLOR_OPTIONS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#f97316', '#0ea5e9',
  '#ec4899', '#84cc16', '#a855f7', '#e11d48',
]

interface ActivityFormData {
  name: string
  color: string
  countsToSprint: boolean
}

export default function CapacityActivitiesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const uid = useId()
  const activities = useStore((s) => s.capacityActivities)
  const addCapacityActivity = useStore((s) => s.addCapacityActivity)
  const updateCapacityActivity = useStore((s) => s.updateCapacityActivity)
  const deleteCapacityActivity = useStore((s) => s.deleteCapacityActivity)

  const [editTarget, setEditTarget] = useState<CapacityActivity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CapacityActivity | null>(null)
  const [form, setForm] = useState<ActivityFormData>(emptyForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function emptyForm(): ActivityFormData {
    return { name: '', color: COLOR_OPTIONS[activities.length % COLOR_OPTIONS.length], countsToSprint: false }
  }

  function resetForm() {
    setEditTarget(null)
    setForm(emptyForm())
    setFormError('')
  }

  function openEdit(a: CapacityActivity) {
    setEditTarget(a)
    setForm({ name: a.name, color: a.color, countsToSprint: a.countsToSprint })
    setFormError('')
    requestAnimationFrame(() => document.getElementById(`${uid}-name`)?.focus())
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (saving) return
    if (!form.name.trim()) { setFormError(t('capacity.nameRequired')); return }
    setSaving(true)
    try {
      if (editTarget) {
        await updateCapacityActivity(editTarget.id, form)
        toast.success(t('common.saved'))
      } else {
        await addCapacityActivity(form)
        toast.success(t('capacity.activityAdded', { name: form.name.trim() }))
      }
      resetForm()
    } catch (err) {
      const msg = errorMessage(err, String(err))
      setFormError(msg.includes('already exists') ? t('capacity.nameExists') : t('common.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleCountsToSprint(a: CapacityActivity, value: boolean) {
    try {
      await updateCapacityActivity(a.id, { countsToSprint: value })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => { resetForm(); onClose() }}
        title={t('capacity.activities')}
        description={t('capacity.activitiesDescription')}
        icon={<Layers />}
        size="lg"
        footer={<Button variant="secondary" onClick={() => { resetForm(); onClose() }}>{t('common.close')}</Button>}
      >
        <div className="space-y-6">
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/40 dark:text-slate-400 dark:ring-slate-700/50">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
            {t('capacity.activitiesHint')}
          </p>
          {activities.length === 0 ? (
            <EmptyState compact icon={<Layers />} title={t('capacity.noActivities')} className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700" />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {activities.map((a) => {
                const isEditing = editTarget?.id === a.id
                return (
                  <li
                    key={a.id}
                    className={`group flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors ${
                      isEditing ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: a.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{a.name}</span>
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-md px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={a.countsToSprint}
                        onChange={(e) => toggleCountsToSprint(a, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
                      />
                      {t('capacity.countsToSprint')}
                    </label>
                    <div className="flex items-center gap-0.5">
                      <IconButton size="xs" icon={<Pencil />} label={t('common.edit')} onClick={() => openEdit(a)} active={isEditing} />
                      <IconButton size="xs" variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => setDeleteTarget(a)} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {editTarget ? <Pencil className="h-4 w-4 text-slate-400" /> : <Plus className="h-4 w-4 text-slate-400" />}
              {editTarget ? t('capacity.editActivity', { name: editTarget.name }) : t('capacity.addActivity')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label={t('common.name')} htmlFor={`${uid}-name`} error={formError}>
                <input
                  id={`${uid}-name`}
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError('') }}
                  onKeyDown={(e) => { if (e.key === 'Escape' && editTarget) { e.stopPropagation(); resetForm() } }}
                  placeholder={t('capacity.activityNamePlaceholder')}
                  className="form-input"
                  aria-invalid={!!formError}
                />
              </Field>
              <div>
                <span id={`${uid}-color`} className="form-label">{t('rotation.color')}</span>
                <div role="radiogroup" aria-labelledby={`${uid}-color`} className="grid w-max grid-cols-6 gap-1.5">
                  {COLOR_OPTIONS.map((c) => {
                    const selected = form.color === c
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 ${
                          selected ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.countsToSprint}
                onChange={(e) => setForm((f) => ({ ...f, countsToSprint: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              {t('capacity.countsToSprintLong')}
            </label>
            <div className="mt-4 flex justify-end gap-2">
              {editTarget && (
                <Button variant="ghost" onClick={resetForm} disabled={saving}>{t('common.cancel')}</Button>
              )}
              <Button variant="primary" type="submit" loading={saving} icon={editTarget ? <Check /> : <Plus />}>
                {editTarget ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteCapacityActivity(deleteTarget.id)
            if (editTarget?.id === deleteTarget.id) resetForm()
            toast.success(t('capacity.activityDeleted', { name: deleteTarget.name }))
          } catch (err) {
            toast.error(t('common.deleteError'), { description: errorMessage(err) })
            throw err
          }
        }}
        title={t('capacity.deleteActivity')}
        message={t('capacity.deleteActivityConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}
