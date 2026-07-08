import type { TeamMember, Team } from '@/types'

/**
 * Maps each member's id to its display name, appending " (TeamName)" when the
 * same name occurs more than once in `members` — e.g. a person who belongs to
 * multiple teams is stored as one row per team membership.
 */
export function getMemberDisplayNames(members: TeamMember[], teams: Team[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const m of members) {
    counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
  }

  const names = new Map<string, string>()
  for (const m of members) {
    if ((counts.get(m.name) ?? 0) > 1) {
      const teamName = teams.find((t) => t.id === m.teamId)?.name
      names.set(m.id, teamName ? `${m.name} (${teamName})` : m.name)
    } else {
      names.set(m.id, m.name)
    }
  }
  return names
}
