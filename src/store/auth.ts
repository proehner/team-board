import { create } from 'zustand'
import type { AppUser, PagePermission, Team } from '@/types'

const TOKEN_KEY   = 'teamlead_token'
const TEAM_ID_KEY = 'teamlead_team_id'

interface AuthState {
  user:             AppUser | null
  token:            string | null
  teams:            Team[]
  currentTeamId:    string | null
  login:            (token: string, user: AppUser) => void
  logout:           () => void
  /** Returns true if the user can navigate to and view the page (permission !== 'none'). */
  isAllowed:        (page: string) => boolean
  /** Returns true if the user can perform write operations on the page. */
  canWrite:         (page: string) => boolean
  /** Returns true if the user can write at least their own data on the page (write or write-own). */
  canWriteOwn:      (page: string) => boolean
  /** Returns the effective permission level for a page. */
  pagePermission:   (page: string) => PagePermission
  setTeams:         (teams: Team[]) => void
  selectTeam:       (teamId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:          null,
  token:         localStorage.getItem(TOKEN_KEY),
  teams:         [],
  currentTeamId: localStorage.getItem(TEAM_ID_KEY),

  login(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    const restoredTeamId = localStorage.getItem(TEAM_ID_KEY)
    set({ token, user, currentTeamId: restoredTeamId })
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null, teams: [], currentTeamId: null })
  },

  pagePermission(page): PagePermission {
    const { user } = get()
    if (!user) return 'none'
    if (user.role === 'admin') return 'write'
    return user.pagePermissions?.[page] ?? 'write'
  },

  isAllowed(page) {
    return get().pagePermission(page) !== 'none'
  },

  canWrite(page) {
    return get().pagePermission(page) === 'write'
  },

  canWriteOwn(page) {
    const perm = get().pagePermission(page)
    return perm === 'write' || perm === 'write-own'
  },

  setTeams(teams) {
    set({ teams })
    const { currentTeamId } = get()
    if (currentTeamId && !teams.find((t) => t.id === currentTeamId)) {
      localStorage.removeItem(TEAM_ID_KEY)
      set({ currentTeamId: null })
    }
  },

  selectTeam(teamId) {
    localStorage.setItem(TEAM_ID_KEY, teamId)
    set({ currentTeamId: teamId })
  },
}))

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredTeamId(): string | null {
  return localStorage.getItem(TEAM_ID_KEY)
}
