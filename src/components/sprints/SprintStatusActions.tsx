import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatDate } from '@/utils/date'
import { Play, CheckCircle, X, RotateCcw } from 'lucide-react'
import type { Sprint, SprintStatus } from '@/types'

/**
 * The next sensible status step for a sprint (start / complete / cancel / reopen).
 * Starting a sprint while another one is active offers to complete the other one.
 */
export default function SprintStatusActions({ sprint, compact = false }: { sprint: Sprint; compact?: boolean }) {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const setSprintStatus = useStore((s) => s.setSprintStatus)

  const [conflict, setConflict] = useState<Sprint | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  const size = compact ? 'sm' : 'md'
  const iconClass = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'

  async function changeStatus(...steps: [string, SprintStatus][]) {
    setBusy(true)
    try {
      for (const [id, status] of steps) await setSprintStatus(id, status)
    } catch { /* silent – UI shows the unchanged status */ }
    finally { setBusy(false) }
  }

  function activate() {
    const otherActive = sprints.find((s) => s.status === 'Aktiv' && s.id !== sprint.id)
    if (otherActive) setConflict(otherActive)
    else changeStatus([sprint.id, 'Aktiv'])
  }

  return (
    <>
      {sprint.status === 'Geplant' && (
        <Button variant="primary" size={size} icon={<Play className={iconClass} />} onClick={activate} loading={busy}>
          {t('sprintActions.start')}
        </Button>
      )}
      {sprint.status === 'Aktiv' && (
        <>
          <Button
            variant="primary"
            size={size}
            icon={<CheckCircle className={iconClass} />}
            onClick={() => changeStatus([sprint.id, 'Abgeschlossen'])}
            loading={busy}
          >
            {t('sprintActions.complete')}
          </Button>
          <Button
            variant="ghost"
            size={size}
            icon={<X className={iconClass} />}
            onClick={() => setConfirmCancel(true)}
            title={t('sprintActions.cancelTitle')}
            className="hover:!text-red-600"
          >
            {!compact && t('sprintActions.cancel')}
          </Button>
        </>
      )}
      {!compact && (sprint.status === 'Abgeschlossen' || sprint.status === 'Abgebrochen') && (
        <Button variant="secondary" size={size} icon={<RotateCcw className={iconClass} />} onClick={activate} loading={busy}>
          {t('sprintActions.reopen')}
        </Button>
      )}

      <Modal
        isOpen={!!conflict}
        onClose={() => setConflict(null)}
        title={t('sprintActions.conflictTitle')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConflict(null)}>{t('common.cancel')}</Button>
            <Button variant="secondary" onClick={() => { changeStatus([sprint.id, 'Aktiv']); setConflict(null) }}>
              {t('sprintActions.startParallel')}
            </Button>
            <Button
              variant="primary"
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={() => {
                if (conflict) changeStatus([conflict.id, 'Abgeschlossen'], [sprint.id, 'Aktiv'])
                setConflict(null)
              }}
            >
              {t('sprintActions.completeAndStart', { active: conflict?.name })}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('sprintActions.conflictMessage', {
            active: conflict?.name,
            end: conflict ? formatDate(conflict.endDate) : '',
            name: sprint.name,
          })}
        </p>
      </Modal>

      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => changeStatus([sprint.id, 'Abgebrochen'])}
        title={t('sprintActions.cancelTitle')}
        message={t('sprintActions.cancelConfirm', { name: sprint.name })}
        confirmLabel={t('sprintActions.cancelTitle')}
      />
    </>
  )
}
