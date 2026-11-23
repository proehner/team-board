import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ReadOnlyBannerProps {
  className?: string
  note?: string
}

/** Calm notice shown on pages the user may view but not edit. */
export default function ReadOnlyBanner({ className = '', note }: ReadOnlyBannerProps) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-sm dark:border-amber-400/15 dark:bg-amber-400/[0.06] ${className}`}
    >
      <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
        <Eye className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 pt-0.5 leading-5 text-amber-900/80 dark:text-amber-200/80">
        <span className="font-semibold text-amber-900 dark:text-amber-200">{t('common.readOnlyMode')}</span>
        <span className="mx-1.5 text-amber-400 dark:text-amber-500/60" aria-hidden>·</span>
        <span>{note ?? t('readOnlyBanner.description')}</span>
      </p>
    </div>
  )
}
