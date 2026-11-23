import { Check, Monitor } from 'lucide-react'

/** Multi-select chips for affected software. */
export default function SoftwarePicker({
  software, selected, onToggle,
}: {
  software: { id: string; name: string; version?: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {software.map((sw) => {
        const on = selected.includes(sw.id)
        return (
          <button
            key={sw.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(sw.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
              on
                ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/40'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {on ? <Check className="h-3 w-3" /> : <Monitor className="h-3 w-3 text-slate-400" />}
            {sw.name}
            {sw.version && <span className="opacity-60">v{sw.version}</span>}
          </button>
        )
      })}
    </div>
  )
}
