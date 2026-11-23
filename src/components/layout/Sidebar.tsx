import { NavLink, useNavigate } from 'react-router-dom'
import {
  Shield, LogOut, ChevronsUpDown, Sun, Moon, X, Search, Check,
  KeyRound, PanelLeftClose, PanelLeftOpen, Languages,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { useStore } from '@/store'
import i18n from '@/i18n'
import ChangePasswordDialog from '@/components/ui/ChangePasswordDialog'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useNavGroups } from './navItems'

interface SidebarProps {
  onClose?: () => void
  onOpenSearch?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export default function Sidebar({ onClose, onOpenSearch, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const { t } = useTranslation()
  const user          = useAuthStore((s) => s.user)
  const logout        = useAuthStore((s) => s.logout)
  const teams         = useAuthStore((s) => s.teams)
  const currentTeamId = useAuthStore((s) => s.currentTeamId)
  const selectTeam    = useAuthStore((s) => s.selectTeam)
  const navigate      = useNavigate()
  const isDark        = useThemeStore((s) => s.isDark)
  const toggleTheme   = useThemeStore((s) => s.toggle)
  const loadAll       = useStore((s) => s.loadAll)

  const [teamMenuOpen, setTeamMenuOpen]             = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const teamRef = useRef<HTMLDivElement>(null)
  const closeTeamMenu = useCallback(() => setTeamMenuOpen(false), [])
  useClickOutside(teamRef, closeTeamMenu, teamMenuOpen)

  const currentTeam = teams.find((tm) => tm.id === currentTeamId)

  function handleSelectTeam(teamId: string) {
    setTeamMenuOpen(false)
    if (teamId === currentTeamId) return
    selectTeam(teamId)
    loadAll()
    navigate('/dashboard', { replace: true })
    onClose?.()
  }

  const navGroups = useNavGroups()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
      collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5'
    } ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
    }`

  const shortcut = isMac ? '⌘K' : 'Ctrl K'

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div className={`flex h-16 shrink-0 items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30 ring-1 ring-inset ring-white/10">
          <Shield className="h-[18px] w-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">Team Board</p>
            <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">Scrum Management</p>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
            aria-label={t('sidebar.closeNavigation')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Team Switcher + Search ─────────────────────────────────────────── */}
      <div className={`space-y-2 pb-3 ${collapsed ? 'px-3' : 'px-3'}`}>
        {teams.length > 0 && (
          <div ref={teamRef} className="relative">
            <button
              onClick={() => setTeamMenuOpen((o) => !o)}
              aria-expanded={teamMenuOpen}
              aria-haspopup="listbox"
              title={collapsed ? currentTeam?.name : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:bg-slate-800 ${
                collapsed ? 'justify-center p-1.5' : 'px-2 py-1.5'
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white dark:from-slate-600 dark:to-slate-700">
                {currentTeam?.name.charAt(0).toUpperCase() ?? '?'}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 leading-none mb-0.5">{t('sidebar.team')}</p>
                    <p className="truncate text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
                      {currentTeam?.name ?? t('teams.selectTitle')}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </>
              )}
            </button>

            {teamMenuOpen && (
              <div
                role="listbox"
                className={`absolute z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-popover animate-slide-down dark:border-slate-700 dark:bg-slate-900 ${
                  collapsed ? 'left-0 w-60' : 'left-0 right-0'
                }`}
              >
                <p className="px-2.5 pb-1 pt-2 section-label">{t('sidebar.switchTeam')}</p>
                {teams.map((team) => {
                  const active = team.id === currentTeamId
                  return (
                    <button
                      key={team.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => handleSelectTeam(team.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{team.name}</p>
                        {team.description && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{team.description}</p>}
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onOpenSearch}
          title={collapsed ? `${t('sidebar.search')} (${shortcut})` : undefined}
          aria-label={t('sidebar.search')}
          className={`group flex w-full items-center gap-2.5 rounded-lg bg-slate-100 text-left transition-colors hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 ${
            collapsed ? 'justify-center h-10' : 'h-9 px-2.5'
          }`}
        >
          <Search className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          {!collapsed && (
            <>
              <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">{t('sidebar.search')}</span>
              <kbd className="kbd [@media(hover:none)]:hidden">{shortcut}</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-3 pb-3" aria-label={t('sidebar.mainNavigation')}>
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : 'mt-1'}>
            {collapsed ? (
              gi > 0 && <div className="mx-auto mb-2 h-px w-8 bg-slate-200 dark:bg-slate-800" />
            ) : (
              <p className="mb-1 px-2.5 section-label !text-slate-400 dark:!text-slate-500">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={navLinkCls}
                  title={collapsed ? label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && (
                        <span className="absolute -left-3 top-1 bottom-1 w-[3px] rounded-r-full bg-indigo-600 dark:bg-indigo-400" aria-hidden />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer: user menu + collapse toggle ────────────────────────────── */}
      <div className={`flex gap-1 border-t border-slate-200 p-3 dark:border-slate-800 ${collapsed ? 'flex-col-reverse items-center' : 'items-center'}`}>
        {user && (
          <DropdownMenu
            side="top"
            align="start"
            width="w-60"
            className={collapsed ? '' : 'min-w-0 flex-1'}
            trigger={(p) => (
              <button
                {...p}
                title={collapsed ? user.displayName : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  collapsed ? 'justify-center p-1' : 'px-2 py-1.5'
                } ${p['aria-expanded'] ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight text-slate-800 dark:text-slate-100">{user.displayName}</p>
                      <p className="truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
                        {user.role === 'admin' ? t('sidebar.administrator') : t('sidebar.user')}
                      </p>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                  </>
                )}
              </button>
            )}
            items={[
              { type: 'label', label: `@${user.username}` },
              {
                label: isDark ? t('sidebar.lightMode') : t('sidebar.darkMode'),
                icon: isDark ? <Sun /> : <Moon />,
                onClick: toggleTheme,
              },
              {
                label: i18n.language?.startsWith('de') ? 'English' : 'Deutsch',
                icon: <Languages />,
                hint: i18n.language?.startsWith('de') ? 'EN' : 'DE',
                onClick: () => i18n.changeLanguage(i18n.language?.startsWith('de') ? 'en' : 'de'),
              },
              {
                label: t('changePassword.title'),
                icon: <KeyRound />,
                onClick: () => setChangePasswordOpen(true),
              },
              { type: 'divider' },
              { label: t('sidebar.logout'), icon: <LogOut />, onClick: handleLogout, danger: true },
            ]}
          />
        )}

        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title={`${collapsed ? t('sidebar.expand') : t('sidebar.collapse')} (${isMac ? '⌘' : 'Ctrl'}+B)`}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>

      <ChangePasswordDialog
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </aside>
  )
}
