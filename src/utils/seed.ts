import type { TeamMember, Skill, MemberSkill, Sprint, ResponsibilityAssignment, Retrospective } from '@/types'

export interface SeedData {
  members: Omit<TeamMember, 'id'>[]
  skills: Omit<Skill, 'id'>[]
  memberSkillMatrix: { memberIndex: number; skillIndex: number; level: number }[]
  sprint: Omit<Sprint, 'id' | 'createdAt'>
  assignments: { type: string; memberIndex: number; startDate: string; endDate: string }[]
  retrospective: { title: string; date: string; items: { type: string; text: string }[] }
}

export function getSeedData(): SeedData {
  const today = new Date()
  const sprintStart = new Date(today)
  sprintStart.setDate(today.getDate() - 5)
  const sprintEnd = new Date(sprintStart)
  sprintEnd.setDate(sprintStart.getDate() + 13)

  const prevSprintStart = new Date(sprintStart)
  prevSprintStart.setDate(sprintStart.getDate() - 14)
  const prevSprintEnd = new Date(sprintStart)
  prevSprintEnd.setDate(sprintStart.getDate() - 1)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  return {
    members: [
      { name: 'Anna Müller', email: 'anna.mueller@team.de', role: 'Senior Developer', avatarColor: '#6366f1', joinedAt: '2022-03-15', isActive: true },
      { name: 'Max Berger', email: 'max.berger@team.de', role: 'Developer', avatarColor: '#10b981', joinedAt: '2023-01-10', isActive: true },
      { name: 'Thomas Schulz', email: 'thomas.schulz@team.de', role: 'DevOps Engineer', avatarColor: '#f59e0b', joinedAt: '2021-07-01', isActive: true },
      { name: 'Sarah Koch', email: 'sarah.koch@team.de', role: 'QA Engineer', avatarColor: '#ef4444', joinedAt: '2022-09-20', isActive: true },
      { name: 'David Fischer', email: 'david.fischer@team.de', role: 'Developer', avatarColor: '#8b5cf6', joinedAt: '2023-06-05', isActive: true },
    ],
    skills: [
      { name: 'React', category: 'Frontend', description: 'React-Bibliothek inkl. Hooks und modernes Ökosystem' },
      { name: 'TypeScript', category: 'Frontend', description: 'Typisiertes JavaScript' },
      { name: 'Node.js', category: 'Backend', description: 'Server-seitige JavaScript-Entwicklung' },
      { name: 'PostgreSQL', category: 'Datenbank', description: 'Relationale Datenbankentwicklung' },
      { name: 'Docker', category: 'DevOps', description: 'Containerisierung von Anwendungen' },
      { name: 'Kubernetes', category: 'DevOps', description: 'Container-Orchestrierung' },
      { name: 'Jest / Testing', category: 'Testing', description: 'Unit- und Integrationstests' },
      { name: 'Cypress', category: 'Testing', description: 'End-to-End-Tests im Browser' },
      { name: 'Kommunikation', category: 'Soft Skills', description: 'Klare und effektive Kommunikation im Team' },
      { name: 'Agile / Scrum', category: 'Soft Skills', description: 'Kenntnisse in agilen Methoden' },
    ],
    memberSkillMatrix: [
      // Anna: stark in Frontend
      { memberIndex: 0, skillIndex: 0, level: 5 },
      { memberIndex: 0, skillIndex: 1, level: 5 },
      { memberIndex: 0, skillIndex: 2, level: 3 },
      { memberIndex: 0, skillIndex: 6, level: 4 },
      { memberIndex: 0, skillIndex: 8, level: 4 },
      { memberIndex: 0, skillIndex: 9, level: 4 },
      // Max: Backend-fokussiert
      { memberIndex: 1, skillIndex: 0, level: 3 },
      { memberIndex: 1, skillIndex: 1, level: 4 },
      { memberIndex: 1, skillIndex: 2, level: 5 },
      { memberIndex: 1, skillIndex: 3, level: 4 },
      { memberIndex: 1, skillIndex: 6, level: 3 },
      // Thomas: DevOps
      { memberIndex: 2, skillIndex: 4, level: 5 },
      { memberIndex: 2, skillIndex: 5, level: 4 },
      { memberIndex: 2, skillIndex: 2, level: 3 },
      { memberIndex: 2, skillIndex: 3, level: 3 },
      { memberIndex: 2, skillIndex: 9, level: 3 },
      // Sarah: QA
      { memberIndex: 3, skillIndex: 6, level: 5 },
      { memberIndex: 3, skillIndex: 7, level: 5 },
      { memberIndex: 3, skillIndex: 0, level: 2 },
      { memberIndex: 3, skillIndex: 8, level: 5 },
      { memberIndex: 3, skillIndex: 9, level: 4 },
      // David: Junior Fullstack
      { memberIndex: 4, skillIndex: 0, level: 3 },
      { memberIndex: 4, skillIndex: 1, level: 3 },
      { memberIndex: 4, skillIndex: 2, level: 2 },
      { memberIndex: 4, skillIndex: 3, level: 2 },
      { memberIndex: 4, skillIndex: 6, level: 2 },
    ],
    sprint: {
      name: 'Sprint 1',
      goal: 'Grundlegende Authentifizierung und Dashboard-MVP implementieren',
      startDate: fmt(sprintStart),
      endDate: fmt(sprintEnd),
      status: 'Aktiv',
      plannedPoints: 65,
      capacity: [],
      notes: 'Fokus auf stabile Infrastruktur und erste sichtbare Features.',
    },
    assignments: [
      { type: 'Support-Dienst', memberIndex: 0, startDate: fmt(sprintStart), endDate: fmt(sprintEnd) },
      { type: 'Code-Review-Lead', memberIndex: 2, startDate: fmt(sprintStart), endDate: fmt(sprintEnd) },
      { type: 'Demo-Moderator', memberIndex: 1, startDate: fmt(sprintStart), endDate: fmt(sprintEnd) },
      { type: 'Support-Dienst', memberIndex: 3, startDate: fmt(prevSprintStart), endDate: fmt(prevSprintEnd) },
      { type: 'Code-Review-Lead', memberIndex: 4, startDate: fmt(prevSprintStart), endDate: fmt(prevSprintEnd) },
      { type: 'Demo-Moderator', memberIndex: 0, startDate: fmt(prevSprintStart), endDate: fmt(prevSprintEnd) },
    ],
    retrospective: {
      title: 'Sprint 0 Retrospektive',
      date: fmt(prevSprintEnd),
      items: [
        { type: 'GutGelaufen', text: 'Tägliche Stand-ups waren fokussiert und effizient' },
        { type: 'GutGelaufen', text: 'Code-Reviews wurden zeitnah durchgeführt' },
        { type: 'GutGelaufen', text: 'Gute Zusammenarbeit zwischen Frontend und Backend' },
        { type: 'Verbesserung', text: 'Tickets hatten manchmal unklare Akzeptanzkriterien' },
        { type: 'Verbesserung', text: 'Zu viele Unterbrechungen während der Fokuszeit' },
        { type: 'Aktionspunkt', text: 'Definition of Ready für alle Tickets vor Sprint-Start prüfen' },
        { type: 'Aktionspunkt', text: 'Fokuszeiten im Team-Kalender blockieren (09:00–12:00)' },
      ],
    },
  }
}
