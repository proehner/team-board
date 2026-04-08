import { create } from 'zustand'
import type { AppUser, Team } from '@/types'

const TOKEN_KEY   = 'teamlead_token'
const TEAM_ID_KEY = 'teamlead_team_id'

interface AuthState {
  user:          AppUser | null
  token:         string | null
  teams:         Team[]
  currentTeamId: string | null
  login:         (token: string, user: AppUser) => void
  logout:        () => void
  isAllowed:     (page: string) => boolean
  setTeams:      (teams: Team[]) => void
  selectTeam:    (teamId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:          null,
  token:         localStorage.getItem(TOKEN_KEY),
  teams:         [],
  currentTeamId: localStorage.getItem(TEAM_ID_KEY),

  login(token, user) {
    localStorage.setItem(TOKEN_KEY, token)
    // Restore the last selected team (survives logout so the user isn't asked every time)
    const restoredTeamId = localStorage.getItem(TEAM_ID_KEY)
    set({ token, user, currentTeamId: restoredTeamId })
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    // Intentionally keep TEAM_ID_KEY so it is restored on the next login
    set({ token: null, user: null, teams: [], currentTeamId: null })
  },

  isAllowed(page) {
    const { user } = get()
    if (!user) return false
    if (user.role === 'admin') return true
    return !user.forbiddenPages.includes(page)
  },

  setTeams(teams) {
    set({ teams })
    // If stored team is no longer valid, clear it
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
