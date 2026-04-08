// ─── Team Members ─────────────────────────────────────────────────────────────

export type MemberRole =
  | 'Developer'
  | 'Senior Developer'
  | 'Tech Lead'
  | 'QA Engineer'
  | 'DevOps Engineer'
  | 'Product Owner'
  | 'Scrum Master'
  | 'UX Designer'

export interface TeamMember {
  id: string
  name: string
  email: string
  roles: MemberRole[]
  avatarColor: string
  joinedAt: string
  isActive: boolean
}

// ─── Competency Matrix ────────────────────────────────────────────────────────

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  0: 'Kein Wissen',
  1: 'Einsteiger',
  2: 'Grundkenntnisse',
  3: 'Fortgeschritten',
  4: 'Experte',
  5: 'Meister',
}

export type SkillCategory =
  | 'Frontend'
  | 'Backend'
  | 'DevOps'
  | 'Testing'
  | 'Datenbank'
  | 'Soft Skills'
  | 'Sonstiges'

export interface Skill {
  id: string
  name: string
  categories: SkillCategory[]
  description?: string
}

export interface MemberSkill {
  memberId: string
  skillId: string
  level: SkillLevel
  updatedAt: string
  notes?: string
}

// ─── Sprints ──────────────────────────────────────────────────────────────────

export type SprintStatus = 'Geplant' | 'Aktiv' | 'Abgeschlossen' | 'Abgebrochen'
export type SprintGoalMet = 'Ja' | 'Teilweise' | 'Nein'

export interface SprintMemberCapacity {
  memberId: string
  availableDays: number
  plannedPoints: number
}

export interface Sprint {
  id: string
  name: string
  goal: string
  startDate: string
  endDate: string
  status: SprintStatus
  velocity?: number
  plannedPoints: number
  plannedItems?: number
  completedItems?: number
  goalMet?: SprintGoalMet
  teamSatisfaction?: number
  impediments: string
  capacityHours?: number
  remainingHours?: number
  averageBurndown?: number
  capacity: SprintMemberCapacity[]
  notes: string
  createdAt: string
}

// ─── Responsibility Rotation ──────────────────────────────────────────────────

export type ResponsibilityType = string

export interface ResponsibilityTypeConfig {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface ResponsibilityAssignment {
  id: string
  type: ResponsibilityType
  memberId: string
  sprintId?: string
  startDate: string
  endDate: string
  notes: string
  isAutoSuggested: boolean
  isSynthetic: boolean
  isArchived: boolean
}

// ─── Retrospectives ───────────────────────────────────────────────────────────

export type RetroItemType = 'GutGelaufen' | 'Verbesserung' | 'Aktionspunkt'
export type RetroItemStatus = 'Offen' | 'InBearbeitung' | 'Erledigt' | 'Extern'

export interface RetroItem {
  id: string
  type: RetroItemType
  text: string
  votes: number
  assigneeId?: string
  status: RetroItemStatus
  dueDate?: string
  ticketUrl?: string | null
}

export interface Retrospective {
  id: string
  sprintId?: string
  title: string
  date: string
  facilitatorId?: string
  items: RetroItem[]
  isFinalized: boolean
  createdAt: string
}

// ─── Known Error DB ───────────────────────────────────────────────────────────

export type KnownErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
export type KnownErrorStatus   = 'open' | 'workaround' | 'resolved'

export interface Software {
  id: string
  name: string
  vendor?: string
  version?: string
  description?: string
}

export interface KnownError {
  id: string
  title: string
  ticketNumber?: string
  description: string
  solution: string
  workaround?: string
  severity: KnownErrorSeverity
  status: KnownErrorStatus
  softwareIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'user'
  forbiddenPages: string[]
}

export interface AdminUser extends AppUser {
  isActive: boolean
  createdAt: string
}

// ─── Pulse Check ─────────────────────────────────────────────────────────────

export interface PulseCheck {
  id: string
  title: string
  questions: string[]
  sprintId?: string
  createdAt: string
  closedAt?: string
  responseCount: number
  averageRatings: number[]
}
