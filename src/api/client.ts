import type {
  TeamMember, MemberRole,
  Skill, MemberSkill, SkillLevel,
  Sprint, SprintStatus, SprintGoalMet,
  ResponsibilityAssignment, ResponsibilityType, ResponsibilityTypeConfig,
  Retrospective, RetroItemType, RetroItem,
  PulseCheck,
  AppUser, AdminUser,
  Software, KnownError, KnownErrorSeverity, KnownErrorStatus, KnownErrorAttachment,
  Team,
  Meeting, MeetingRecurrence, MeetingTopic, TopicComment, TopicAttachment,
} from '@/types'
import { getStoredToken, getStoredTeamId } from '@/store/auth'

export type { Team }

// import.meta.env.BASE_URL is set by Vite from the 'base' config option.
// Root deployment ('/'):        BASE_URL = '/'  → API at '/api'
// Subdirectory ('/board/'):     BASE_URL = '/board/' → API at '/board/api'
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token  = getStoredToken()
  const teamId = getStoredTeamId()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token)  headers['Authorization'] = `Bearer ${token}`
  if (teamId) headers['X-Team-ID']     = teamId

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as T
}

const get    = <T>(path: string) => request<T>('GET', path)
const post   = <T>(path: string, body: unknown) => request<T>('POST', path, body)
const patch  = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const put    = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
const del    = (path: string) => request<void>('DELETE', path)

// ─── Teams ────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list:   () => get<Team[]>('/teams'),
  create: (data: { name: string; description?: string }) => post<Team>('/teams', data),
  update: (id: string, data: { name?: string; description?: string }) => patch<Team>(`/teams/${id}`, data),
  delete: (id: string) => del(`/teams/${id}`),
}

// ─── Members ──────────────────────────────────────────────────────────────────
export const membersApi = {
  list:   () => get<TeamMember[]>('/members'),
  create: (data: { name: string; email: string; roles: MemberRole[]; isActive?: boolean }) =>
    post<TeamMember>('/members', data),
  update: (id: string, data: Partial<TeamMember>) =>
    patch<TeamMember>(`/members/${id}`, data),
  delete: (id: string) => del(`/members/${id}`),
}

// ─── Skills ───────────────────────────────────────────────────────────────────
export const skillsApi = {
  list:     () => get<{ skills: Skill[]; memberSkills: MemberSkill[] }>('/skills'),
  create:   (data: Omit<Skill, 'id'>) => post<Skill>('/skills', data),
  update:   (id: string, data: Partial<Skill>) => patch<Skill>(`/skills/${id}`, data),
  delete:   (id: string) => del(`/skills/${id}`),
  setLevel: (memberId: string, skillId: string, level: SkillLevel, notes?: string) =>
    put<MemberSkill>('/skills/member-skill', { memberId, skillId, level, notes }),
}

// ─── Sprints ──────────────────────────────────────────────────────────────────
type SprintCreateData = { name: string; goal: string; startDate: string; endDate: string; notes?: string }
type SprintUpdateData = {
  name?: string
  goal?: string
  startDate?: string
  endDate?: string
  status?: SprintStatus
  velocity?: number | null
  plannedPoints?: number
  plannedItems?: number | null
  completedItems?: number | null
  goalMet?: SprintGoalMet | null
  teamSatisfaction?: number | null
  impediments?: string
  capacityHours?: number | null
  remainingHours?: number | null
  averageBurndown?: number | null
  notes?: string
}

export const sprintsApi = {
  list:           () => get<Sprint[]>('/sprints'),
  get:            (id: string) => get<Sprint>(`/sprints/${id}`),
  create:         (data: SprintCreateData) => post<Sprint>('/sprints', data),
  update:         (id: string, data: SprintUpdateData) => patch<Sprint>(`/sprints/${id}`, data),
  delete:         (id: string) => del(`/sprints/${id}`),
  setStatus:      (id: string, status: SprintStatus) => patch<Sprint>(`/sprints/${id}`, { status }),
  setCapacity:    (sprintId: string, memberId: string, availableDays: number, plannedPoints: number) =>
    put<unknown>(`/sprints/${sprintId}/capacity/${memberId}`, { availableDays, plannedPoints }),
  removeCapacity: (sprintId: string, memberId: string) =>
    del(`/sprints/${sprintId}/capacity/${memberId}`),
}

// ─── Assignments ──────────────────────────────────────────────────────────────
export const assignmentsApi = {
  list:           () => get<ResponsibilityAssignment[]>('/assignments'),
  suggest:        (type: ResponsibilityType) =>
    get<{ memberId: string | null }>(`/assignments/suggest/${encodeURIComponent(type)}`),
  archivePreview: (before?: string) =>
    get<{ count: number; items: ResponsibilityAssignment[] }>(
      `/assignments/archive-preview${before ? `?before=${before}` : ''}`,
    ),
  archiveOld:     (before?: string) =>
    post<{ archived: number }>('/assignments/archive-old', { before }),
  create:         (data: Omit<ResponsibilityAssignment, 'id'>) =>
    post<ResponsibilityAssignment>('/assignments', data),
  update:         (id: string, data: Partial<ResponsibilityAssignment>) =>
    patch<ResponsibilityAssignment>(`/assignments/${id}`, data),
  delete:         (id: string) => del(`/assignments/${id}`),
}

// ─── Responsibility Types ─────────────────────────────────────────────────────
export const responsibilityTypesApi = {
  list:   () => get<ResponsibilityTypeConfig[]>('/responsibility-types'),
  create: (data: { name: string; color: string }) => post<ResponsibilityTypeConfig>('/responsibility-types', data),
  update: (id: string, data: Partial<Pick<ResponsibilityTypeConfig, 'name' | 'color' | 'sortOrder'>>) =>
    patch<ResponsibilityTypeConfig>(`/responsibility-types/${id}`, data),
  delete: (id: string) => del(`/responsibility-types/${id}`),
}

// ─── Retrospectives ───────────────────────────────────────────────────────────
type RetroUpdateData = Partial<Pick<Retrospective, 'title' | 'date' | 'sprintId' | 'facilitatorId' | 'isFinalized'>>

export const retrosApi = {
  list:       () => get<Retrospective[]>('/retrospectives'),
  get:        (id: string) => get<Retrospective>(`/retrospectives/${id}`),
  create:     (data: Omit<Retrospective, 'id' | 'createdAt' | 'items'>) =>
    post<Retrospective>('/retrospectives', data),
  update:     (id: string, data: RetroUpdateData) =>
    patch<Retrospective>(`/retrospectives/${id}`, data),
  delete:     (id: string) => del(`/retrospectives/${id}`),
  addItem:    (retroId: string, type: RetroItemType, text: string) =>
    post<RetroItem>(`/retrospectives/${retroId}/items`, { type, text }),
  updateItem: (retroId: string, itemId: string, data: Partial<RetroItem>) =>
    patch<RetroItem>(`/retrospectives/${retroId}/items/${itemId}`, data),
  deleteItem: (retroId: string, itemId: string) =>
    del(`/retrospectives/${retroId}/items/${itemId}`),
  vote:       (retroId: string, itemId: string, delta: 1 | -1) =>
    post<RetroItem>(`/retrospectives/${retroId}/items/${itemId}/vote`, { delta }),
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:          (username: string, password: string) =>
    request<{ token: string; user: AppUser }>('POST', '/auth/login', { username, password }),
  me:             () => request<AppUser>('GET', '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('POST', '/auth/change-password', { currentPassword, newPassword }),
}

// ─── Admin – Benutzerverwaltung ───────────────────────────────────────────────
export const adminApi = {
  listUsers:  () => request<AdminUser[]>('GET', '/admin/users'),
  createUser: (data: { username: string; password: string; displayName: string; role: 'admin' | 'user'; forbiddenPages: string[] }) =>
    request<AdminUser>('POST', '/admin/users', data),
  updateUser: (id: string, data: { displayName?: string; role?: 'admin' | 'user'; forbiddenPages?: string[]; isActive?: boolean; password?: string }) =>
    request<AdminUser>('PATCH', `/admin/users/${id}`, data),
  deleteUser: (id: string) => request<void>('DELETE', `/admin/users/${id}`),
}

// ─── Software ─────────────────────────────────────────────────────────────────
export const softwareApi = {
  list:   () => get<Software[]>('/software'),
  create: (data: Omit<Software, 'id'>) => post<Software>('/software', data),
  update: (id: string, data: Partial<Omit<Software, 'id'>>) => patch<Software>(`/software/${id}`, data),
  delete: (id: string) => del(`/software/${id}`),
}

// ─── Known Errors ─────────────────────────────────────────────────────────────
type KnownErrorCreateData = {
  title: string
  ticketNumber?: string
  description: string
  solution: string
  workaround?: string
  severity: KnownErrorSeverity
  status: KnownErrorStatus
  softwareIds: string[]
  tags: string[]
}
type KnownErrorUpdateData = Partial<KnownErrorCreateData>

export const knownErrorsApi = {
  list:   () => get<KnownError[]>('/known-errors'),
  get:    (id: string) => get<KnownError>(`/known-errors/${id}`),
  create: (data: KnownErrorCreateData) => post<KnownError>('/known-errors', data),
  update: (id: string, data: KnownErrorUpdateData) => patch<KnownError>(`/known-errors/${id}`, data),
  delete: (id: string) => del(`/known-errors/${id}`),
}

// ─── Uploads / Attachments ────────────────────────────────────────────────────
async function uploadFile(knownErrorId: string, file: File): Promise<KnownErrorAttachment> {
  const token  = getStoredToken()
  const teamId = getStoredTeamId()
  const headers: Record<string, string> = {}
  if (token)  headers['Authorization'] = `Bearer ${token}`
  if (teamId) headers['X-Team-ID']     = teamId

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE}/uploads/known-errors/${knownErrorId}/attachments`, {
    method: 'POST',
    headers,
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as KnownErrorAttachment
}

export const attachmentsApi = {
  list:   (knownErrorId: string) =>
    get<KnownErrorAttachment[]>(`/uploads/known-errors/${knownErrorId}/attachments`),
  upload: uploadFile,
  delete: (knownErrorId: string, attachId: string) =>
    del(`/uploads/known-errors/${knownErrorId}/attachments/${attachId}`),
  /** Returns the public URL for a stored file (used as <img src> and download link) */
  fileUrl: (filename: string) =>
    `${BASE}/uploads/${filename}`,
}

// ─── Meetings ─────────────────────────────────────────────────────────────────
type MeetingCreateData = {
  title: string
  description?: string
  recurrence: MeetingRecurrence
  dayOfWeek?: number
  meetingTime?: string
  location?: string
}
type MeetingUpdateData = Partial<MeetingCreateData>

type TopicCreateData = { title: string; description?: string; assigneeIds?: string[] }
type TopicUpdateData = Partial<TopicCreateData> & { status?: 'open' | 'closed'; sortOrder?: number }

export const meetingsApi = {
  list:   () => get<Meeting[]>('/meetings'),
  get:    (id: string) => get<Meeting>(`/meetings/${id}`),
  create: (data: MeetingCreateData) => post<Meeting>('/meetings', data),
  update: (id: string, data: MeetingUpdateData) => patch<Meeting>(`/meetings/${id}`, data),
  delete: (id: string) => del(`/meetings/${id}`),

  listTopics:   (meetingId: string, archived?: boolean) =>
    get<MeetingTopic[]>(`/meetings/${meetingId}/topics${archived ? '?archived=true' : ''}`),
  getTopic:     (meetingId: string, topicId: string) =>
    get<MeetingTopic>(`/meetings/${meetingId}/topics/${topicId}`),
  createTopic:  (meetingId: string, data: TopicCreateData) =>
    post<MeetingTopic>(`/meetings/${meetingId}/topics`, data),
  updateTopic:  (meetingId: string, topicId: string, data: TopicUpdateData) =>
    patch<MeetingTopic>(`/meetings/${meetingId}/topics/${topicId}`, data),
  deleteTopic:  (meetingId: string, topicId: string) =>
    del(`/meetings/${meetingId}/topics/${topicId}`),

  listComments:  (meetingId: string, topicId: string) =>
    get<TopicComment[]>(`/meetings/${meetingId}/topics/${topicId}/comments`),
  createComment: (meetingId: string, topicId: string, content: string, authorName?: string) =>
    post<TopicComment>(`/meetings/${meetingId}/topics/${topicId}/comments`, { content, authorName }),
  deleteComment: (meetingId: string, topicId: string, commentId: string) =>
    del(`/meetings/${meetingId}/topics/${topicId}/comments/${commentId}`),
}

// ─── Topic Attachments ────────────────────────────────────────────────────────
async function uploadTopicFile(topicId: string, file: File): Promise<TopicAttachment> {
  const token  = getStoredToken()
  const teamId = getStoredTeamId()
  const headers: Record<string, string> = {}
  if (token)  headers['Authorization'] = `Bearer ${token}`
  if (teamId) headers['X-Team-ID']     = teamId
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/uploads/topics/${topicId}/attachments`, {
    method: 'POST', headers, body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as TopicAttachment
}

export const topicAttachmentsApi = {
  list:    (topicId: string) => get<TopicAttachment[]>(`/uploads/topics/${topicId}/attachments`),
  upload:  uploadTopicFile,
  delete:  (topicId: string, attachId: string) => del(`/uploads/topics/${topicId}/attachments/${attachId}`),
  fileUrl: (filename: string) => `${BASE}/uploads/${filename}`,
}

// ─── Pulse ────────────────────────────────────────────────────────────────────
export const pulseApi = {
  list:    () => get<PulseCheck[]>('/pulse'),
  get:     (id: string) => get<PulseCheck>(`/pulse/${id}`),
  create:  (data: { title: string; questions: string[]; sprintId?: string }) =>
    post<PulseCheck>('/pulse', data),
  respond: (id: string, ratings: number[]) =>
    post<{ ok: boolean }>(`/pulse/${id}/respond`, { ratings }),
  close:   (id: string) =>
    patch<PulseCheck>(`/pulse/${id}`, { closedAt: new Date().toISOString() }),
  delete:  (id: string) => del(`/pulse/${id}`),
}
