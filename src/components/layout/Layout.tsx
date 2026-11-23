import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Shield, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import GlobalSearch from '@/components/GlobalSearch'

const COLLAPSE_KEY = 'sidebar_collapsed'

export default function Layout() {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [collapsed,   setCollapsed]   = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const location  = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close mobile sidebar and reset scroll position on route change
  useEffect(() => {
    setSidebarOpen(false)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  // Escape closes overlays; Ctrl/Cmd+K toggles search; Ctrl/Cmd+B toggles sidebar
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return }
        setSidebarOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        const el = document.activeElement as HTMLElement | null
        const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (typing) return
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <a
        href="#main-content"
        onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus() }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        {t('sidebar.skipToContent')}
      </a>

      {/* ── Mobile overlay backdrop ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-out
          md:relative md:z-auto md:translate-x-0 md:flex md:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0 shadow-popover' : '-translate-x-full'}
        `}
      >
        {/* Mobile: always expanded. Desktop: collapsible. */}
        <div className="h-full md:hidden">
          <Sidebar onClose={() => setSidebarOpen(false)} onOpenSearch={() => { setSidebarOpen(false); setSearchOpen(true) }} />
        </div>
        <div className="hidden h-full md:block">
          <Sidebar
            onOpenSearch={() => setSearchOpen(true)}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
          />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/80">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label={t('sidebar.openNavigation')}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Team Board</span>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label={t('sidebar.search')}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Search className="h-5 w-5" />
          </button>
        </header>

        {/* Page content. `relative` makes this the containing block for absolutely positioned
            descendants (e.g. `sr-only` elements) so they can't stretch the document and add a second scrollbar. */}
        <div
          id="main-content"
          ref={scrollRef}
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto scrollbar-thin outline-none"
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
