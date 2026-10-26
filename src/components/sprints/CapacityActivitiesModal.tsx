import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Plus, Edit2, Trash2 } from 'lucide-react'
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
  const activities = useStore((s) => s.capacityActivities)
  const addCapacityActivity = useStore((s) => s.addCapacityActivity)
  const updateCapacityActivity = useStore((s) => s.updateCapacityActivity)
  const deleteCapacityActivity = useStore((s) => s.deleteCapacityActivity)

  const [editTarget, setEditTarget] = useState<CapacityActivity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CapacityActivity | null>(null)
  const [form, setForm] = useState<ActivityFormData>(emptyForm())
  const [formError, setFormError] = useState('')

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
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setFormError(t('capacity.nameRequired')); return }
    try {
      if (editTarget) await updateCapacityActivity(editTarget.id, form)
      else            await addCapacityActivity(form)
      resetForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFormError(msg.includes('already exists') ? t('capacity.nameExists') : t('common.saveError'))
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose() }} title={t('capacity.activities')} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('capacity.activitiesHint')}</p>
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{a.name}</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.countsToSprint}
                    onChange={(e) => updateCapacityActivity(a.id, { countsToSprint: e.target.checked }).catch(() => {})}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  {t('capacity.countsToSprint')}
                </label>
                <button onClick={() => openEdit(a)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(a)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">{t('capacity.noActivities')}</p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {editTarget ? editTarget.name : t('capacity.addActivity')}
            </h3>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[10rem] space-y-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                  placeholder={t('capacity.activityNamePlaceholder')}
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
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-slate-700 dark:border-slate-300 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.countsToSprint}
                onChange={(e) => setForm((f) => ({ ...f, countsToSprint: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600"
              />
              {t('capacity.countsToSprintLong')}
            </label>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2">
              {editTarget && (
                <Button variant="secondary" onClick={resetForm}>{t('common.cancel')}</Button>
              )}
              <Button variant="primary" icon={editTarget ? undefined : <Plus className="w-4 h-4" />} onClick={handleSubmit}>
                {editTarget ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            if (editTarget?.id === deleteTarget.id) resetForm()
            deleteCapacityActivity(deleteTarget.id).catch(() => {})
          }
        }}
        title={t('capacity.deleteActivity')}
        message={t('capacity.deleteActivityConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}
