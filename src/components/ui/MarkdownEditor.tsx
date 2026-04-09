import { useRef, useCallback } from 'react'
import {
  Bold, Italic, List, ListOrdered, Code, Heading2,
  Minus, Quote, Image, Link, Loader2,
} from 'lucide-react'
import { useState } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  /** Called with a File; should upload it and return the stored filename (not full URL). */
  onImageUpload?: (file: File) => Promise<string>
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
  {
    icon: <Link className="w-3.5 h-3.5" />,
    title: 'Link',
    action: (selected) => ({
      prefix: '[',
      suffix: `](https://)`,
      placeholder: selected || 'Linktext',
    }),
  },
]

export default function MarkdownEditor({
  value, onChange, placeholder, rows = 8, className = '', onImageUpload,
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

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

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursorStart, newCursorEnd)
    })
  }, [value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      applyFormat(TOOLBAR_ACTIONS[0])
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      applyFormat(TOOLBAR_ACTIONS[1])
    }
  }, [value, onChange, applyFormat])

  const insertImageMarkdown = useCallback((filename: string, altText: string) => {
    const el = ref.current
    const pos = el ? el.selectionStart : value.length
    const md = `![${altText}](upload://${filename})`
    const before = value.slice(0, pos)
    const after = value.slice(pos)
    const needsNewline = before.length > 0 && !before.endsWith('\n')
    const newText = before + (needsNewline ? '\n' : '') + md + after
    onChange(newText)
    requestAnimationFrame(() => {
      el?.focus()
    })
  }, [value, onChange])

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onImageUpload) return
    e.target.value = '' // reset so same file can be re-selected
    setUploading(true)
    try {
      const filename = await onImageUpload(file)
      insertImageMarkdown(filename, file.name.replace(/\.[^.]+$/, ''))
    } catch {
      // silently ignore; caller handles errors
    } finally {
      setUploading(false)
    }
  }, [onImageUpload, insertImageMarkdown])

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
              e.preventDefault()
              applyFormat(action)
            }}
            className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {action.icon}
          </button>
        ))}

        {/* Image / GIF upload button (only shown when onImageUpload is provided) */}
        {onImageUpload && (
          <>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
            <button
              type="button"
              title="Bild / GIF einfügen"
              disabled={uploading}
              onMouseDown={(e) => {
                e.preventDefault()
                fileInputRef.current?.click()
              }}
              className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Image className="w-3.5 h-3.5" />
              }
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.gif"
              className="hidden"
              onChange={handleImageFileChange}
            />
          </>
        )}

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
