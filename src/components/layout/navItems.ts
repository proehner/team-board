import {
  LayoutDashboard, Users, Star, Zap, RefreshCw, MessageSquare,
  HeartPulse, Activity, Eye, Trophy, Settings, Bug, CalendarClock, Map, Ticket,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  page: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Navigation structure, filtered by the current user's permissions. Shared by Sidebar and command palette. */
export function useNavGroups(): NavGroup[] {
  const { t } = useTranslation()
  const user      = useAuthStore((s) => s.user)
  const isAllowed = useAuthStore((s) => s.isAllowed)

  const groups: NavGroup[] = [
    {
      label: t('nav.groups.overview'),
      items: [
        { to: '/dashboard',     icon: LayoutDashboard, label: t('nav.dashboard'),      page: 'dashboard' },
        { to: '/team',          icon: Users,           label: t('nav.team'),           page: 'team' },
        { to: '/kompetenzen',   icon: Star,            label: t('nav.competencies'),   page: 'kompetenzen' },
      ],
    },
    {
      label: t('nav.groups.scrum'),
      items: [
        { to: '/sprints',       icon: Zap,             label: t('nav.sprints'),        page: 'sprints' },
        { to: '/rotation',      icon: RefreshCw,       label: t('nav.rotation'),       page: 'rotation' },
        { to: '/retro',         icon: MessageSquare,   label: t('nav.retrospectives'), page: 'retro' },
        { to: '/health',        icon: HeartPulse,      label: t('nav.teamHealth'),     page: 'health' },
        { to: '/pulse',         icon: Activity,        label: t('nav.pulseCheck'),     page: 'pulse' },
        { to: '/stakeholder',   icon: Eye,             label: t('nav.stakeholder'),    page: 'stakeholder' },
      ],
    },
    {
      label: t('nav.groups.tools'),
      items: [
        { to: '/azure-ranking', icon: Trophy,          label: t('nav.azureRankings'),  page: 'azure-ranking' },
        { to: '/known-errors',  icon: Bug,             label: t('nav.knownErrors'),    page: 'known-errors' },
        { to: '/meetings',      icon: CalendarClock,   label: t('nav.meetings'),       page: 'meetings' },
        { to: '/tickets',       icon: Ticket,          label: t('nav.tickets'),        page: 'tickets' },
        { to: '/roadmap',       icon: Map,             label: t('nav.roadmap'),        page: 'roadmap' },
      ],
    },
  ]

  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((item) => isAllowed(item.page)) }))
    .filter((g) => g.items.length > 0)

  if (user?.role === 'admin') {
    visible.push({
      label: t('nav.groups.admin'),
      items: [{ to: '/admin', icon: Settings, label: t('nav.userManagement'), page: 'admin' }],
    })
  }
  return visible
}
