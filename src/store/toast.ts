import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
  /** ms until auto-dismiss; 0 = sticky */
  duration: number
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++
    const duration = t.duration ?? (t.tone === 'error' ? 6000 : 3500)
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id, duration }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

type ToastOpts = { description?: string; duration?: number; action?: ToastItem['action'] }

/**
 * Imperative toast API — usable from components, stores and event handlers.
 *
 *   toast.success(t('common.saved'))
 *   toast.error(t('common.saveError'), { description: err.message })
 */
export const toast = {
  success: (title: string, opts?: ToastOpts) => useToastStore.getState().push({ tone: 'success', title, ...opts }),
  error:   (title: string, opts?: ToastOpts) => useToastStore.getState().push({ tone: 'error', title, ...opts }),
  info:    (title: string, opts?: ToastOpts) => useToastStore.getState().push({ tone: 'info', title, ...opts }),
  warning: (title: string, opts?: ToastOpts) => useToastStore.getState().push({ tone: 'warning', title, ...opts }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
}

/** Extracts a human readable message from an unknown error. */
export function errorMessage(err: unknown, fallback = ''): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}
