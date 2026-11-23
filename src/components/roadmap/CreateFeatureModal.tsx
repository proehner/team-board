import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon } from 'lucide-react'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import type { RoadmapStatus, RoadmapPriority } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { ROADMAP_STATUSES, ROADMAP_PRIORITIES } from './roadmapConfig'

interface CreateFeatureModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (id: string) => void
  /** Existing categories for autocomplete suggestions */
  categories?: string[]
}

const FORM_ID = 'roadmap-create-feature'

export default function CreateFeatureModal({ isOpen, onClose, onCreated, categories = [] }: CreateFeatureModalProps) {
  const { t } = useTranslation()
  const addRoadmapFeature = useStore((s) => s.addRoadmapFeature)
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [status, setStatus]     = useState<RoadmapStatus>('idea')
  const [priority, setPriority] = useState<RoadmapPriority>('medium')
  const [category, setCategory] = useState('')
  const [saving, setSaving]     = useState(false)

  const dirty = !!(title || description || category)

  function reset() {
    setTitle(''); setDesc(''); setStatus('idea'); setPriority('medium'); setCategory('')
  }

  function close() {
    if (saving) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const id = await addRoadmapFeature({ title: title.trim(), description, status, priority, category: category.trim() || undefined })
      toast.success(t('roadmap.toast.featureCreated'), { description: title.trim() })
      reset()
      onCreated(id)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={t('roadmap.newFeature')}
      description={t('roadmap.newFeatureHint')}
      icon={<MapIcon />}
      size="md"
      dismissible={!dirty}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={saving} disabled={!title.trim()}>
            {t('roadmap.createFeature')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('roadmap.featureTitle')} htmlFor="rf-title" required>
          <input
            id="rf-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder={t('roadmap.featureTitlePlaceholder')}
          />
        </Field>
        <Field label={t('roadmap.shortDescription')} htmlFor="rf-desc" optional>
          <textarea
            id="rf-desc"
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="form-textarea"
            placeholder={t('roadmap.shortDescriptionPlaceholder')}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('roadmap.status')} htmlFor="rf-status">
            <Select id="rf-status" value={status} onChange={(e) => setStatus(e.target.value as RoadmapStatus)}>
              {ROADMAP_STATUSES.map((s) => <option key={s} value={s}>{t(`roadmap.statusLabels.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('roadmap.priority')} htmlFor="rf-priority">
            <Select id="rf-priority" value={priority} onChange={(e) => setPriority(e.target.value as RoadmapPriority)}>
              {ROADMAP_PRIORITIES.map((p) => <option key={p} value={p}>{t(`roadmap.priorityLabels.${p}`)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t('roadmap.category')} htmlFor="rf-category" optional>
          <input
            id="rf-category"
            list="rf-category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-input"
            placeholder={t('roadmap.categoryPlaceholder')}
          />
          <datalist id="rf-category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
      </form>
    </Modal>
  )
}
