import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Compass, ArrowLeft } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('notFound.title'))
  return (
    <div className="flex h-full items-center justify-center p-6 animate-fade-in">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/70 dark:from-slate-800 dark:to-slate-900 dark:text-slate-500 dark:ring-slate-700/60">
          <Compass className="h-8 w-8" />
        </div>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('notFound.message')}</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('notFound.backToDashboard')}
        </Link>
      </div>
    </div>
  )
}
