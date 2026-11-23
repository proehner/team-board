import type { ReactNode, ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface PageHeaderProps {
  title: ReactNode
  /** Plain-text title used for the browser tab. Defaults to `title` if it is a string. */
  documentTitle?: string
  subtitle?: ReactNode
  /** Lucide icon component (not element), e.g. `icon={Zap}` */
  icon?: ComponentType<{ className?: string }>
  /** Elements rendered inline right after the title (badges, status…) */
  meta?: ReactNode
  /** Primary actions, right-aligned on desktop, wrapping below on mobile */
  actions?: ReactNode
  /** Back link shown above the title (detail pages) */
  back?: { to: string; label: string } | { onClick: () => void; label: string }
  /** Rendered below the header row — typically <Tabs/> or a filter toolbar */
  children?: ReactNode
  className?: string
}

/**
 * Unified page header. Also sets the browser tab title.
 *
 *   <PageHeader icon={Zap} title={t('sprints.title')} subtitle="19 Sprints" actions={<Button…/>} />
 */
export default function PageHeader({
  title, documentTitle, subtitle, icon: Icon, meta, actions, back, children, className = '',
}: PageHeaderProps) {
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : undefined))

  const backCls =
    'group mb-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'

  return (
    <header className={`mb-6 ${className}`}>
      {back && (
        'to' in back ? (
          <Link to={back.to} className={backCls}>
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} className={backCls}>
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </button>
        )
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon && (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/30 ring-1 ring-inset ring-white/10">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 break-words">
                {title}
              </h1>
              {meta}
            </div>
            {subtitle && (
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  )
}
