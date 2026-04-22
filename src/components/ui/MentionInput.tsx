import { useRef, useState, useEffect } from 'react'
import type { TeamMember } from '@/types'

interface Props {
  value:       string
  onChange:    (value: string) => void
  onKeyDown?:  (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  members:     TeamMember[]
  placeholder?: string
  rows?:        number
  className?:   string
}

/** Textarea with @mention autocomplete dropdown. */
export default function MentionInput({ value, onChange, onKeyDown, members, placeholder, rows = 2, className }: Props) {
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [atIndex,   setAtIndex]   = useState(-1)
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = members
    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)

  // ── Detect mention context from text up to cursor ───────────────────────────
  function detectMention(text: string, cursor: number) {
    const before = text.slice(0, cursor)
    // Match last @ followed by non-whitespace, non-@ chars (the current query being typed)
    const match = before.match(/@([^\s@]*)$/)
    if (match) {
      return { found: true, start: before.lastIndexOf('@'), query: match[1] }
    }
    return { found: false, start: -1, query: '' }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal  = e.target.value
    const cursor  = e.target.selectionStart ?? newVal.length
    const { found, start, query: q } = detectMention(newVal, cursor)
    if (found && members.length > 0) {
      setAtIndex(start)
      setQuery(q)
      setOpen(true)
      setActiveIdx(0)
    } else {
      setOpen(false)
    }
    onChange(newVal)
  }

  function selectMember(member: TeamMember) {
    const before  = value.slice(0, atIndex)
    const after   = value.slice(atIndex + 1 + query.length)
    const newVal  = before + '@' + member.name + ' ' + after
    const newCursor = before.length + 1 + member.name.length + 1
    onChange(newVal)
    setOpen(false)
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursor, newCursor)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        selectMember(filtered[activeIdx])
        return
      }
    }
    onKeyDown?.(e)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />

      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              // Use onMouseDown + preventDefault to keep textarea focus
              onMouseDown={(e) => { e.preventDefault(); selectMember(m) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                i === activeIdx
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                style={{ backgroundColor: m.avatarColor ?? '#6366f1' }}
              >
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-medium">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mention renderer ─────────────────────────────────────────────────────────

/**
 * Renders comment text with @MemberName tokens highlighted.
 * Member names with spaces are matched by building a regex from known names.
 */
export function renderWithMentions(content: string, members: TeamMember[]): React.ReactNode {
  if (members.length === 0) return <span className="whitespace-pre-wrap">{content}</span>

  // Sort by name length descending so longer names match first (e.g. "John Smith" before "John")
  const sorted   = [...members].sort((a, b) => b.name.length - a.name.length)
  const escaped  = sorted.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex    = new RegExp(`@(${escaped.join('|')})(?=\\s|$)`, 'g')

  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) {
      parts.push(<span key={last}>{content.slice(last, match.index)}</span>)
    }
    parts.push(
      <span key={match.index} className="text-indigo-600 dark:text-indigo-400 font-semibold">
        @{match[1]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(<span key={last}>{content.slice(last)}</span>)
  return <span className="whitespace-pre-wrap">{parts}</span>
}
