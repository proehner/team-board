import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, AlertTriangle, Check } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import Field from './Field'
import PasswordInput, { PasswordStrength } from '@/components/ui/PasswordInput'
import { getStoredToken } from '@/store/auth'
import { toast } from '@/store/toast'

const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : import.meta.env.BASE_URL.replace(/\/$/, '') + '/api'

const MIN_LENGTH = 6

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordDialog({ isOpen, onClose }: Props) {
  const { t } = useTranslation()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  // Only show inline validation after the user tried to submit or left the field
  const [touchedNew, setTouchedNew]           = useState(false)
  const [touchedConfirm, setTouchedConfirm]   = useState(false)

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setLoading(false)
    setTouchedNew(false)
    setTouchedConfirm(false)
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  const tooShort    = newPassword.length > 0 && newPassword.length < MIN_LENGTH
  const mismatch    = confirmPassword.length > 0 && newPassword !== confirmPassword
  const matches     = confirmPassword.length > 0 && newPassword === confirmPassword && !tooShort
  const sameAsOld   = newPassword.length > 0 && newPassword === currentPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setTouchedNew(true)
    setTouchedConfirm(true)

    // Client-side validation errors are shown inline at the fields
    if (newPassword.length < MIN_LENGTH || newPassword !== confirmPassword) return

    setLoading(true)
    try {
      const token = getStoredToken()
      const res = await fetch(`${BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? t('changePassword.errorGeneric'))
        return
      }

      toast.success(t('changePassword.successTitle'), { description: t('changePassword.successMessage') })
      reset()
      onClose()
    } catch {
      setError(t('changePassword.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      dismissible={!loading}
      title={t('changePassword.title')}
      description={t('changePassword.description')}
      icon={<KeyRound />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="change-password-form"
            loading={loading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            {t('changePassword.submit')}
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label={t('changePassword.currentPassword')} htmlFor="cp-current" required>
          <PasswordInput
            id="cp-current"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            disabled={loading}
          />
        </Field>

        <Field
          label={t('changePassword.newPassword')}
          htmlFor="cp-new"
          required
          error={touchedNew && tooShort ? t('changePassword.errorMinLength') : undefined}
          hint={!newPassword ? t('changePassword.minLengthHint') : sameAsOld ? t('changePassword.sameAsOldHint') : undefined}
        >
          <PasswordInput
            id="cp-new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onBlur={() => setTouchedNew(true)}
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            disabled={loading}
            aria-invalid={touchedNew && tooShort ? true : undefined}
          />
          <PasswordStrength password={newPassword} minLength={MIN_LENGTH} />
        </Field>

        <Field
          label={t('changePassword.confirmPassword')}
          htmlFor="cp-confirm"
          required
          error={touchedConfirm && mismatch ? t('changePassword.errorMismatch') : undefined}
        >
          <PasswordInput
            id="cp-confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouchedConfirm(true)}
            autoComplete="new-password"
            required
            disabled={loading}
            aria-invalid={touchedConfirm && mismatch ? true : undefined}
          />
          {matches && (
            <p className="form-hint flex items-center gap-1 !text-emerald-600 dark:!text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {t('changePassword.matches')}
            </p>
          )}
        </Field>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  )
}
