import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  isDark: boolean
  toggle: () => void
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // First visit: follow the OS preference. Afterwards the persisted choice wins.
      isDark: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
      toggle: () =>
        set((s) => {
          const next = !s.isDark
          applyTheme(next)
          return { isDark: next }
        }),
    }),
    {
      name: 'theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.isDark)
      },
    },
  ),
)
