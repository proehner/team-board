import { useEffect, useRef, type ReactNode, type ComponentType, type KeyboardEvent } from 'react'

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  icon?: ComponentType<{ className?: string }>
  /** Optional counter badge */
  count?: number
  disabled?: boolean
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /**
   * underline – page-level section tabs (default)
   * segmented – compact view switcher (List / Grid / Timeline …)
   * pills     – filter-like tabs
   */
  variant?: 'underline' | 'segmented' | 'pills'
  size?: 'sm' | 'md'
  className?: string
  /** Stretch segmented control to full width */
  fullWidth?: boolean
  'aria-label'?: string
}

/** Accessible tabs with arrow-key navigation. Purely presentational — render the panel yourself. */
export default function Tabs<T extends string>({
  items, value, onChange, variant = 'underline', size = 'md', className = '', fullWidth, ...rest
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Keep the active tab visible in horizontally scrolling tab bars (mobile)
  useEffect(() => {
    const idx = items.findIndex((it) => it.value === value)
    const el = refs.current[idx]
    const bar = el?.parentElement
    if (!el || !bar || bar.scrollWidth <= bar.clientWidth) return
    const left = el.offsetLeft - bar.offsetLeft
    if (left < bar.scrollLeft || left + el.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - 16, behavior: 'smooth' })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
    const pos = enabled.indexOf(idx)
    let next = idx
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length]
    if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length]
    if (e.key === 'Home') next = enabled[0]
    if (e.key === 'End') next = enabled[enabled.length - 1]
    refs.current[next]?.focus()
    onChange(items[next].value)
  }

  const sm = size === 'sm'

  const wrapCls = {
    underline: 'flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none',
    segmented: `${fullWidth ? 'flex w-full' : 'inline-flex'} items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-800/70 dark:ring-slate-700/50 overflow-x-auto scrollbar-none`,
    pills:     'flex flex-wrap items-center gap-1.5',
  }[variant]

  return (
    <div role="tablist" className={`${wrapCls} ${className}`} aria-label={rest['aria-label']}>
      {items.map((it, idx) => {
        const active = it.value === value
        const Icon = it.icon
        const base = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sm ? 'text-xs' : 'text-sm'}`
        const cls = {
          underline: `relative -mb-px border-b-2 px-3 ${sm ? 'py-2' : 'py-2.5'} ${
            active
              ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
          }`,
          segmented: `${fullWidth ? 'flex-1' : ''} rounded-md ${sm ? 'px-2.5 py-1' : 'px-3 py-1.5'} ${
            active
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-700 dark:text-white dark:ring-white/5'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`,
          pills: `rounded-full ${sm ? 'px-2.5 py-1' : 'px-3 py-1.5'} ring-1 ring-inset ${
            active
              ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm dark:bg-indigo-500 dark:ring-indigo-500'
              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
          }`,
        }[variant]

        const countCls = active
          ? variant === 'pills'
            ? 'bg-white/20 text-white'
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'

        return (
          <button
            key={it.value}
            ref={(el) => { refs.current[idx] = el }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={`${base} ${cls}`}
          >
            {Icon && <Icon className={sm ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
            {it.label}
            {typeof it.count === 'number' && (
              <span className={`ml-0.5 min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-2xs font-semibold tabular-nums ${countCls}`}>
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
