import { useRef, useState, useCallback, type ReactNode, type ReactElement } from 'react'
import { Check } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export type DropdownItem =
  | {
      type?: 'item'
      label: ReactNode
      icon?: ReactNode
      onClick: () => void
      danger?: boolean
      disabled?: boolean
      checked?: boolean
      /** Right-aligned hint, e.g. keyboard shortcut */
      hint?: ReactNode
    }
  | { type: 'divider' }
  | { type: 'label'; label: ReactNode }

interface DropdownMenuProps {
  /** Render-prop for the trigger. Spread `props` onto your button. */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactElement
  /** `false` / `null` / `undefined` entries are skipped — handy for conditional items */
  items: (DropdownItem | false | null | undefined)[]
  align?: 'start' | 'end'
  /** Open upwards (e.g. in footers) */
  side?: 'bottom' | 'top'
  width?: string
  className?: string
}

/**
 * Lightweight accessible popover menu. Closes on outside click, Escape and item selection.
 *
 *   <DropdownMenu
 *     trigger={(p) => <IconButton {...p} icon={<MoreHorizontal/>} label={t('common.moreActions')} />}
 *     items={[{ label: t('common.edit'), icon: <Pencil/>, onClick: edit }, { type: 'divider' }, { label: t('common.delete'), danger: true, onClick: del }]}
 *   />
 */
export default function DropdownMenu({ trigger, items, align = 'end', side = 'bottom', width = 'w-56', className = '' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(wrapRef, close, open)

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role=menuitem]:not([disabled])') ?? [])
    const idx = els.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (idx + 1) % els.length : (idx - 1 + els.length) % els.length
    els[next]?.focus()
  }

  return (
    <div ref={wrapRef} className={`relative inline-flex ${className}`}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKey}
          className={`absolute z-50 ${width} ${align === 'end' ? 'right-0' : 'left-0'} ${side === 'bottom' ? 'top-full mt-1.5 origin-top' : 'bottom-full mb-1.5 origin-bottom'} overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-popover animate-slide-down dark:border-slate-700 dark:bg-slate-900`}
        >
          {items.map((it, i) => {
            if (!it) return null
            if (it.type === 'divider') return <div key={i} className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            if (it.type === 'label') return <div key={i} className="px-2.5 pb-1 pt-2 section-label">{it.label}</div>
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick() }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 ${
                  it.danger
                    ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10'
                    : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800'
                } focus:outline-none`}
              >
                {it.icon && <span className={it.danger ? '' : 'text-slate-400 dark:text-slate-500'}>{it.icon}</span>}
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-slate-400">{it.hint}</span>}
                {it.checked && <Check className="text-indigo-600 dark:text-indigo-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
