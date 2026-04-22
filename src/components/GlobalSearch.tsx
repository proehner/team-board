import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Users, Bug, CalendarClock, Map, Zap, Package, MessageSquare,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { searchApi, type SearchHit } from '@/api/client'

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  member:         Users,
  knownError:     Bug,
  meeting:        CalendarClock,
  topic:          MessageSquare,
  roadmapFeature: Map,
  roadmapTicket:  Map,
  sprint:         Zap,
  software:       Package,
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

  function handleSelect(hit: SearchHit) {
    navigate(hit.url)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) handleSelect(results[activeIdx])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Search input ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-4.5 h-4.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <kbd className="hidden sm:inline text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>

        {/* ── Results list ─────────────────────────────────────────────────── */}
        {results.length > 0 && (
          <div ref={listRef} className="overflow-y-auto max-h-[26rem] py-1.5">
            {results.map((hit, idx) => {
              const Icon = TYPE_ICON[hit.type] ?? Search
              return (
                <button
                  key={`${hit.type}-${hit.id}`}
                  onMouseDown={() => handleSelect(hit)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    idx === activeIdx
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    idx === activeIdx
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      <Highlight text={hit.title} query={query} />
                    </p>
                    {hit.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{hit.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                    {t(`search.type.${hit.type}`, hit.type)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Empty / hint states ───────────────────────────────────────────── */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">{t('search.noResults')}</p>
        )}
        {query.length < 2 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">{t('search.hint')}</p>
        )}

        {/* ── Footer hint ───────────────────────────────────────────────────── */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">↑↓</kbd> {t('search.navigate')}</span>
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> {t('search.open')}</span>
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Esc</kbd> {t('search.close')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
