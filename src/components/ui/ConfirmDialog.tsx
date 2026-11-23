import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  /** May return a promise — the dialog then shows a loading state and closes when it resolves. */
  onConfirm: () => unknown
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel, cancelLabel, variant = 'danger',
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    try {
      const res = onConfirm()
      if (res && typeof (res as Promise<unknown>).then === 'function') {
        setBusy(true)
        await res
      }
      onClose()
    } catch {
      // Caller is responsible for surfacing the error (e.g. via toast); keep dialog open.
    } finally {
      setBusy(false)
    }
  }

  const Icon = variant === 'danger' ? Trash2 : AlertTriangle

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      icon={<Icon />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel ?? t('confirmDialog.cancel')}</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={busy}
            data-autofocus
          >
            {confirmLabel ?? t('confirmDialog.confirm')}
          </Button>
        </>
      }
    >
      <div className={`text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${variant === 'danger' ? '' : ''}`}>
        {message}
      </div>
    </Modal>
  )
}
