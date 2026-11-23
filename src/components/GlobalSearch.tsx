import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Users, Bug, CalendarClock, Map, Zap, Package, MessageSquare,
  Star, Activity, Globe, Monitor, RefreshCw, Ticket, Archive, CornerDownLeft, ArrowRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { searchApi, type SearchHit } from '@/api/client'
import { useNavGroups } from '@/components/layout/navItems'
import Spinner from '@/components/ui/Spinner'

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  member:          Users,
  knownError:      Bug,
  meeting:         CalendarClock,
  topic:           MessageSquare,
  ticket:          Ticket,
  roadmapFeature:  Map,
  roadmapTicket:   Map,
  roadmapEndpoint: Globe,
  roadmapScreen:   Monitor,
  sprint:          Zap,
  skill:           Star,
  retro:           RefreshCw,
  retroItem:       RefreshCw,
  pulseCheck:      Activity,
  software:        Package,
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: Props) {
  const { t }    = useTranslation()
  const navigate = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchHit[]>([])
  const [loading,   setLoading]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const navGroups = useNavGroups()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const data = await searchApi.search(q)
      setResults(data)
      setActiveIdx(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 220)
    return () => clearTimeout(debounceRef.current)
  }, [query, doSearch])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Page shortcuts (command-palette style): all pages when empty, filtered when typing
  const q = query.trim().toLowerCase()
  const pageHits = navGroups
    .flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })))
    .filter((p) => !q || p.label.toLowerCase().includes(q) || p.to.slice(1).includes(q))
    .slice(0, q ? 4 : 20)

  type Entry =
    | { kind: 'page'; key: string; to: string; label: string; group: string; icon: React.ComponentType<{ className?: string }> }
    | { kind: 'hit'; key: string; hit: SearchHit }

  const entries: Entry[] = [
    ...pageHits.map((p) => ({ kind: 'page' as const, key: `page-${p.to}`, to: p.to, label: p.label, group: p.group, icon: p.icon })),
    ...results.map((hit) => ({ kind: 'hit' as const, key: `${hit.type}-${hit.id}`, hit })),
  ]

  // Keep active index in range when the list changes
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(entries.length - 1, 0)))
  }, [entries.length])

  function handleSelect(entry: Entry) {
    navigate(entry.kind === 'page' ? entry.to : entry.hit.url)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, entries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (entries[activeIdx]) handleSelect(entries[activeIdx])
    }
  }

  if (!open) return null

  const firstHitIdx = pageHits.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in dark:bg-slate-950/70"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.placeholder')}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-popover animate-scale-in dark:border-slate-700/80 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Search input ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.typeToSearch')}
            className="h-14 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={entries.length > 0}
            aria-controls="global-search-list"
            aria-activedescendant={entries[activeIdx] ? `gs-${activeIdx}` : undefined}
          />
          {loading && <Spinner className="h-4 w-4" />}
          <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
        </div>

        {/* ── Results list ─────────────────────────────────────────────────── */}
        <div ref={listRef} id="global-search-list" role="listbox" className="max-h-[min(28rem,60vh)] overflow-y-auto scrollbar-thin p-2">
          {entries.map((entry, idx) => {
            const active = idx === activeIdx
            const header =
              idx === 0 && entry.kind === 'page' ? t('search.pages')
              : idx === firstHitIdx && entry.kind === 'hit' ? t('search.results')
              : null
            const Icon = entry.kind === 'page' ? entry.icon : (TYPE_ICON[entry.hit.type] ?? Search)
            return (
              <div key={entry.key}>
                {header && <p className={`px-2.5 pb-1.5 section-label ${idx === 0 ? 'pt-1' : 'pt-3'}`}>{header}</p>}
                <button
                  id={`gs-${idx}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={() => handleSelect(entry)}
                  onMouseMove={() => { if (!active) setActiveIdx(idx) }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    active ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                    active
                      ? 'bg-indigo-100 text-indigo-600 ring-indigo-500/10 dark:bg-indigo-500/20 dark:text-indigo-300'
                      : 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {entry.kind === 'page' ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          <Highlight text={entry.label} query={query} />
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{entry.group}</span>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${entry.hit.isArchived ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                          <Highlight text={entry.hit.title} query={query} />
                        </p>
                        {entry.hit.subtitle && (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{entry.hit.subtitle}</p>
                        )}
                      </div>
                      {entry.hit.isArchived && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          <Archive className="h-3 w-3" />
                          {t('search.archived')}
                        </span>
                      )}
                      <span className="ml-2 shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {t(`search.type.${entry.hit.type}`, entry.hit.type)}
                      </span>
                    </>
                  )}
                  {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                </button>
              </div>
            )
          })}

          {/* ── Empty / hint states ───────────────────────────────────────── */}
          {q.length >= 2 && !loading && results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">{t('search.noResults')}</p>
          )}
          {q.length > 0 && q.length < 2 && pageHits.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">{t('search.hint')}</p>
          )}
        </div>

        {/* ── Footer hint ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> {t('search.navigate')}</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> {t('search.open')}</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">Esc</kbd> {t('search.close')}</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><ArrowRight className="h-3 w-3" /> {t('search.hint')}</span>
        </div>
      </div>
    </div>
  )
}
