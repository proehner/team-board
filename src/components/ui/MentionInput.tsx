import { useRef, useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { TeamMember } from '@/types'
import { useAuthStore } from '@/store/auth'
import { getMemberDisplayNames } from '@/utils/members'
import Avatar from './Avatar'

interface Props {
  value:       string
  onChange:    (value: string) => void
  onKeyDown?:  (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  members:     TeamMember[]
  placeholder?: string
  rows?:        number
  /** Classes for the textarea. Defaults to the standard `form-textarea` look. */
  className?:   string
  id?:          string
  autoFocus?:   boolean
  disabled?:    boolean
}

/** Textarea with @mention autocomplete dropdown. */
export default function MentionInput({
  value, onChange, onKeyDown, members, placeholder, rows = 2, className, id, autoFocus, disabled,
}: Props) {
  const { t } = useTranslation()
  const listId       = useId()
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [atIndex,   setAtIndex]   = useState(-1)
  const [activeIdx, setActiveIdx] = useState(0)

  const teams = useAuthStore((s) => s.teams)
  const memberDisplayNames = getMemberDisplayNames(members, teams)

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

  const showList = open && filtered.length > 0

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Escape') {
        // Close only the popover — don't let a surrounding modal close as well
        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        setOpen(false)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        selectMember(filtered[Math.min(activeIdx, filtered.length - 1)])
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
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList ? `${listId}-${activeIdx}` : undefined}
        className={className ?? 'form-textarea resize-none leading-relaxed'}
      />

      {showList && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1.5 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-popover animate-slide-up dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-2.5 pb-1 pt-1.5 section-label">{t('mentionInput.title')}</p>
          <ul id={listId} role="listbox" aria-label={t('mentionInput.title')}>
            {filtered.map((m, i) => {
              const active = i === activeIdx
              return (
                <li
                  key={m.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active}
                  // Use onMouseDown + preventDefault to keep textarea focus
                  onMouseDown={(e) => { e.preventDefault(); selectMember(m) }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Avatar name={m.name} color={m.avatarColor ?? '#6366f1'} size="xs" />
                  <span className="truncate font-medium">{memberDisplayNames.get(m.id) ?? m.name}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-1 flex items-center gap-1.5 border-t border-slate-100 px-2.5 pb-1 pt-1.5 text-2xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> {t('mentionInput.navigate')}
            <kbd className="kbd ml-1.5">Enter</kbd> {t('mentionInput.select')}
          </p>
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
      <span
        key={match.index}
        className="rounded bg-indigo-50 px-1 py-px font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
      >
        @{match[1]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(<span key={last}>{content.slice(last)}</span>)
  return <span className="whitespace-pre-wrap">{parts}</span>
}
