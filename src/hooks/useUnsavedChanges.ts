import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Blocks navigation when `dirty` is true and shows a confirmation dialog.
 *
 * Works with HashRouter via two mechanisms:
 *  1. A history "guard entry" is pushed so that browser-back first hits the
 *     same URL (React Router ignores hash-identical popstate events).
 *  2. Anchor clicks are intercepted in capture-phase before React Router acts.
 */
export function useUnsavedChanges(dirty: boolean) {
  const navigate   = useNavigate()
  const dirtyRef   = useRef(dirty)
  dirtyRef.current = dirty

  const [pendingNav, setPendingNav] = useState<string | number | null>(null)
  const pendingNavRef = useRef<string | number | null>(null)
  pendingNavRef.current = pendingNav

  // Number of guard entries currently on the history stack
  const guardDepth = useRef(0)
  // Flag to skip the next popstate fired by our own history.go() call
  const skipNext   = useRef(false)

  // ── Guard entry lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (dirty) {
      // Push one guard entry. Browser-back lands here first (same hash →
      // no hashchange → React Router stays on this page).
      window.history.pushState(null, '', window.location.href)
      guardDepth.current = 1
    } else if (guardDepth.current > 0) {
      // User saved – silently pop all guard entries
      skipNext.current = true
      window.history.go(-guardDepth.current)
      guardDepth.current = 0
    }
  }, [dirty])

  // ── Browser back / forward interception ───────────────────────────────────
  useEffect(() => {
    function handlePopState() {
      if (skipNext.current) { skipNext.current = false; return }
      if (!dirtyRef.current) return

      // Re-lock: push another guard entry so we stay on this page
      window.history.pushState(null, '', window.location.href)
      guardDepth.current++
      setPendingNav('__browser_nav__')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ── NavLink / Link click interception (capture phase) ─────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!dirtyRef.current) return
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href?.startsWith('#/')) return     // only internal hash routes
      if (anchor.target === '_blank') return  // external tabs untouched
      e.preventDefault()
      e.stopPropagation()
      setPendingNav(href.slice(1))            // '#/roadmap' → '/roadmap'
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  // ── Browser tab / window close ────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return
    function handler(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // ── Public API ────────────────────────────────────────────────────────────

  /** Use instead of navigate() for buttons that should be guarded. */
  const guardedNavigate = useCallback(
    (to: string | number) => {
      if (dirtyRef.current) setPendingNav(to)
      else typeof to === 'number' ? navigate(to) : navigate(to)
    },
    [navigate],
  )

  const confirmLeave = useCallback(() => {
    const dest  = pendingNavRef.current!
    const depth = guardDepth.current
    setPendingNav(null)
    guardDepth.current = 0

    if (dest === '__browser_nav__') {
      // Skip past all guard entries + one more step to reach the previous page
      skipNext.current = true
      window.history.go(-(depth + 1))
    } else if (typeof dest === 'number') {
      navigate(dest)
    } else {
      // Link-click or guardedNavigate: just navigate (guard entries in history
      // are harmless – they share the same hash so won't cause wrong renders)
      navigate(dest)
    }
  }, [navigate])

  const cancelLeave = useCallback(() => setPendingNav(null), [])

  return {
    isBlocked: pendingNav !== null,
    confirmLeave,
    cancelLeave,
    guardedNavigate,
  }
}
