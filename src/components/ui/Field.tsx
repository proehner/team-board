import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  /** Shows "(optional)" next to the label */
  optional?: boolean
  children: ReactNode
  className?: string
}

/** Label + control + hint/error wrapper for forms. */
export default function Field({ label, htmlFor, hint, error, required, optional, children, className = '' }: FieldProps) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="form-label">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
          {optional && <span className="ml-1.5 text-xs font-normal text-slate-400">({t('common.optional')})</span>}
        </label>
      )}
      {children}
      {error ? <p className="form-error">{error}</p> : hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  )
}
