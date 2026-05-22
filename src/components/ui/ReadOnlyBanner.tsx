import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ReadOnlyBannerProps {
  className?: string
  note?: string
}

export default function ReadOnlyBanner({ className = '', note }: ReadOnlyBannerProps) {
  const { t } = useTranslation()
  return (
    <div className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm ${className}`}>
      <Eye className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        {t('common.readOnlyMode')}
        {note && <span className="ml-1 opacity-75">{note}</span>}
      </span>
    </div>
  )
}
