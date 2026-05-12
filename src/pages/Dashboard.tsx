import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatDate, daysUntil, isOverdue, isCurrentlyActive } from '@/utils/date'
import { Users, Zap, AlertCircle, Star, ArrowRight, Calendar, Target, TrendingUp, Flag, Globe, Ticket as TicketIcon, Plus, ExternalLink, Pencil, Trash2, X, Loader2, Settings } from 'lucide-react'
import type { SprintGoalMet, SprintStatus, Ticket, TicketPriority, DashboardTile } from '@/types'
import { ticketsApi, dashboardTilesApi } from '@/api/client'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const GOAL_MET_CLASSES: Record<SprintGoalMet, string> = {
  Ja:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Teilweise:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Nein:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const sprintStatusVariant: Record<SprintStatus, 'info' | 'success' | 'default' | 'danger'> = {
  Geplant: 'default',
  Aktiv: 'info',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  high:   'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

const TILE_COLORS: Record<string, { bg: string; light: string; text: string }> = {
  indigo:  { bg: 'bg-indigo-500',  light: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-600 dark:text-indigo-400' },
  violet:  { bg: 'bg-violet-500',  light: 'bg-violet-100 dark:bg-violet-900/40',  text: 'text-violet-600 dark:text-violet-400' },
  sky:     { bg: 'bg-sky-500',     light: 'bg-sky-100 dark:bg-sky-900/40',         text: 'text-sky-600 dark:text-sky-400'       },
  teal:    { bg: 'bg-teal-500',    light: 'bg-teal-100 dark:bg-teal-900/40',       text: 'text-teal-600 dark:text-teal-400'     },
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400'},
  amber:   { bg: 'bg-amber-500',   light: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-600 dark:text-amber-400'   },
  orange:  { bg: 'bg-orange-500',  light: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-600 dark:text-orange-400' },
  rose:    { bg: 'bg-rose-500',    light: 'bg-rose-100 dark:bg-rose-900/40',       text: 'text-rose-600 dark:text-rose-400'     },
  slate:   { bg: 'bg-slate-500',   light: 'bg-slate-100 dark:bg-slate-800',        text: 'text-slate-600 dark:text-slate-400'   },
}

export default function Dashboard() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)
  const members = useStore((s) => s.members)
  const skills = useStore((s) => s.skills)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const retrospectives = useStore((s) => s.retrospectives)
  const responsibilityTypes = useStore((s) => s.responsibilityTypes)

  const [myTickets, setMyTickets] = useState<Ticket[]>([])

  useEffect(() => {
    ticketsApi.list().then((all) => {
      const myMemberId = currentUser?.memberId
      if (!myMemberId) { setMyTickets([]); return }
      setMyTickets(all.filter((t) => t.status !== 'done' && t.assigneeIds?.includes(myMemberId)))
    }).catch(() => {})
  }, [currentUser])

  // ─── Dashboard Tiles ──────────────────────────────────────────────────────────
  const [tiles,        setTiles]        = useState<DashboardTile[]>([])
  const [editMode,     setEditMode]     = useState(false)
  const [tileModal,    setTileModal]    = useState<{ open: boolean; tile?: DashboardTile }>({ open: false })
  const [tileForm,     setTileForm]     = useState({ title: '', url: '', description: '', color: 'indigo', isGlobal: false })
  const [tileSaving,   setTileSaving]   = useState(false)
  const [tileDelete,   setTileDelete]   = useState<DashboardTile | null>(null)

  useEffect(() => {
    dashboardTilesApi.list().then(setTiles).catch(() => {})
  }, [])

  function openCreateTile() {
    setTileForm({ title: '', url: '', description: '', color: 'indigo', isGlobal: false })
    setTileModal({ open: true })
  }

  function openEditTile(tile: DashboardTile) {
    setTileForm({ title: tile.title, url: tile.url, description: tile.description, color: tile.color, isGlobal: tile.isGlobal })
    setTileModal({ open: true, tile })
  }

  async function saveTile() {
    if (!tileForm.title.trim() || !tileForm.url.trim()) return
    setTileSaving(true)
    try {
      if (tileModal.tile) {
        const updated = await dashboardTilesApi.update(tileModal.tile.id, tileForm)
        setTiles((prev) => prev.map((t) => (t.id === tileModal.tile!.id ? updated : t)))
      } else {
        const created = await dashboardTilesApi.create(tileForm)
        setTiles((prev) => [...prev, created])
      }
      setTileModal({ open: false })
    } finally { setTileSaving(false) }
  }

  async function deleteTile() {
    if (!tileDelete) return
    await dashboardTilesApi.delete(tileDelete.id)
    setTiles((prev) => prev.filter((t) => t.id !== tileDelete.id))
    setTileDelete(null)
  }

  const activeMembers = members.filter((m) => m.isActive)
  const activeSprint = sprints.find((s) => s.status === 'Aktiv')

  const openActionItems = retrospectives.flatMap((r) =>
    r.items.filter((i) => i.type === 'Aktionspunkt' && i.status !== 'Erledigt'),
  )

  const currentAssignments = assignments.filter((a) => {
    if (activeSprint) {
      return a.startDate <= activeSprint.endDate && a.endDate >= activeSprint.startDate
    }
    return isCurrentlyActive(a.startDate, a.endDate)
  })

  const daysLeft = activeSprint ? daysUntil(activeSprint.endDate) : null

  const recentSprints = [...sprints]
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, 5)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Quick Access Tiles */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex-1">{t('dashboard.quickAccess')}</h2>
          {editMode && (
            <button
              onClick={openCreateTile}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('dashboard.addTile')}
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? t('common.close') : t('common.edit')}
            className={`p-1.5 rounded-lg transition-colors ${
              editMode
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {tiles.length === 0 ? (
          editMode ? (
            <button
              onClick={openCreateTile}
              className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.noTiles')}
            </button>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2">{t('dashboard.noTiles')}</p>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tiles.map((tile) => {
              const colors   = TILE_COLORS[tile.color] ?? TILE_COLORS.indigo
              const canEdit  = editMode && (tile.userId === currentUser?.id || currentUser?.role === 'admin')
              const internal = tile.url.startsWith('#')
              const href     = tile.url
              return (
                <div key={tile.id} className="relative">
                  <a
                    href={href}
                    {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="flex flex-col items-center justify-center gap-2 p-4 h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all text-center"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 ${colors.bg}`}>
                      {tile.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{tile.title}</p>
                      <p className={`text-xs truncate leading-tight mt-0.5 ${tile.description ? 'text-slate-400' : 'invisible'}`}>
                        {tile.description || '​'}
                      </p>
                    </div>
                    {!internal && <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600 absolute top-2 right-2" />}
                    {tile.isGlobal && (
                      <span title={t('dashboard.tileGlobal')} className="absolute bottom-2 right-2">
                        <Globe className="w-3 h-3 text-indigo-400" />
                      </span>
                    )}
                  </a>
                  {canEdit && (
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-0.5">
                      <button
                        onClick={() => openEditTile(tile)}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setTileDelete(tile)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {editMode && (
              <button
                onClick={openCreateTile}
                className="flex flex-col items-center justify-center gap-2 p-4 h-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs">{t('dashboard.addTile')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label={t('dashboard.activeMembers')}
          value={activeMembers.length.toString()}
          color="indigo"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label={t('dashboard.activeSprint')}
          value={activeSprint?.name ?? '—'}
          sub={daysLeft !== null ? t('dashboard.daysLeft', { count: daysLeft }) : undefined}
          color="green"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          label={t('dashboard.openActionItems')}
          value={openActionItems.length.toString()}
          color="amber"
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label={t('dashboard.skillsInCatalog')}
          value={skills.length.toString()}
          color="purple"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Sprint */}
        <Card
          title={t('dashboard.activeSprint')}
          action={
            activeSprint ? (
              <Link to={`/sprints/${activeSprint.id}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                {t('common.details')} <ArrowRight className="w-3 h-3" />
              </Link>
            ) : undefined
          }
        >
          {activeSprint ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge label={t(`sprintStatus.${activeSprint.status}`)} variant={sprintStatusVariant[activeSprint.status]} dot />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{activeSprint.name}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Target className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="italic">{activeSprint.goal}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {activeSprint.plannedPoints > 0 && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Target className="w-3.5 h-3.5" />
                    {activeSprint.plannedPoints} SP {t('dashboard.planned')}
                  </span>
                )}
                {activeSprint.velocity !== undefined && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {activeSprint.velocity} SP {t('dashboard.velocity')}
                  </span>
                )}
                {activeSprint.goalMet && (
                  <span className={`px-2 py-0.5 rounded-full font-medium ${GOAL_MET_CLASSES[activeSprint.goalMet]}`}>
                    {t(`sprintDetail.goalMet_${activeSprint.goalMet}`)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('dashboard.noActiveSprint')}</p>
          )}
        </Card>

        {/* Current Responsibilities */}
        <Card
          title={t('dashboard.currentResponsibilities')}
          action={
            <Link to="/rotation" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {currentAssignments.length > 0 ? (
            <div className="space-y-2">
              {currentAssignments.map((a) => {
                const member = members.find((m) => m.id === a.memberId)
                if (!member) return null
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: responsibilityTypes.find((t) => t.name === a.type)?.color ?? '#6366f1' }}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-36 shrink-0">{a.type}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{member.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dashboard.noCurrentAssignments')}</p>
          )}
        </Card>

        {/* Sprint History */}
        <Card
          title={t('dashboard.sprintHistory')}
          action={
            <Link to="/sprints" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {recentSprints.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('dashboard.noCompletedSprints')}</p>
          ) : (
            <div className="space-y-3">
              {recentSprints.map((sp) => {
                const velocity = sp.velocity ?? 0
                const planned = sp.plannedPoints
                const maxVal = Math.max(...recentSprints.map((s) => Math.max(s.velocity ?? 0, s.plannedPoints)), 1)
                const barPct = Math.min((velocity / maxVal) * 100, 100)
                const plannedPct = Math.min((planned / maxVal) * 100, 100)
                const hitGoal = velocity > 0 && planned > 0 && velocity >= planned
                return (
                  <div key={sp.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/sprints/${sp.id}`}
                        className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 truncate"
                      >
                        {sp.name}
                      </Link>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sp.goalMet && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${GOAL_MET_CLASSES[sp.goalMet]}`}>
                            {t(`sprintDetail.goalMet_${sp.goalMet}`)}
                          </span>
                        )}
                        {velocity > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {velocity} SP
                          </span>
                        )}
                      </div>
                    </div>
                    {(planned > 0 || velocity > 0) && (
                      <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {planned > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 bg-slate-200 dark:bg-slate-700 rounded-full"
                            style={{ width: `${plannedPct}%` }}
                          />
                        )}
                        {velocity > 0 && (
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${hitGoal ? 'bg-green-400' : 'bg-indigo-400'}`}
                            style={{ width: `${barPct}%` }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* My Open Tickets */}
        <Card
          title={t('dashboard.myOpenTickets')}
          action={
            <Link to="/tickets" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {myTickets.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('dashboard.noMyOpenTickets')}</p>
          ) : (
            <div className="space-y-2">
              {myTickets.slice(0, 6).map((ticket) => (
                <div key={ticket.id} className="flex items-start gap-2.5">
                  <TicketIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug truncate">{ticket.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${PRIORITY_BADGE[ticket.priority]}`}>
                        <Flag className="w-2.5 h-2.5" />
                        {t(`tickets.priority.${ticket.priority}`)}
                      </span>
                      {ticket.isGlobal && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                          <Globe className="w-2.5 h-2.5" />
                          {t('tickets.global')}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{t(`tickets.status.${ticket.status}`)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {myTickets.length > 6 && (
                <p className="text-xs text-slate-400 pt-1">{t('dashboard.moreItems', { count: myTickets.length - 6 })}</p>
              )}
            </div>
          )}
        </Card>

        {/* Open Action Items */}
        <Card
          title={t('dashboard.openActionItems')}
          action={
            <Link to="/retro" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.all')} <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {openActionItems.length > 0 ? (
            <div className="space-y-2">
              {openActionItems.slice(0, 5).map((item) => {
                const assignee = item.assigneeId ? members.find((m) => m.id === item.assigneeId) : null
                const overdue = item.dueDate ? isOverdue(item.dueDate) : false
                return (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.status === 'InBearbeitung' ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {assignee && (
                          <span className="text-xs text-slate-400">{assignee.name}</span>
                        )}
                        {item.dueDate && (
                          <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                            {overdue ? t('dashboard.overdue') : t('dashboard.due', { date: formatDate(item.dueDate) })}
                          </span>
                        )}
                        <Badge
                          label={t(`retroItemStatus.${item.status}`)}
                          variant={item.status === 'InBearbeitung' ? 'warning' : 'default'}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {openActionItems.length > 5 && (
                <p className="text-xs text-slate-400 pt-1">{t('dashboard.moreItems', { count: openActionItems.length - 5 })}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('dashboard.noOpenActionItems')}</p>
          )}
        </Card>
      </div>

      {/* Tile Create / Edit Modal */}
      {tileModal.open && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setTileModal({ open: false })}>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {tileModal.tile ? t('dashboard.editTile') : t('dashboard.addTile')}
              </h2>
              <button onClick={() => setTileModal({ open: false })} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.tileTitle')} *</label>
                <input
                  autoFocus
                  value={tileForm.title}
                  onChange={(e) => setTileForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Jira"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.tileUrl')} *</label>
                <input
                  value={tileForm.url}
                  onChange={(e) => setTileForm((p) => ({ ...p, url: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://jira.example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.tileDescription')}</label>
                <input
                  value={tileForm.description}
                  onChange={(e) => setTileForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Issue-Tracking"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{t('dashboard.tileColor')}</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TILE_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTileForm((p) => ({ ...p, color: key }))}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all ${tileForm.color === key ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tileForm.isGlobal}
                  onChange={(e) => setTileForm((p) => ({ ...p, isGlobal: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    {t('dashboard.tileGlobal')}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.tileGlobalHint')}</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setTileModal({ open: false })} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={saveTile}
                disabled={!tileForm.title.trim() || !tileForm.url.trim() || tileSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {tileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tileModal.tile ? t('common.save') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!tileDelete}
        title={t('dashboard.deleteTile')}
        message={t('dashboard.deleteTileConfirm', { title: tileDelete?.title ?? '' })}
        onConfirm={deleteTile}
        onClose={() => setTileDelete(null)}
        variant="danger"
      />
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: 'indigo' | 'green' | 'amber' | 'purple'
}

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
