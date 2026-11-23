import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  /** Optional line below the title */
  description?: ReactNode
  /** Optional icon rendered left of the title */
  icon?: ReactNode
  children: ReactNode
  size?: ModalSize
  footer?: ReactNode
  /** Removes body padding (e.g. for full-bleed lists) */
  bodyClassName?: string
  /** Prevent closing via backdrop click (e.g. forms with unsaved input) */
  dismissible?: boolean
  /** 'auto' (default): first [data-autofocus] or first field · 'panel': focus the dialog itself (list-style dialogs) */
  initialFocus?: 'auto' | 'panel'
}

const sizeClasses: Record<ModalSize, string> = {
  sm:  'sm:max-w-md',
  md:  'sm:max-w-lg',
  lg:  'sm:max-w-2xl',
  xl:  'sm:max-w-4xl',
  '2xl': 'sm:max-w-6xl',
}

// Track nested modals so that Escape and body scroll locking only affect the top-most one.
const openStack: string[] = []

export default function Modal({
  isOpen, onClose, title, description, icon, children, size = 'md', footer, bodyClassName, dismissible = true, initialFocus = 'auto',
}: ModalProps) {
  const { t } = useTranslation()
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropPress = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Register in stack, lock scroll, restore focus on close
  useEffect(() => {
    if (!isOpen) return
    openStack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    // Initial focus: first autofocus element, else first field, else the panel itself
    requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const target =
        (initialFocus === 'panel' ? panel : null) ??
        panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ??
        panel.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]),textarea:not([disabled]),select:not([disabled])') ??
        panel
      target.focus({ preventScroll: true })
    })

    function onKey(e: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      // Simple focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      const idx = openStack.indexOf(id)
      if (idx !== -1) openStack.splice(idx, 1)
      if (openStack.length === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [isOpen, id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => { backdropPress.current = e.target === e.currentTarget }}
      onMouseUp={(e) => {
        // Only close when the press started AND ended on the backdrop (avoids closing on text-selection drags)
        if (dismissible && backdropPress.current && e.target === e.currentTarget) onClose()
        backdropPress.current = false
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in dark:bg-slate-950/70" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={`relative flex w-full ${sizeClasses[size]} max-h-[92vh] sm:max-h-[88vh] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-popover ring-1 ring-slate-900/5 outline-none animate-slide-up sm:animate-scale-in dark:bg-slate-900 dark:ring-white/10`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 [&_svg]:w-[18px] [&_svg]:h-[18px]">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={`${id}-title`} className="text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">{title}</h2>
            {description && (
              <div id={`${id}-desc`} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-1.5 -mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin ${bodyClassName ?? 'px-5 sm:px-6 py-5'}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-none sm:rounded-b-2xl dark:border-slate-800 dark:bg-slate-900/60">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
