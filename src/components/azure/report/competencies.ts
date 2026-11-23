import type { MemberSkill, Skill, SkillArea, TeamMember } from '@/types'
import type { ReportCompetencies, ReportSkill } from './types'

const EXPERT_LEVEL = 4

const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

/** Team member that belongs to an Azure DevOps identity: same e-mail, otherwise same name. */
export function matchMember(members: TeamMember[], displayName: string, uniqueName: string): TeamMember | undefined {
  const mail = uniqueName.toLowerCase()
  return members.find((m) => m.email && m.email.toLowerCase() === mail)
    ?? members.find((m) => normName(m.name) === normName(displayName))
}

/** Competencies of one member with team context (experts, average level) from the competency matrix. */
export function buildCompetencies(
  member: TeamMember,
  members: TeamMember[],
  skills: Skill[],
  memberSkills: MemberSkill[],
  areas: SkillArea[],
  uncategorised: string,
): ReportCompetencies {
  const active = new Set(members.filter((m) => m.isActive || m.id === member.id).map((m) => m.id))
  const categories = new Map(areas.flatMap((a) => a.categories.map((c) => [c.id, { area: a, category: c }] as const)))

  const own = memberSkills.filter((ms) => ms.memberId === member.id && ms.level > 0)
  const list: (ReportSkill & { sort: [number, number, string] })[] = []
  for (const ms of own) {
    const skill = skills.find((s) => s.id === ms.skillId)
    if (!skill) continue
    const ratings = memberSkills.filter((x) => x.skillId === skill.id && active.has(x.memberId) && x.level > 0)
    const experts = ratings.filter((x) => x.level >= EXPERT_LEVEL).length
    const cat = skill.categoryId ? categories.get(skill.categoryId) : undefined
    list.push({
      area:     cat?.area.name ?? uncategorised,
      category: cat?.category.name ?? null,
      name:     skill.name,
      level:    ms.level,
      teamAvg:  ratings.length ? Math.round((ratings.reduce((s, x) => s + x.level, 0) / ratings.length) * 10) / 10 : null,
      experts,
      knowledgeHolder: ms.level >= EXPERT_LEVEL && experts === 1,
      growthPotential: (ms.level === 2 || ms.level === 3) && experts <= 1,
      sort: [cat?.area.sortOrder ?? 9999, cat?.category.sortOrder ?? 9999, skill.name.toLowerCase()],
    })
  }
  list.sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2].localeCompare(b.sort[2]))

  const lastUpdate = own.reduce<string | null>((m, ms) => (!m || ms.updatedAt > m ? ms.updatedAt : m), null)
  return {
    memberName: member.name,
    skills: list.map(({ sort: _sort, ...s }) => s),
    lastUpdate,
    teamSize: active.size,
  }
}
