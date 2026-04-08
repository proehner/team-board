import { create } from 'zustand'
import {
  membersApi, skillsApi, sprintsApi, assignmentsApi, retrosApi, responsibilityTypesApi, pulseApi,
  softwareApi, knownErrorsApi,
} from '@/api/client'
import type {
  TeamMember, MemberRole,
  Skill, MemberSkill, SkillLevel,
  Sprint, SprintStatus,
  ResponsibilityAssignment, ResponsibilityType, ResponsibilityTypeConfig,
  Retrospective, RetroItem, RetroItemType,
  PulseCheck,
  Software, KnownError, KnownErrorSeverity, KnownErrorStatus,
} from '@/types'

interface AppState {
  // ─── Data ─────────────────────────────────────────────────────────────────
  members: TeamMember[]
  skills: Skill[]
  memberSkills: MemberSkill[]
  sprints: Sprint[]
  assignments: ResponsibilityAssignment[]
  retrospectives: Retrospective[]
  responsibilityTypes: ResponsibilityTypeConfig[]
  pulseChecks: PulseCheck[]
  software: Software[]
  knownErrors: KnownError[]

  // ─── Loading / error ──────────────────────────────────────────────────────
  loading: boolean
  error: string | null

  // ─── Bootstrap: load all data from server ─────────────────────────────────
  loadAll: () => Promise<void>

  // ─── Members ──────────────────────────────────────────────────────────────
  addMember:    (data: { name: string; email: string; roles: MemberRole[]; isActive?: boolean }) => Promise<string>
  updateMember: (id: string, data: Partial<TeamMember>) => Promise<void>
  deleteMember: (id: string) => Promise<void>

  // ─── Skills ───────────────────────────────────────────────────────────────
  addSkill:           (data: Omit<Skill, 'id'>) => Promise<string>
  updateSkill:        (id: string, data: Partial<Skill>) => Promise<void>
  deleteSkill:        (id: string) => Promise<void>
  setMemberSkillLevel:(memberId: string, skillId: string, level: SkillLevel, notes?: string) => Promise<void>

  // ─── Sprints ──────────────────────────────────────────────────────────────
  addSprint:           (data: { name: string; goal: string; startDate: string; endDate: string; notes?: string }) => Promise<string>
  updateSprint:        (id: string, data: Partial<Sprint>) => Promise<void>
  deleteSprint:        (id: string) => Promise<void>
  setSprintStatus:     (id: string, status: SprintStatus) => Promise<void>
  setMemberCapacity:   (sprintId: string, memberId: string, availableDays: number, plannedPoints: number) => Promise<void>
  removeMemberFromSprint: (sprintId: string, memberId: string) => Promise<void>

  // ─── Assignments ──────────────────────────────────────────────────────────
  addAssignment:    (data: Omit<ResponsibilityAssignment, 'id'>) => Promise<string>
  updateAssignment: (id: string, data: Partial<ResponsibilityAssignment>) => Promise<void>
  deleteAssignment: (id: string) => Promise<void>
  suggestNextAssignee:    (type: ResponsibilityType) => Promise<string | null>
  archiveOldAssignments:  (before?: string) => Promise<number>

  // ─── Responsibility Types ──────────────────────────────────────────────────
  addResponsibilityType:    (data: { name: string; color: string }) => Promise<string>
  updateResponsibilityType: (id: string, data: Partial<Pick<ResponsibilityTypeConfig, 'name' | 'color' | 'sortOrder'>>) => Promise<void>
  deleteResponsibilityType: (id: string) => Promise<void>

  // ─── Retrospectives ───────────────────────────────────────────────────────
  addRetrospective:   (data: Omit<Retrospective, 'id' | 'createdAt' | 'items'>) => Promise<string>
  updateRetrospective:(id: string, data: Partial<Pick<Retrospective, 'title' | 'date' | 'sprintId' | 'facilitatorId' | 'isFinalized'>>) => Promise<void>
  deleteRetrospective:(id: string) => Promise<void>
  addRetroItem:       (retroId: string, type: RetroItemType, text: string) => Promise<void>
  updateRetroItem:    (retroId: string, itemId: string, data: Partial<RetroItem>) => Promise<void>
  deleteRetroItem:    (retroId: string, itemId: string) => Promise<void>
  voteRetroItem:      (retroId: string, itemId: string, delta: 1 | -1) => Promise<void>

  // ─── Pulse ────────────────────────────────────────────────────────────────
  loadPulse:    () => Promise<void>
  createPulse:  (data: { title: string; questions: string[]; sprintId?: string }) => Promise<string>
  respondPulse: (id: string, ratings: number[]) => Promise<void>
  closePulse:   (id: string) => Promise<void>
  deletePulse:  (id: string) => Promise<void>

  // ─── Software ─────────────────────────────────────────────────────────────
  addSoftware:    (data: Omit<Software, 'id'>) => Promise<string>
  updateSoftware: (id: string, data: Partial<Omit<Software, 'id'>>) => Promise<void>
  deleteSoftware: (id: string) => Promise<void>

  // ─── Known Errors ─────────────────────────────────────────────────────────
  addKnownError:    (data: { title: string; ticketNumber?: string; description: string; solution: string; workaround?: string; severity: KnownErrorSeverity; status: KnownErrorStatus; softwareIds: string[]; tags: string[] }) => Promise<string>
  updateKnownError: (id: string, data: Partial<Omit<KnownError, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteKnownError: (id: string) => Promise<void>
}

// Helper: update a single retro's items in the state after an item mutation
function patchRetroItem(
  retros: Retrospective[],
  retroId: string,
  itemId: string,
  updatedItem: RetroItem,
): Retrospective[] {
  return retros.map((r) =>
    r.id === retroId
      ? { ...r, items: r.items.map((i) => (i.id === itemId ? updatedItem : i)) }
      : r,
  )
}

export const useStore = create<AppState>()((set, _get) => ({
  members: [],
  skills: [],
  memberSkills: [],
  sprints: [],
  assignments: [],
  retrospectives: [],
  responsibilityTypes: [],
  pulseChecks: [],
  software: [],
  knownErrors: [],
  loading: false,
  error: null,

  // ─── loadAll ──────────────────────────────────────────────────────────────
  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [members, { skills, memberSkills }, sprints, assignments, retrospectives, responsibilityTypes, pulseChecks, software, knownErrors] =
        await Promise.all([
          membersApi.list(),
          skillsApi.list(),
          sprintsApi.list(),
          assignmentsApi.list(),
          retrosApi.list(),
          responsibilityTypesApi.list(),
          pulseApi.list(),
          softwareApi.list(),
          knownErrorsApi.list(),
        ])
      set({ members, skills, memberSkills, sprints, assignments, retrospectives, responsibilityTypes, pulseChecks, software, knownErrors, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  // ─── Members ──────────────────────────────────────────────────────────────
  addMember: async (data) => {
    const member = await membersApi.create(data)
    set((s) => ({ members: [...s.members, member] }))
    return member.id
  },

  updateMember: async (id, data) => {
    const updated = await membersApi.update(id, data)
    set((s) => ({ members: s.members.map((m) => (m.id === id ? updated : m)) }))
  },

  deleteMember: async (id) => {
    await membersApi.delete(id)
    set((s) => ({
      members: s.members.filter((m) => m.id !== id),
      memberSkills: s.memberSkills.filter((ms) => ms.memberId !== id),
    }))
  },

  // ─── Skills ───────────────────────────────────────────────────────────────
  addSkill: async (data) => {
    const skill = await skillsApi.create(data)
    set((s) => ({ skills: [...s.skills, skill] }))
    return skill.id
  },

  updateSkill: async (id, data) => {
    const updated = await skillsApi.update(id, data)
    set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? updated : sk)) }))
  },

  deleteSkill: async (id) => {
    await skillsApi.delete(id)
    set((s) => ({
      skills: s.skills.filter((sk) => sk.id !== id),
      memberSkills: s.memberSkills.filter((ms) => ms.skillId !== id),
    }))
  },

  setMemberSkillLevel: async (memberId, skillId, level, notes) => {
    const ms = await skillsApi.setLevel(memberId, skillId, level, notes)
    set((s) => {
      const exists = s.memberSkills.some((x) => x.memberId === memberId && x.skillId === skillId)
      return {
        memberSkills: exists
          ? s.memberSkills.map((x) =>
              x.memberId === memberId && x.skillId === skillId ? ms : x,
            )
          : [...s.memberSkills, ms],
      }
    })
  },

  // ─── Sprints ──────────────────────────────────────────────────────────────
  addSprint: async (data) => {
    const sprint = await sprintsApi.create(data)
    set((s) => ({ sprints: [...s.sprints, sprint] }))
    return sprint.id
  },

  updateSprint: async (id, data) => {
    const updated = await sprintsApi.update(id, data)
    set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? updated : sp)) }))
  },

  deleteSprint: async (id) => {
    await sprintsApi.delete(id)
    set((s) => ({
      sprints: s.sprints.filter((sp) => sp.id !== id),
      assignments: s.assignments.map((a) =>
        a.sprintId === id ? { ...a, sprintId: undefined } : a,
      ),
    }))
  },

  setSprintStatus: async (id, status) => {
    const updated = await sprintsApi.setStatus(id, status)
    set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? updated : sp)) }))
  },

  setMemberCapacity: async (sprintId, memberId, availableDays, plannedPoints) => {
    await sprintsApi.setCapacity(sprintId, memberId, availableDays, plannedPoints)
    // Reload sprint to get updated plannedPoints total
    const updated = await sprintsApi.get(sprintId)
    set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === sprintId ? updated : sp)) }))
  },

  removeMemberFromSprint: async (sprintId, memberId) => {
    await sprintsApi.removeCapacity(sprintId, memberId)
    const updated = await sprintsApi.get(sprintId)
    set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === sprintId ? updated : sp)) }))
  },

  // ─── Assignments ──────────────────────────────────────────────────────────
  addAssignment: async (data) => {
    const a = await assignmentsApi.create(data)
    set((s) => ({ assignments: [...s.assignments, a] }))
    return a.id
  },

  updateAssignment: async (id, data) => {
    const updated = await assignmentsApi.update(id, data)
    set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? updated : a)) }))
  },

  deleteAssignment: async (id) => {
    await assignmentsApi.delete(id)
    set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) }))
  },

  suggestNextAssignee: async (type) => {
    const { memberId } = await assignmentsApi.suggest(type)
    return memberId
  },

  archiveOldAssignments: async (before) => {
    const { archived } = await assignmentsApi.archiveOld(before)
    if (archived > 0) {
      // Lokalen State aktualisieren: archivierte Einträge mit isArchived=true markieren
      const updated = await assignmentsApi.list()
      set({ assignments: updated })
    }
    return archived
  },

  // ─── Responsibility Types ──────────────────────────────────────────────────
  addResponsibilityType: async (data) => {
    const rt = await responsibilityTypesApi.create(data)
    set((s) => ({ responsibilityTypes: [...s.responsibilityTypes, rt].sort((a, b) => a.sortOrder - b.sortOrder) }))
    return rt.id
  },

  updateResponsibilityType: async (id, data) => {
    const updated = await responsibilityTypesApi.update(id, data)
    set((s) => ({ responsibilityTypes: s.responsibilityTypes.map((rt) => (rt.id === id ? updated : rt)).sort((a, b) => a.sortOrder - b.sortOrder) }))
  },

  deleteResponsibilityType: async (id) => {
    await responsibilityTypesApi.delete(id)
    set((s) => ({ responsibilityTypes: s.responsibilityTypes.filter((rt) => rt.id !== id) }))
  },

  // ─── Retrospectives ───────────────────────────────────────────────────────
  addRetrospective: async (data) => {
    const retro = await retrosApi.create(data)
    set((s) => ({ retrospectives: [...s.retrospectives, retro] }))
    return retro.id
  },

  updateRetrospective: async (id, data) => {
    const updated = await retrosApi.update(id, data)
    set((s) => ({ retrospectives: s.retrospectives.map((r) => (r.id === id ? updated : r)) }))
  },

  deleteRetrospective: async (id) => {
    await retrosApi.delete(id)
    set((s) => ({ retrospectives: s.retrospectives.filter((r) => r.id !== id) }))
  },

  addRetroItem: async (retroId, type, text) => {
    const item = await retrosApi.addItem(retroId, type, text)
    set((s) => ({
      retrospectives: s.retrospectives.map((r) =>
        r.id === retroId ? { ...r, items: [...r.items, item] } : r,
      ),
    }))
  },

  updateRetroItem: async (retroId, itemId, data) => {
    const updated = await retrosApi.updateItem(retroId, itemId, data)
    set((s) => ({ retrospectives: patchRetroItem(s.retrospectives, retroId, itemId, updated) }))
  },

  deleteRetroItem: async (retroId, itemId) => {
    await retrosApi.deleteItem(retroId, itemId)
    set((s) => ({
      retrospectives: s.retrospectives.map((r) =>
        r.id === retroId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r,
      ),
    }))
  },

  voteRetroItem: async (retroId, itemId, delta) => {
    const updated = await retrosApi.vote(retroId, itemId, delta)
    set((s) => ({ retrospectives: patchRetroItem(s.retrospectives, retroId, itemId, updated) }))
  },

  // ─── Pulse ────────────────────────────────────────────────────────────────
  loadPulse: async () => {
    const pulseChecks = await pulseApi.list()
    set({ pulseChecks })
  },
  createPulse: async (data) => {
    const pc = await pulseApi.create(data)
    set((s) => ({ pulseChecks: [pc, ...s.pulseChecks] }))
    return pc.id
  },
  respondPulse: async (id, ratings) => {
    await pulseApi.respond(id, ratings)
    const updated = await pulseApi.get(id)
    set((s) => ({ pulseChecks: s.pulseChecks.map((p) => (p.id === id ? updated : p)) }))
  },
  closePulse: async (id) => {
    const updated = await pulseApi.close(id)
    set((s) => ({ pulseChecks: s.pulseChecks.map((p) => (p.id === id ? updated : p)) }))
  },
  deletePulse: async (id) => {
    await pulseApi.delete(id)
    set((s) => ({ pulseChecks: s.pulseChecks.filter((p) => p.id !== id) }))
  },

  // ─── Software ─────────────────────────────────────────────────────────────
  addSoftware: async (data) => {
    const sw = await softwareApi.create(data)
    set((s) => ({ software: [...s.software, sw].sort((a, b) => a.name.localeCompare(b.name)) }))
    return sw.id
  },

  updateSoftware: async (id, data) => {
    const updated = await softwareApi.update(id, data)
    set((s) => ({ software: s.software.map((sw) => (sw.id === id ? updated : sw)).sort((a, b) => a.name.localeCompare(b.name)) }))
  },

  deleteSoftware: async (id) => {
    await softwareApi.delete(id)
    set((s) => ({ software: s.software.filter((sw) => sw.id !== id) }))
  },

  // ─── Known Errors ─────────────────────────────────────────────────────────
  addKnownError: async (data) => {
    const ke = await knownErrorsApi.create(data)
    set((s) => ({ knownErrors: [ke, ...s.knownErrors] }))
    return ke.id
  },

  updateKnownError: async (id, data) => {
    const updated = await knownErrorsApi.update(id, data)
    set((s) => ({ knownErrors: s.knownErrors.map((ke) => (ke.id === id ? updated : ke)) }))
  },

  deleteKnownError: async (id) => {
    await knownErrorsApi.delete(id)
    set((s) => ({ knownErrors: s.knownErrors.filter((ke) => ke.id !== id) }))
  },
}))
