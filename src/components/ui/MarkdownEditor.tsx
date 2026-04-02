import { useRef, useCallback } from 'react'
import {
  Bold, Italic, List, ListOrdered, Code, Heading2,
  Minus, Quote,
} from 'lucide-react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

interface ToolbarAction {
  icon: React.ReactNode
  title: string
  action: (selected: string, before: string, after: string) => { prefix: string; suffix: string; block?: boolean; placeholder?: string }
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: <Bold className="w-3.5 h-3.5" />,
    title: 'Fett',
    action: () => ({ prefix: '**', suffix: '**', placeholder: 'Fetter Text' }),
  },
  {
    icon: <Italic className="w-3.5 h-3.5" />,
    title: 'Kursiv',
    action: () => ({ prefix: '_', suffix: '_', placeholder: 'Kursiver Text' }),
  },
  {
    icon: <Code className="w-3.5 h-3.5" />,
    title: 'Code',
    action: (selected) => {
      if (selected.includes('\n')) {
        return { prefix: '```\n', suffix: '\n```', placeholder: 'Code' }
      }
      return { prefix: '`', suffix: '`', placeholder: 'code' }
    },
  },
  {
    icon: <Heading2 className="w-3.5 h-3.5" />,
    title: 'Überschrift',
    action: () => ({ prefix: '## ', suffix: '', block: true, placeholder: 'Überschrift' }),
  },
  {
    icon: <List className="w-3.5 h-3.5" />,
    title: 'Aufzählung',
    action: () => ({ prefix: '- ', suffix: '', block: true, placeholder: 'Listenpunkt' }),
  },
  {
    icon: <ListOrdered className="w-3.5 h-3.5" />,
    title: 'Nummerierte Liste',
    action: () => ({ prefix: '1. ', suffix: '', block: true, placeholder: 'Listenpunkt' }),
  },
  {
    icon: <Quote className="w-3.5 h-3.5" />,
    title: 'Zitat',
    action: () => ({ prefix: '> ', suffix: '', block: true, placeholder: 'Zitat' }),
  },
  {
    icon: <Minus className="w-3.5 h-3.5" />,
    title: 'Trennlinie',
    action: () => ({ prefix: '\n---\n', suffix: '', block: false, placeholder: '' }),
  },
]

export default function MarkdownEditor({
  value, onChange, placeholder, rows = 8, className = '',
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const applyFormat = useCallback((action: ToolbarAction) => {
    const el = ref.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    const { prefix, suffix, block, placeholder: ph = '' } = action.action(selected, value.slice(0, start), value.slice(end))
    const insertion = selected || ph

    let newText: string
    let newCursorStart: number
    let newCursorEnd: number

    if (block && !selected) {
      // For block elements: ensure we're on a new line
      const before = value.slice(0, start)
      const after = value.slice(end)
      const needsNewline = before.length > 0 && !before.endsWith('\n')
      const newPrefix = needsNewline ? '\n' + prefix : prefix
      newText = before + newPrefix + insertion + suffix + after
      newCursorStart = start + newPrefix.length
      newCursorEnd = newCursorStart + insertion.length
    } else {
      newText = value.slice(0, start) + prefix + insertion + suffix + value.slice(end)
      newCursorStart = start + prefix.length
      newCursorEnd = newCursorStart + insertion.length
    }

    onChange(newText)

    // Restore selection after React re-render
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursorStart, newCursorEnd)
    })
  }, [value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = ref.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const newText = value.slice(0, start) + '  ' + value.slice(end)
      onChange(newText)
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 2, start + 2)
      })
    }

    // Ctrl/Cmd + B → Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      applyFormat(TOOLBAR_ACTIONS[0])
    }
    // Ctrl/Cmd + I → Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      applyFormat(TOOLBAR_ACTIONS[1])
    }
  }, [value, onChange, applyFormat])

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600 flex-wrap">
        {TOOLBAR_ACTIONS.map((action, i) => (
          <button
            key={i}
            type="button"
            title={action.title}
            onMouseDown={(e) => {
              e.preventDefault() // Don't lose textarea focus
              applyFormat(action)
            }}
            className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {action.icon}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 dark:text-slate-500 pr-1 hidden sm:block">
          Markdown
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none resize-y font-mono leading-relaxed"
        style={{ minHeight: `${rows * 1.6}rem` }}
      />
    </div>
  )
}
