import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Star, Zap, RefreshCw, MessageSquare, Shield,
  HeartPulse, Activity, Eye, Trophy, Settings, LogOut, ChevronRight,
  Sun, Moon,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     page: 'dashboard' },
  { to: '/team',          icon: Users,           label: 'Team',           page: 'team' },
  { to: '/kompetenzen',   icon: Star,            label: 'Kompetenzen',    page: 'kompetenzen' },
  { to: '/sprints',       icon: Zap,             label: 'Sprints',        page: 'sprints' },
  { to: '/rotation',      icon: RefreshCw,       label: 'Rotation',       page: 'rotation' },
  { to: '/retro',         icon: MessageSquare,   label: 'Retrospektiven', page: 'retro' },
  { to: '/health',        icon: HeartPulse,      label: 'Teamgesundheit', page: 'health' },
  { to: '/pulse',         icon: Activity,        label: 'Pulse Check',    page: 'pulse' },
  { to: '/stakeholder',   icon: Eye,             label: 'Stakeholder',    page: 'stakeholder' },
  { to: '/azure-ranking', icon: Trophy,          label: 'Azure Rankings', page: 'azure-ranking' },
]

export default function Sidebar() {
  const user      = useAuthStore((s) => s.user)
  const logout    = useAuthStore((s) => s.logout)
  const isAllowed = useAuthStore((s) => s.isAllowed)
  const navigate  = useNavigate()
  const isDark    = useThemeStore((s) => s.isDark)
  const toggle    = useThemeStore((s) => s.toggle)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const visibleItems = navItems.filter((item) => isAllowed(item.page))

  return (
    <aside className="w-60 shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Team Board</p>
          <p className="text-xs text-slate-400 leading-tight">Scrum Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Admin-Bereich (nur für Admins) */}
        {user?.role === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Administration</p>
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              Benutzerverwaltung
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </NavLink>
          </>
        )}
      </nav>

      {/* User + Theme + Logout */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? 'Light-Modus aktivieren' : 'Dark-Modus aktivieren'}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {isDark
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />
          }
          {isDark ? 'Light-Modus' : 'Dark-Modus'}
        </button>

        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">
                {user.role === 'admin' ? 'Administrator' : 'Benutzer'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Abmelden
        </button>
      </div>
    </aside>
  )
}
