import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { DropdownItem } from '@/components/ui/DropdownMenu'
import { formatDate } from '@/utils/date'
import { Play, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from 'lucide-react'
import type { Sprint, SprintStatus } from '@/types'

type Step = [id: string, status: SprintStatus]

interface Options {
  /** Button size of the primary action */
  size?: 'sm' | 'md'
  /** Render "reopen" as visible button for finished sprints (otherwise it is only offered in `menuItems`) */
  reopenAsButton?: boolean
  /** Variant of the start button of planned sprints (complete is always primary) */
  startVariant?: 'primary' | 'secondary'
}

/**
 * Status workflow of a sprint (start / complete / cancel / reopen).
 * Starting a sprint while another one is active offers to complete the other one.
 *
 * Returns the primary action as button, the secondary actions as dropdown items and the dialogs,
 * which must be rendered by the caller.
 */
export function useSprintStatusActions(sprint: Sprint, { size = 'md', reopenAsButton = false, startVariant = 'primary' }: Options = {}) {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const setSprintStatus = useStore((s) => s.setSprintStatus)

  const [conflict, setConflict] = useState<Sprint | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  async function changeStatus(successMessage: string, ...steps: Step[]): Promise<boolean> {
    setBusy(true)
    try {
      for (const [id, status] of steps) await setSprintStatus(id, status)
      toast.success(successMessage)
      return true
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      return false
    } finally {
      setBusy(false)
    }
  }

  function activate(reopen = false) {
    const otherActive = sprints.find((s) => s.status === 'Aktiv' && s.id !== sprint.id)
    if (otherActive) setConflict(otherActive)
    else changeStatus(t(reopen ? 'sprintActions.reopened' : 'sprintActions.started', { name: sprint.name }), [sprint.id, 'Aktiv'])
  }

  const complete = () =>
    changeStatus(t('sprintActions.completed', { name: sprint.name }), [sprint.id, 'Abgeschlossen'])

  const finished = sprint.status === 'Abgeschlossen' || sprint.status === 'Abgebrochen'

  let primaryAction: ReactNode = null
  if (sprint.status === 'Geplant') {
    primaryAction = (
      <Button variant={startVariant} size={size} icon={<Play />} onClick={() => activate()} loading={busy}>
        {t('sprintActions.start')}
      </Button>
    )
  } else if (sprint.status === 'Aktiv') {
    primaryAction = (
      <Button variant="primary" size={size} icon={<CheckCircle2 />} onClick={complete} loading={busy}>
        {t('sprintActions.complete')}
      </Button>
    )
  } else if (finished && reopenAsButton) {
    primaryAction = (
      <Button variant="secondary" size={size} icon={<RotateCcw />} onClick={() => activate(true)} loading={busy}>
        {t('sprintActions.reopen')}
      </Button>
    )
  }

  const menuItems: DropdownItem[] = []
  if (sprint.status === 'Aktiv') {
    menuItems.push({ label: t('sprintActions.cancelTitle'), icon: <XCircle />, onClick: () => setConfirmCancel(true), disabled: busy })
  }
  if (finished && !reopenAsButton) {
    menuItems.push({ label: t('sprintActions.reopen'), icon: <RotateCcw />, onClick: () => activate(true), disabled: busy })
  }

  const dialogs = (
    <>
      <Modal
        isOpen={!!conflict}
        onClose={() => setConflict(null)}
        title={t('sprintActions.conflictTitle')}
        icon={<AlertTriangle />}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConflict(null)}>{t('common.cancel')}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                changeStatus(t('sprintActions.started', { name: sprint.name }), [sprint.id, 'Aktiv'])
                setConflict(null)
              }}
            >
              {t('sprintActions.startParallel')}
            </Button>
            <Button
              variant="primary"
              icon={<CheckCircle2 />}
              data-autofocus
              onClick={() => {
                if (conflict) {
                  changeStatus(
                    t('sprintActions.switched', { active: conflict.name, name: sprint.name }),
                    [conflict.id, 'Abgeschlossen'],
                    [sprint.id, 'Aktiv'],
                  )
                }
                setConflict(null)
              }}
            >
              {t('sprintActions.completeAndStart', { active: conflict?.name })}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
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
        onConfirm={async () => {
          const ok = await changeStatus(t('sprintActions.cancelled', { name: sprint.name }), [sprint.id, 'Abgebrochen'])
          if (!ok) throw new Error('cancel failed')
        }}
        title={t('sprintActions.cancelTitle')}
        message={t('sprintActions.cancelConfirm', { name: sprint.name })}
        confirmLabel={t('sprintActions.cancelTitle')}
      />
    </>
  )

  return { busy, primaryAction, menuItems, dialogs }
}

export default useSprintStatusActions
