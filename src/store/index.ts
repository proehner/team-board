import { create } from 'zustand'
import {
  membersApi, skillsApi, sprintsApi, assignmentsApi, retrosApi, responsibilityTypesApi, pulseApi,
  softwareApi, knownErrorsApi, meetingsApi, roadmapApi,
} from '@/api/client'
import type {
  TeamMember, MemberRole,
  Skill, MemberSkill, SkillLevel,
  Sprint, SprintStatus,
  ResponsibilityAssignment, ResponsibilityType, ResponsibilityTypeConfig,
  Retrospective, RetroItem, RetroItemType,
  PulseCheck,
  Software, KnownError, KnownErrorSeverity, KnownErrorStatus,
  Meeting, MeetingRecurrence,
  RoadmapFeature, RoadmapTicket, RoadmapStatus, RoadmapPriority, RoadmapTicketType, RoadmapTicketArea,
  RoadmapEndpoint, RoadmapScreen, HttpMethod, EndpointComplexity,
} from '@/types'

interface AppState {
  // ─── Data ─────────────────────────────────────────────────────────────────
  members: TeamMember[]
  allMembers: TeamMember[]
  skills: Skill[]
  memberSkills: MemberSkill[]
  sprints: Sprint[]
  assignments: ResponsibilityAssignment[]
  retrospectives: Retrospective[]
  responsibilityTypes: ResponsibilityTypeConfig[]
  pulseChecks: PulseCheck[]
  software: Software[]
  knownErrors: KnownError[]
  meetings: Meeting[]

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

  // ─── Meetings ─────────────────────────────────────────────────────────────
  addMeeting:    (data: { title: string; description?: string; recurrence: MeetingRecurrence; dayOfWeek?: number; meetingTime?: string; location?: string; isGlobal?: boolean }) => Promise<string>
  updateMeeting: (id: string, data: Partial<Omit<Meeting, 'id' | 'teamId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteMeeting: (id: string) => Promise<void>

  // ─── Roadmap ──────────────────────────────────────────────────────────────
  roadmapFeatures:    RoadmapFeature[]
  roadmapTickets:     Record<string, RoadmapTicket[]>  // keyed by featureId
  allRoadmapTickets:  RoadmapTicket[] | null            // null = not yet loaded
  roadmapEndpoints:   Record<string, RoadmapEndpoint[]> // keyed by featureId
  roadmapScreens:     Record<string, RoadmapScreen[]>   // keyed by featureId
  loadAllRoadmapTickets: () => Promise<void>
  addRoadmapFeature:    (data: { title: string; description?: string; status?: RoadmapStatus; priority?: RoadmapPriority; targetVersion?: string; targetYear?: number; targetQuarter?: number; category?: string; tags?: string[]; goals?: string; acceptanceCriteria?: string; uiNotes?: string; backendNotes?: string; technicalNotes?: string; risks?: string }) => Promise<string>
  updateRoadmapFeature: (id: string, data: Partial<Omit<RoadmapFeature, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteRoadmapFeature: (id: string) => Promise<void>
  loadRoadmapTickets:   (featureId: string) => Promise<void>
  addRoadmapTicket:     (featureId: string, data: { title: string; description?: string; acceptanceCriteria?: string; type?: RoadmapTicketType; area?: RoadmapTicketArea; storyPoints?: number; priority?: RoadmapPriority; assignedTeam?: string; tags?: string[]; sortOrder?: number }) => Promise<string>
  updateRoadmapTicket:  (featureId: string, ticketId: string, data: Partial<Omit<RoadmapTicket, 'id' | 'featureId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteRoadmapTicket:  (featureId: string, ticketId: string) => Promise<void>
  loadRoadmapEndpoints:   (featureId: string) => Promise<void>
  addRoadmapEndpoint:     (featureId: string, data: { method?: HttpMethod; path?: string; title?: string; description?: string; requestBody?: string; responseBody?: string; authRequired?: boolean; complexity?: EndpointComplexity; notes?: string; sortOrder?: number }) => Promise<string>
  updateRoadmapEndpoint:  (featureId: string, endpointId: string, data: Partial<Omit<RoadmapEndpoint, 'id' | 'featureId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteRoadmapEndpoint:  (featureId: string, endpointId: string) => Promise<void>
  loadRoadmapScreens:     (featureId: string) => Promise<void>
  addRoadmapScreen:       (featureId: string, data: { title?: string; route?: string; description?: string; components?: string[]; endpointIds?: string[]; wireframeNotes?: string; sortOrder?: number }) => Promise<string>
  updateRoadmapScreen:    (featureId: string, screenId: string, data: Partial<Omit<RoadmapScreen, 'id' | 'featureId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteRoadmapScreen:    (featureId: string, screenId: string) => Promise<void>
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
  allMembers: [],
  skills: [],
  memberSkills: [],
  sprints: [],
  assignments: [],
  retrospectives: [],
  responsibilityTypes: [],
  pulseChecks: [],
  software: [],
  knownErrors: [],
  meetings: [],
  roadmapFeatures: [],
  roadmapTickets: {},
  allRoadmapTickets: null,
  roadmapEndpoints: {},
  roadmapScreens: {},
  loading: false,
  error: null,

  // ─── loadAll ──────────────────────────────────────────────────────────────
  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [members, allMembers, { skills, memberSkills }, sprints, assignments, retrospectives, responsibilityTypes, pulseChecks, software, knownErrors, meetings, roadmapFeatures] =
        await Promise.all([
          membersApi.list(),
          membersApi.listAll(),
          skillsApi.list(),
          sprintsApi.list(),
          assignmentsApi.list(),
          retrosApi.list(),
          responsibilityTypesApi.list(),
          pulseApi.list(),
          softwareApi.list(),
          knownErrorsApi.list(),
          meetingsApi.list(),
          roadmapApi.listFeatures(),
        ])
      set({ members, allMembers, skills, memberSkills, sprints, assignments, retrospectives, responsibilityTypes, pulseChecks, software, knownErrors, meetings, roadmapFeatures, loading: false })
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

  // ─── Meetings ─────────────────────────────────────────────────────────────
  addMeeting: async (data) => {
    const meeting = await meetingsApi.create(data)
    set((s) => ({ meetings: [...s.meetings, meeting].sort((a, b) => a.title.localeCompare(b.title)) }))
    return meeting.id
  },

  updateMeeting: async (id, data) => {
    const updated = await meetingsApi.update(id, data)
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === id ? updated : m)).sort((a, b) => a.title.localeCompare(b.title)),
    }))
  },

  deleteMeeting: async (id) => {
    await meetingsApi.delete(id)
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }))
  },

  // ─── Roadmap ──────────────────────────────────────────────────────────────
  loadAllRoadmapTickets: async () => {
    const tickets = await roadmapApi.listAllTickets()
    // Populate per-feature cache and the flat list
    const byFeature: Record<string, RoadmapTicket[]> = {}
    for (const t of tickets) {
      if (!byFeature[t.featureId]) byFeature[t.featureId] = []
      byFeature[t.featureId].push(t)
    }
    set((s) => ({ allRoadmapTickets: tickets, roadmapTickets: { ...byFeature, ...s.roadmapTickets } }))
  },

  addRoadmapFeature: async (data) => {
    const feature = await roadmapApi.createFeature(data)
    set((s) => ({ roadmapFeatures: [feature, ...s.roadmapFeatures] }))
    return feature.id
  },

  updateRoadmapFeature: async (id, data) => {
    const updated = await roadmapApi.updateFeature(id, data)
    set((s) => ({ roadmapFeatures: s.roadmapFeatures.map((f) => (f.id === id ? updated : f)) }))
  },

  deleteRoadmapFeature: async (id) => {
    await roadmapApi.deleteFeature(id)
    set((s) => {
      const { [id]: _, ...rest } = s.roadmapTickets
      return { roadmapFeatures: s.roadmapFeatures.filter((f) => f.id !== id), roadmapTickets: rest }
    })
  },

  loadRoadmapTickets: async (featureId) => {
    const tickets = await roadmapApi.listTickets(featureId)
    set((s) => ({ roadmapTickets: { ...s.roadmapTickets, [featureId]: tickets } }))
  },

  addRoadmapTicket: async (featureId, data) => {
    const ticket = await roadmapApi.createTicket(featureId, data)
    set((s) => ({
      allRoadmapTickets: s.allRoadmapTickets ? [...s.allRoadmapTickets, ticket] : null,
      roadmapTickets: {
        ...s.roadmapTickets,
        [featureId]: [...(s.roadmapTickets[featureId] ?? []), ticket],
      },
    }))
    return ticket.id
  },

  updateRoadmapTicket: async (featureId, ticketId, data) => {
    const updated = await roadmapApi.updateTicket(featureId, ticketId, data)
    set((s) => ({
      allRoadmapTickets: s.allRoadmapTickets
        ? s.allRoadmapTickets.map((t) => (t.id === ticketId ? updated : t))
        : null,
      roadmapTickets: {
        ...s.roadmapTickets,
        [featureId]: (s.roadmapTickets[featureId] ?? []).map((t) => (t.id === ticketId ? updated : t)),
      },
    }))
  },

  deleteRoadmapTicket: async (featureId, ticketId) => {
    await roadmapApi.deleteTicket(featureId, ticketId)
    set((s) => ({
      allRoadmapTickets: s.allRoadmapTickets
        ? s.allRoadmapTickets.filter((t) => t.id !== ticketId)
        : null,
      roadmapTickets: {
        ...s.roadmapTickets,
        [featureId]: (s.roadmapTickets[featureId] ?? []).filter((t) => t.id !== ticketId),
      },
    }))
  },

  // ─── Endpoints ──────────────────────────────────────────────────────────────
  loadRoadmapEndpoints: async (featureId) => {
    const endpoints = await roadmapApi.listEndpoints(featureId)
    set((s) => ({ roadmapEndpoints: { ...s.roadmapEndpoints, [featureId]: endpoints } }))
  },

  addRoadmapEndpoint: async (featureId, data) => {
    const endpoint = await roadmapApi.createEndpoint(featureId, data)
    set((s) => ({
      roadmapEndpoints: {
        ...s.roadmapEndpoints,
        [featureId]: [...(s.roadmapEndpoints[featureId] ?? []), endpoint],
      },
    }))
    return endpoint.id
  },

  updateRoadmapEndpoint: async (featureId, endpointId, data) => {
    const updated = await roadmapApi.updateEndpoint(featureId, endpointId, data)
    set((s) => ({
      roadmapEndpoints: {
        ...s.roadmapEndpoints,
        [featureId]: (s.roadmapEndpoints[featureId] ?? []).map((e) => (e.id === endpointId ? updated : e)),
      },
    }))
  },

  deleteRoadmapEndpoint: async (featureId, endpointId) => {
    await roadmapApi.deleteEndpoint(featureId, endpointId)
    set((s) => ({
      roadmapEndpoints: {
        ...s.roadmapEndpoints,
        [featureId]: (s.roadmapEndpoints[featureId] ?? []).filter((e) => e.id !== endpointId),
      },
    }))
  },

  // ─── Screens ────────────────────────────────────────────────────────────────
  loadRoadmapScreens: async (featureId) => {
    const screens = await roadmapApi.listScreens(featureId)
    set((s) => ({ roadmapScreens: { ...s.roadmapScreens, [featureId]: screens } }))
  },

  addRoadmapScreen: async (featureId, data) => {
    const screen = await roadmapApi.createScreen(featureId, data)
    set((s) => ({
      roadmapScreens: {
        ...s.roadmapScreens,
        [featureId]: [...(s.roadmapScreens[featureId] ?? []), screen],
      },
    }))
    return screen.id
  },

  updateRoadmapScreen: async (featureId, screenId, data) => {
    const updated = await roadmapApi.updateScreen(featureId, screenId, data)
    set((s) => ({
      roadmapScreens: {
        ...s.roadmapScreens,
        [featureId]: (s.roadmapScreens[featureId] ?? []).map((sc) => (sc.id === screenId ? updated : sc)),
      },
    }))
  },

  deleteRoadmapScreen: async (featureId, screenId) => {
    await roadmapApi.deleteScreen(featureId, screenId)
    set((s) => ({
      roadmapScreens: {
        ...s.roadmapScreens,
        [featureId]: (s.roadmapScreens[featureId] ?? []).filter((sc) => sc.id !== screenId),
      },
    }))
  },
}))
