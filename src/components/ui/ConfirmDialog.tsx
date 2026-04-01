import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel, variant = 'danger',
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('confirmDialog.cancel')}</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel ?? t('confirmDialog.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={`shrink-0 mt-0.5 ${variant === 'danger' ? 'text-red-500' : 'text-amber-500'}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
      </div>
    </Modal>
  )
}
