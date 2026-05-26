import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { getStoredToken } from '@/store/auth'

const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : import.meta.env.BASE_URL.replace(/\/$/, '') + '/api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordDialog({ isOpen, onClose }: Props) {
  const { t } = useTranslation()

  const [currentPassword, setCurrentPassword]     = useState('')
  const [newPassword, setNewPassword]               = useState('')
  const [confirmPassword, setConfirmPassword]       = useState('')
  const [showCurrent, setShowCurrent]               = useState(false)
  const [showNew, setShowNew]                       = useState(false)
  const [showConfirm, setShowConfirm]               = useState(false)
  const [loading, setLoading]                       = useState(false)
  const [error, setError]                           = useState<string | null>(null)
  const [success, setSuccess]                       = useState(false)

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
    setError(null)
    setSuccess(false)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError(t('changePassword.errorMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePassword.errorMismatch'))
      return
    }

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

      setSuccess(true)
    } catch {
      setError(t('changePassword.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 ' +
    'text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('changePassword.title')}
      size="sm"
      footer={
        success ? (
          <Button variant="primary" onClick={handleClose}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="change-password-form"
              loading={loading}
              icon={<KeyRound className="w-4 h-4" />}
            >
              {t('changePassword.submit')}
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {t('changePassword.successTitle')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('changePassword.successMessage')}
          </p>
        </div>
      ) : (
        <form id="change-password-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Current password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('changePassword.currentPassword')}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className={inputCls}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('changePassword.newPassword')}
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className={inputCls}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">{t('changePassword.minLengthHint')}</p>
          </div>

          {/* Confirm new password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('changePassword.confirmPassword')}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className={inputCls}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
