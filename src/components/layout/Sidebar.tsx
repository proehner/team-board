import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Star, Zap, RefreshCw, MessageSquare, Shield,
  HeartPulse, Activity, Eye, Trophy, Settings, LogOut, ChevronDown,
  Sun, Moon, Bug, X, ChevronRight, CalendarClock, Map, Search,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { useStore } from '@/store'
import i18n from '@/i18n'

interface SidebarProps {
  onClose?: () => void
  onOpenSearch?: () => void
}

export default function Sidebar({ onClose, onOpenSearch }: SidebarProps) {
  const { t } = useTranslation()
  const user          = useAuthStore((s) => s.user)
  const logout        = useAuthStore((s) => s.logout)
  const isAllowed     = useAuthStore((s) => s.isAllowed)
  const teams         = useAuthStore((s) => s.teams)
  const currentTeamId = useAuthStore((s) => s.currentTeamId)
  const selectTeam    = useAuthStore((s) => s.selectTeam)
  const navigate      = useNavigate()
  const isDark        = useThemeStore((s) => s.isDark)
  const toggle        = useThemeStore((s) => s.toggle)
  const loadAll       = useStore((s) => s.loadAll)

  const [teamMenuOpen, setTeamMenuOpen] = useState(false)

  const currentTeam = teams.find((t) => t.id === currentTeamId)

  function handleSelectTeam(teamId: string) {
    selectTeam(teamId)
    setTeamMenuOpen(false)
    loadAll()
    navigate('/dashboard', { replace: true })
    onClose?.()
  }

  const navGroups = [
    {
      items: [
        { to: '/dashboard',     icon: LayoutDashboard, label: t('nav.dashboard'),     page: 'dashboard' },
        { to: '/team',          icon: Users,           label: t('nav.team'),           page: 'team' },
        { to: '/kompetenzen',   icon: Star,            label: t('nav.competencies'),   page: 'kompetenzen' },
      ],
    },
    {
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
      items: [
        { to: '/azure-ranking', icon: Trophy,          label: t('nav.azureRankings'), page: 'azure-ranking' },
        { to: '/known-errors',  icon: Bug,             label: t('nav.knownErrors'),   page: 'known-errors' },
        { to: '/meetings',      icon: CalendarClock,   label: t('nav.meetings'),       page: 'meetings' },
        { to: '/roadmap',       icon: Map,             label: t('nav.roadmap'),        page: 'roadmap' },
      ],
    },
  ]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`

  return (
    <aside className="w-60 shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Logo + close button (mobile) */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Team Board</p>
          <p className="text-xs text-slate-400 leading-tight">Scrum Management</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Navigation schließen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Team Switcher ──────────────────────────────────────────────────── */}
      {teams.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-800 relative">
          <button
            onClick={() => setTeamMenuOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {currentTeam?.name.charAt(0).toUpperCase() ?? '?'}
              </span>
            </div>
            <span className="flex-1 text-xs font-medium text-white truncate">
              {currentTeam?.name ?? t('teams.selectTitle')}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${teamMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {teamMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                    team.id === currentTeamId
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 text-xs font-bold ${
                    team.id === currentTeamId ? 'bg-white/20 text-white' : 'bg-slate-600 text-slate-300'
                  }`}>
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-xs font-medium truncate">{team.name}</span>
                  {team.id === currentTeamId && <ChevronRight className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Search trigger ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-slate-800">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="flex-1 text-xs text-slate-400">Suchen…</span>
          <kbd className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded font-mono">⌃K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter((item) => isAllowed(item.page))
          if (visible.length === 0) return null
          return (
            <div key={gi} className={gi > 0 ? 'mt-1 pt-1 border-t border-slate-800' : ''}>
              {visible.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={onClose} className={navLinkCls}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          )
        })}

        {/* Admin section */}
        {user?.role === 'admin' && (
          <div className="mt-1 pt-1 border-t border-slate-800">
            <NavLink to="/admin" onClick={onClose} className={navLinkCls}>
              <Settings className="w-4 h-4 shrink-0" />
              {t('nav.userManagement')}
            </NavLink>
          </div>
        )}
      </nav>

      {/* User + controls */}
      <div className="px-3 py-3 border-t border-slate-800">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">
                {user.role === 'admin' ? t('sidebar.administrator') : t('sidebar.user')}
              </p>
            </div>
            {/* Theme + Language as icon buttons */}
            <button
              onClick={toggle}
              title={isDark ? t('sidebar.enableLightMode') : t('sidebar.enableDarkMode')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}
              title={t('sidebar.switchLanguage')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 text-xs font-medium"
            >
              {i18n.language === 'de' ? 'EN' : 'DE'}
            </button>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t('sidebar.logout')}
        </button>
      </div>
    </aside>
  )
}
