import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import IconButton from '@/components/ui/IconButton'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Password field with show/hide toggle. Uses the global `.form-input` styling. */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ className = '', ...rest }, ref) => {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={`form-input pr-10 ${className}`} {...rest} />
      <IconButton
        size="xs"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        icon={show ? <EyeOff /> : <Eye />}
        label={show ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
        onClick={() => setShow((v) => !v)}
        disabled={rest.disabled}
      />
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
export default PasswordInput

// ─── Strength meter ───────────────────────────────────────────────────────────

/** 0 = empty, 1 = too short, 2 = weak, 3 = medium, 4 = strong */
export function passwordScore(pw: string, minLength = 6): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0
  if (pw.length < minLength) return 1
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  const points = (pw.length >= 10 ? 1 : 0) + (pw.length >= 14 ? 1 : 0) + (variety >= 2 ? 1 : 0) + (variety >= 3 ? 1 : 0)
  if (points <= 1) return 2
  if (points <= 3) return 3
  return 4
}

const STRENGTH = [
  { key: '',         bar: '',               text: '' },
  { key: 'tooShort', bar: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  { key: 'weak',     bar: 'bg-orange-500',  text: 'text-orange-600 dark:text-orange-400' },
  { key: 'medium',   bar: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400' },
  { key: 'strong',   bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
] as const

/** 4-segment strength bar with label. Renders nothing for an empty password. */
export function PasswordStrength({ password, minLength = 6 }: { password: string; minLength?: number }) {
  const { t } = useTranslation()
  const score = passwordScore(password, minLength)
  if (score === 0) return null
  const s = STRENGTH[score]
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? s.bar : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>
      <span className={`shrink-0 text-xs font-medium ${s.text}`}>{t(`changePassword.strength.${s.key}`)}</span>
    </div>
  )
}
