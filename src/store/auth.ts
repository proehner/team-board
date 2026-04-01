import { create } from 'zustand'
import type { AppUser } from '@/types'

const TOKEN_KEY = 'teamlead_token'

interface AuthState {
  user: AppUser | null
  token: string | null
  login: (token: string, user: AppUser) => void
  logout: () => void
  isAllowed: (page: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),

  login(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, user })
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null })
  },

  isAllowed(page) {
    const { user } = get()
    if (!user) return false
    if (user.role === 'admin') return true
    return !user.forbiddenPages.includes(page)
  },
}))

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
