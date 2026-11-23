import { useEffect, type RefObject } from 'react'

/**
 * Calls `handler` when a pointerdown happens outside of all given refs,
 * or when Escape is pressed. Only active while `enabled` is true.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const list = Array.isArray(refs) ? refs : [refs]
    function onPointer(e: PointerEvent) {
      const target = e.target as Node
      if (list.some((r) => r.current?.contains(target))) return
      handler()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [refs, handler, enabled])
}
