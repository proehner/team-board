import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToastStore, type ToastItem, type ToastTone } from '@/store/toast'

const toneIcon: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
}

const toneIconCls: Record<ToastTone, string> = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  info:    'text-indigo-500',
  warning: 'text-amber-500',
}

const toneBarCls: Record<ToastTone, string> = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  info:    'bg-indigo-500',
  warning: 'bg-amber-500',
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const { t } = useTranslation()
  const dismiss = useToastStore((s) => s.dismiss)
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (!toast.duration || paused) return
    startedAt.current = Date.now()
    const timer = setTimeout(() => dismiss(toast.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, toast.duration, toast.id, dismiss])

  const Icon = toneIcon[toast.tone]

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-full sm:w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-popover animate-toast-in dark:border-slate-700/80 dark:bg-slate-900/95"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${toneBarCls[toast.tone]}`} aria-hidden />
      <div className="flex items-start gap-3 py-3 pl-4 pr-3">
        <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${toneIconCls[toast.tone]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 break-words">{toast.description}</p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => { toast.action!.onClick(); dismiss(toast.id) }}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          aria-label={t('common.close')}
          className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** Mount once at the app root. Renders toasts pushed via `toast.*()` from '@/store/toast'. */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      {toasts.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>,
    document.body,
  )
}
