import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Users, Plus, Pencil, Trash2, ShieldCheck, User, Settings, Monitor, UsersRound, Tag, ShieldAlert,
  Link2, AlertTriangle, SearchX, Check, Info, UserPlus,
} from 'lucide-react'
import { adminApi, groupsApi, teamsApi, ticketCategoriesApi } from '@/api/client'
import type { AdminUser, PermissionGroup, PagePermission, Software, Team, TicketCategory } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import SearchInput from '@/components/ui/SearchInput'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import PasswordInput from '@/components/ui/PasswordInput'
import {
  ALL_PAGES, PERM_OPTIONS, PermBadge, PermSegment, defaultPermFor, optionsFor,
} from '@/components/admin/permissions'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { getMemberDisplayNames } from '@/utils/members'
import { AVATAR_COLORS } from '@/utils/avatar'

// ─── Form state types ──────────────────────────────────────────────────────────
interface UserFormState {
  username:    string
  password:    string
  displayName: string
  role:        'admin' | 'user'
  groupIds:    string[]
  isActive:    boolean
  memberId:    string
}
const emptyUserForm = (): UserFormState => ({
  username: '', password: '', displayName: '', role: 'user',
  groupIds: [], isActive: true, memberId: '',
})

interface GroupFormState {
  name:        string
  description: string
  permissions: Record<string, PagePermission>
  isDefault:   boolean
}
const emptyGroupForm = (): GroupFormState => ({
  name: '', description: '',
  permissions: Object.fromEntries(ALL_PAGES.map((p) => [p.key, defaultPermFor(p)])),
  isDefault: false,
})

interface SoftwareFormState { name: string; vendor: string; version: string; description: string }
const emptySoftwareForm = (): SoftwareFormState => ({ name: '', vendor: '', version: '', description: '' })

const CATEGORY_PRESETS = ['#6366f1', '#0ea5e9', '#14b8a6', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']

type TabKey = 'users' | 'groups' | 'teams' | 'software' | 'ticketCategories'
const TAB_KEYS: TabKey[] = ['users', 'groups', 'teams', 'software', 'ticketCategories']
type UserFilter = 'all' | 'admin' | 'user' | 'inactive'

/** ALL_PAGES grouped as [parent, ...subPermissions] */
const PAGE_CHUNKS = ALL_PAGES.reduce<(typeof ALL_PAGES)[]>((acc, p) => {
  if ((p.hasWriteOwn || p.isSubReadOnly) && acc.length > 0) acc[acc.length - 1].push(p)
  else acc.push([p])
  return acc
}, [])

function hashColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ─── Small layout helpers ──────────────────────────────────────────────────────

/** Inline error box used inside modal forms. */
function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="break-words">{children}</span>
    </div>
  )
}

/** Row actions: edit + delete icon buttons. */
function RowActions({ onEdit, onDelete, editLabel, deleteLabel, deleteDisabled, deleteDisabledReason }: {
  onEdit: () => void
  onDelete: () => void
  editLabel: string
  deleteLabel: string
  deleteDisabled?: boolean
  deleteDisabledReason?: string
}) {
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={<Pencil />} label={editLabel} onClick={onEdit} />
      <span title={deleteDisabled ? deleteDisabledReason : undefined}>
        <IconButton icon={<Trash2 />} label={deleteLabel} variant="danger" onClick={onDelete} disabled={deleteDisabled} />
      </span>
    </div>
  )
}

/** Simple list container with rows (used for teams, software, categories). */
function ListCard({ children }: { children: ReactNode }) {
  return <ul className="surface divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">{children}</ul>
}

function ListRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''}`}
    >
      {children}
    </li>
  )
}

export default function AdminPage() {
  const { t } = useTranslation()
  const currentUser   = useAuthStore((s) => s.user)
  const setTeams      = useAuthStore((s) => s.setTeams)
  const currentTeamId = useAuthStore((s) => s.currentTeamId)

  // Active tab lives in the URL (?tab=groups) so reloads / links keep it.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabKey | null
  const activeTab: TabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'users'
  function setActiveTab(k: TabKey) {
    setSearchParams(k === 'users' ? {} : { tab: k }, { replace: true })
  }
  // Keep the active tab visible in the horizontally scrolling tab bar (mobile, deep links)
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')
    const bar = el?.parentElement
    if (el && bar && bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [activeTab])

  // ─── Users ──────────────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<AdminUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editUser,    setEditUser]    = useState<AdminUser | null>(null)
  const [form,        setForm]        = useState<UserFormState>(emptyUserForm())
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [userSearch,  setUserSearch]  = useState('')
  const [userFilter,  setUserFilter]  = useState<UserFilter>('all')

  // ─── Groups ──────────────────────────────────────────────────────────────────
  const [groups,         setGroups]         = useState<PermissionGroup[]>([])
  const [groupLoading,   setGroupLoading]   = useState(false)
  const [groupModal,     setGroupModal]     = useState(false)
  const [editGroup,      setEditGroup]      = useState<PermissionGroup | null>(null)
  const [groupForm,      setGroupForm]      = useState<GroupFormState>(emptyGroupForm())
  const [groupSaving,    setGroupSaving]    = useState(false)
  const [groupFormError, setGroupFormError] = useState('')
  const [groupDelete,    setGroupDelete]    = useState<PermissionGroup | null>(null)

  // ─── Software ───────────────────────────────────────────────────────────────
  const allMembers     = useStore((s) => s.allMembers)
  const software       = useStore((s) => s.software)
  const addSoftware    = useStore((s) => s.addSoftware)
  const updateSoftware = useStore((s) => s.updateSoftware)
  const deleteSoftware = useStore((s) => s.deleteSoftware)
  const [swModalOpen,  setSwModalOpen]  = useState(false)
  const [editSw,       setEditSw]       = useState<Software | null>(null)
  const [swForm,       setSwForm]       = useState<SoftwareFormState>(emptySoftwareForm())
  const [swFormError,  setSwFormError]  = useState('')
  const [swSaving,     setSwSaving]     = useState(false)
  const [swDeleteTarget, setSwDeleteTarget] = useState<Software | null>(null)

  // ─── Ticket Categories ───────────────────────────────────────────────────────
  const [ticketCats,      setTicketCats]      = useState<TicketCategory[]>([])
  const [catModalOpen,    setCatModalOpen]    = useState(false)
  const [editCat,         setEditCat]         = useState<TicketCategory | null>(null)
  const [catForm,         setCatForm]         = useState({ name: '', color: '#6366f1' })
  const [catFormError,    setCatFormError]    = useState('')
  const [catSaving,       setCatSaving]       = useState(false)
  const [catDeleteTarget, setCatDeleteTarget] = useState<TicketCategory | null>(null)

  // ─── Teams ───────────────────────────────────────────────────────────────────
  const [teamList,       setTeamList]       = useState<Team[]>([])
  const [teamModalOpen,  setTeamModalOpen]  = useState(false)
  const [editTeam,       setEditTeam]       = useState<Team | null>(null)
  const [teamForm,       setTeamForm]       = useState({ name: '', description: '' })
  const [teamFormError,  setTeamFormError]  = useState('')
  const [teamSaving,     setTeamSaving]     = useState(false)
  const [teamDeleteTarget, setTeamDeleteTarget] = useState<Team | null>(null)

  // ─── Data loading ─────────────────────────────────────────────────────────────
  async function loadUsers() {
    try {
      setLoading(true); setError('')
      setUsers(await adminApi.listUsers())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorLoading'))
    } finally { setLoading(false) }
  }

  async function loadGroups() {
    try {
      setGroupLoading(true)
      setGroups(await groupsApi.list())
    } catch { /* ignore */ } finally { setGroupLoading(false) }
  }

  async function loadTeams() {
    try {
      const data = await teamsApi.list()
      setTeamList(data); setTeams(data)
    } catch { /* ignore */ }
  }

  async function loadTicketCats() {
    try { setTicketCats(await ticketCategoriesApi.list()) }
    catch { /* ignore */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); loadGroups(); loadTeams(); loadTicketCats() }, [])

  // ─── Users CRUD ───────────────────────────────────────────────────────────────
  function openCreateUser() {
    setEditUser(null); setForm(emptyUserForm()); setFormError(''); setModalOpen(true)
  }

  function openEditUser(u: AdminUser) {
    setEditUser(u)
    setForm({
      username: u.username, password: '', displayName: u.displayName,
      role: u.role, groupIds: [...(u.groupIds ?? [])], isActive: u.isActive, memberId: u.memberId ?? '',
    })
    setFormError(''); setModalOpen(true)
  }

  async function handleSaveUser(e?: React.FormEvent) {
    e?.preventDefault()
    setFormError('')
    if (!form.username.trim() || !form.displayName.trim()) {
      setFormError(t('admin.usernameDisplayNameRequired')); return
    }
    if (!editUser && !form.password) { setFormError(t('admin.passwordRequired')); return }
    if (form.password && form.password.length < 6) { setFormError(t('admin.passwordMinLength')); return }
    setSaving(true)
    try {
      if (editUser) {
        const updated = await adminApi.updateUser(editUser.id, {
          displayName: form.displayName.trim(),
          role:        form.role,
          groupIds:    form.role === 'admin' ? [] : form.groupIds,
          isActive:    form.isActive,
          password:    form.password || undefined,
          memberId:    form.memberId || null,
        })
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
        toast.success(t('admin.userUpdated'))
      } else {
        const created = await adminApi.createUser({
          username:    form.username.trim(),
          password:    form.password,
          displayName: form.displayName.trim(),
          role:        form.role,
          groupIds:    form.role === 'admin' ? [] : form.groupIds,
          memberId:    form.memberId || null,
        })
        setUsers((prev) => [...prev, created])
        toast.success(t('admin.userCreated'))
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.errorSaving'))
    } finally { setSaving(false) }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    try {
      await adminApi.deleteUser(deleteTarget.id)
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('admin.errorDeleting'), { description: errorMessage(err) })
      throw err
    }
  }

  // ─── Groups CRUD ──────────────────────────────────────────────────────────────
  function openCreateGroup() {
    setEditGroup(null); setGroupForm(emptyGroupForm()); setGroupFormError(''); setGroupModal(true)
  }

  function openEditGroup(g: PermissionGroup) {
    setEditGroup(g)
    setGroupForm({
      name: g.name, description: g.description,
      permissions: { ...Object.fromEntries(ALL_PAGES.map((p) => [p.key, defaultPermFor(p)])), ...g.permissions },
      isDefault: g.isDefault,
    })
    setGroupFormError(''); setGroupModal(true)
  }

  function setGroupPerm(page: string, perm: PagePermission) {
    setGroupForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [page]: perm } }))
  }

  async function handleSaveGroup(e?: React.FormEvent) {
    e?.preventDefault()
    setGroupFormError('')
    if (!groupForm.name.trim()) { setGroupFormError(t('admin.groups.nameRequired')); return }
    setGroupSaving(true)
    try {
      if (editGroup) {
        const updated = await groupsApi.update(editGroup.id, {
          name: groupForm.name.trim(), description: groupForm.description.trim(),
          permissions: groupForm.permissions, isDefault: groupForm.isDefault,
        })
        setGroups((prev) => prev.map((g) => (g.id === editGroup.id ? updated : g)))
        toast.success(t('common.saved'))
      } else {
        const created = await groupsApi.create({
          name: groupForm.name.trim(), description: groupForm.description.trim(),
          permissions: groupForm.permissions, isDefault: groupForm.isDefault,
        })
        setGroups((prev) => [...prev, created])
        toast.success(t('common.created'))
      }
      setGroupModal(false)
    } catch (err) {
      setGroupFormError(err instanceof Error ? err.message : t('admin.errorSaving'))
    } finally { setGroupSaving(false) }
  }

  async function handleDeleteGroup() {
    if (!groupDelete) return
    try {
      await groupsApi.delete(groupDelete.id)
      setGroups((prev) => prev.filter((g) => g.id !== groupDelete.id))
      // Remove this group from local user state too
      setUsers((prev) => prev.map((u) => ({ ...u, groupIds: u.groupIds.filter((gid) => gid !== groupDelete.id) })))
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('admin.errorDeleting'), { description: errorMessage(err) })
      throw err
    }
  }

  // ─── Software ─────────────────────────────────────────────────────────────────
  function openCreateSw() {
    setEditSw(null); setSwForm(emptySoftwareForm()); setSwFormError(''); setSwModalOpen(true)
  }

  function openEditSw(sw: Software) {
    setEditSw(sw)
    setSwForm({ name: sw.name, vendor: sw.vendor ?? '', version: sw.version ?? '', description: sw.description ?? '' })
    setSwFormError(''); setSwModalOpen(true)
  }

  async function handleSaveSw(e?: React.FormEvent) {
    e?.preventDefault()
    setSwFormError('')
    if (!swForm.name.trim()) { setSwFormError(t('admin.software.nameRequired')); return }
    setSwSaving(true)
    try {
      const data = {
        name: swForm.name.trim(),
        vendor: swForm.vendor.trim() || undefined,
        version: swForm.version.trim() || undefined,
        description: swForm.description.trim() || undefined,
      }
      if (editSw) { await updateSoftware(editSw.id, data); toast.success(t('common.saved')) }
      else { await addSoftware(data); toast.success(t('common.created')) }
      setSwModalOpen(false)
    } catch (err) {
      setSwFormError(err instanceof Error ? err.message : t('admin.software.saveError'))
    } finally { setSwSaving(false) }
  }

  async function handleDeleteSw() {
    if (!swDeleteTarget) return
    try {
      await deleteSoftware(swDeleteTarget.id)
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('admin.software.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  // ─── Ticket Categories ────────────────────────────────────────────────────────
  function openCreateCat() {
    setEditCat(null); setCatForm({ name: '', color: '#6366f1' }); setCatFormError(''); setCatModalOpen(true)
  }

  function openEditCat(cat: TicketCategory) {
    setEditCat(cat); setCatForm({ name: cat.name, color: cat.color }); setCatFormError(''); setCatModalOpen(true)
  }

  async function saveCat(e?: React.FormEvent) {
    e?.preventDefault()
    if (!catForm.name.trim()) { setCatFormError(t('admin.ticketCategories.nameRequired')); return }
    setCatSaving(true); setCatFormError('')
    try {
      if (editCat) {
        const updated = await ticketCategoriesApi.update(editCat.id, catForm)
        setTicketCats((prev) => prev.map((c) => (c.id === editCat.id ? updated : c)))
        toast.success(t('common.saved'))
      } else {
        const created = await ticketCategoriesApi.create(catForm)
        setTicketCats((prev) => [...prev, created])
        toast.success(t('common.created'))
      }
      setCatModalOpen(false)
    } catch (err) {
      setCatFormError(err instanceof Error ? err.message : t('admin.errorSaving'))
    } finally { setCatSaving(false) }
  }

  async function confirmDeleteCat() {
    if (!catDeleteTarget) return
    try {
      await ticketCategoriesApi.delete(catDeleteTarget.id)
      setTicketCats((prev) => prev.filter((c) => c.id !== catDeleteTarget.id))
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('admin.errorDeleting'), { description: errorMessage(err) })
      throw err
    }
  }

  // ─── Teams ────────────────────────────────────────────────────────────────────
  function openCreateTeam() {
    setEditTeam(null); setTeamForm({ name: '', description: '' }); setTeamFormError(''); setTeamModalOpen(true)
  }

  function openEditTeam(team: Team) {
    setEditTeam(team); setTeamForm({ name: team.name, description: team.description ?? '' }); setTeamFormError(''); setTeamModalOpen(true)
  }

  async function saveTeam(e?: React.FormEvent) {
    e?.preventDefault()
    if (!teamForm.name.trim()) { setTeamFormError(t('admin.teams.nameRequired')); return }
    setTeamSaving(true); setTeamFormError('')
    try {
      if (editTeam) { await teamsApi.update(editTeam.id, teamForm); toast.success(t('common.saved')) }
      else { await teamsApi.create(teamForm); toast.success(t('common.created')) }
      await loadTeams(); setTeamModalOpen(false)
    } catch (err) {
      setTeamFormError(err instanceof Error ? err.message : t('admin.errorLoading'))
    } finally { setTeamSaving(false) }
  }

  async function confirmDeleteTeam() {
    if (!teamDeleteTarget) return
    try {
      await teamsApi.delete(teamDeleteTarget.id)
      await loadTeams()
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err, t('teams.lastTeamError')) })
      throw err
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function toggleUserGroup(gid: string) {
    setForm((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(gid)
        ? prev.groupIds.filter((id) => id !== gid)
        : [...prev.groupIds, gid],
    }))
  }

  const memberById = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers])

  const userCounts = useMemo(() => ({
    all:      users.length,
    admin:    users.filter((u) => u.role === 'admin').length,
    user:     users.filter((u) => u.role === 'user').length,
    inactive: users.filter((u) => !u.isActive).length,
  }), [users])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter((u) => {
      if (userFilter === 'admin' && u.role !== 'admin') return false
      if (userFilter === 'user' && u.role !== 'user') return false
      if (userFilter === 'inactive' && u.isActive) return false
      if (!q) return true
      const member = u.memberId ? memberById.get(u.memberId) : undefined
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (member?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [users, userSearch, userFilter, memberById])

  const usersFiltered = userSearch.trim() !== '' || userFilter !== 'all'
  function resetUserFilters() { setUserSearch(''); setUserFilter('all') }

  // ─── Render pieces ────────────────────────────────────────────────────────────
  const TABS = [
    { value: 'users'            as TabKey, icon: Users,       label: t('admin.tab.users'),            count: users.length },
    { value: 'groups'           as TabKey, icon: ShieldAlert, label: t('admin.tab.groups'),           count: groups.length },
    { value: 'teams'            as TabKey, icon: UsersRound,  label: t('admin.tab.teams'),            count: teamList.length },
    { value: 'software'         as TabKey, icon: Monitor,     label: t('admin.tab.software'),         count: software.length },
    { value: 'ticketCategories' as TabKey, icon: Tag,         label: t('admin.tab.ticketCategories'), count: ticketCats.length },
  ]

  const primaryAction = {
    users:            <Button variant="primary" icon={<UserPlus />} onClick={openCreateUser}>{t('admin.newUser')}</Button>,
    groups:           <Button variant="primary" icon={<Plus />} onClick={openCreateGroup}>{t('admin.groups.new')}</Button>,
    teams:            <Button variant="primary" icon={<Plus />} onClick={openCreateTeam}>{t('teams.createTeam')}</Button>,
    software:         <Button variant="primary" icon={<Plus />} onClick={openCreateSw}>{t('admin.software.new')}</Button>,
    ticketCategories: <Button variant="primary" icon={<Plus />} onClick={openCreateCat}>{t('admin.ticketCategories.new')}</Button>,
  }[activeTab]

  function userAvatar(u: AdminUser, size: 'sm' | 'md' = 'sm') {
    const member = u.memberId ? memberById.get(u.memberId) : undefined
    return <Avatar name={u.displayName} color={member?.avatarColor ?? hashColor(u.username)} size={size} />
  }

  function userIdentity(u: AdminUser) {
    const member = u.memberId ? memberById.get(u.memberId) : undefined
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">{u.displayName}</span>
          {u.id === currentUser?.id && <Badge variant="indigo" label={t('admin.me')} className="!px-1.5 !py-0 !text-2xs" />}
        </div>
        <p className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">@{u.username}</span>
          {member && (
            <span className="inline-flex min-w-0 items-center gap-1 text-indigo-600 dark:text-indigo-400" title={t('admin.linkedMember')}>
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{member.name}</span>
            </span>
          )}
        </p>
      </div>
    )
  }

  function roleBadge(u: AdminUser) {
    return u.role === 'admin'
      ? <Badge variant="indigo" icon={<ShieldCheck />} label={t('sidebar.administrator')} />
      : <Badge variant="default" icon={<User />} label={t('sidebar.user')} />
  }

  function groupBadges(u: AdminUser) {
    if (u.role === 'admin') {
      return <span className="text-xs text-slate-400 dark:text-slate-500">{t('admin.fullAccess')}</span>
    }
    if ((u.groupIds?.length ?? 0) === 0) {
      return <Badge variant="warning" icon={<AlertTriangle />} label={t('admin.groups.noGroupAssigned')} />
    }
    return (
      <div className="flex flex-wrap gap-1">
        {(u.groupIds ?? []).map((gid) => {
          const g = groups.find((x) => x.id === gid)
          return g ? <Badge key={gid} variant="outline" label={g.name} /> : null
        })}
      </div>
    )
  }

  function statusBadge(u: AdminUser) {
    return u.isActive
      ? <Badge variant="success" dot label={t('common.active')} />
      : <Badge variant="default" dot label={t('common.inactive')} />
  }

  function userRowActions(u: AdminUser) {
    return (
      <RowActions
        onEdit={() => openEditUser(u)}
        onDelete={() => setDeleteTarget(u)}
        editLabel={t('common.edit')}
        deleteLabel={t('admin.deleteUser')}
        deleteDisabled={u.id === currentUser?.id}
        deleteDisabledReason={t('admin.cannotDeleteSelf')}
      />
    )
  }

  const thCls = 'sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 text-left text-xs font-medium text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400'

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Page>
      <PageHeader
        icon={Settings}
        title={t('admin.pageTitle')}
        subtitle={t('admin.pageSubtitle')}
        actions={primaryAction}
      >
        <div ref={tabsRef}>
          <Tabs items={TABS} value={activeTab} onChange={setActiveTab} aria-label={t('admin.pageTitle')} />
        </div>
      </PageHeader>

      {/* ─── Users Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              size="sm"
              value={userSearch}
              onChange={setUserSearch}
              placeholder={t('admin.searchUsers')}
              className="sm:w-72"
            />
            <Tabs
              variant="pills"
              size="sm"
              value={userFilter}
              onChange={setUserFilter}
              aria-label={t('common.filter')}
              items={[
                { value: 'all' as UserFilter,      label: t('common.all'),           count: userCounts.all },
                { value: 'admin' as UserFilter,    label: t('admin.filterAdmins'),   count: userCounts.admin },
                { value: 'user' as UserFilter,     label: t('admin.filterUsers'),    count: userCounts.user },
                { value: 'inactive' as UserFilter, label: t('common.inactive'),      count: userCounts.inactive },
              ]}
            />
          </div>

          {loading ? (
            <SkeletonList rows={5} />
          ) : error ? (
            <div className="surface">
              <EmptyState
                icon={<AlertTriangle />}
                title={t('admin.errorLoading')}
                description={error}
                action={<Button onClick={loadUsers}>{t('common.retry')}</Button>}
              />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon={usersFiltered ? <SearchX /> : <Users />}
                title={usersFiltered ? t('common.noResults') : t('admin.noUsers')}
                action={usersFiltered
                  ? <Button size="sm" onClick={resetUserFilters}>{t('common.resetFilters')}</Button>
                  : <Button variant="primary" icon={<UserPlus />} onClick={openCreateUser}>{t('admin.newUser')}</Button>}
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="surface hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className={`${thCls} w-[36%] rounded-tl-xl pl-5`}>{t('admin.userColumn')}</th>
                      <th scope="col" className={`${thCls} w-40`}>{t('admin.roleColumn')}</th>
                      <th scope="col" className={thCls}>{t('admin.tab.groups')}</th>
                      <th scope="col" className={`${thCls} w-28`}>{t('common.status')}</th>
                      <th scope="col" className={`${thCls} w-24 rounded-tr-xl pr-5 text-right`}><span className="sr-only">{t('common.actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => openEditUser(u)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${u.isActive ? '' : 'opacity-60'}`}
                      >
                        <td className="max-w-0 py-3 pl-5 pr-4">
                          <div className="flex items-center gap-3">
                            {userAvatar(u)}
                            {userIdentity(u)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{roleBadge(u)}</td>
                        <td className="px-4 py-3">{groupBadges(u)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{statusBadge(u)}</td>
                        <td className="py-3 pl-4 pr-4">{userRowActions(u)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="space-y-2 lg:hidden">
                {filteredUsers.map((u) => (
                  <li key={u.id} className={`surface p-4 ${u.isActive ? '' : 'opacity-70'}`}>
                    <div className="flex items-start gap-3">
                      {userAvatar(u, 'md')}
                      <div className="min-w-0 flex-1">{userIdentity(u)}</div>
                      {userRowActions(u)}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[3.25rem]">
                      {roleBadge(u)}
                      {statusBadge(u)}
                      {groupBadges(u)}
                    </div>
                  </li>
                ))}
              </ul>
              {usersFiltered && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('admin.showingUsers', { shown: filteredUsers.length, total: users.length })}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Groups Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (groupLoading ? (
        <SkeletonList rows={3} />
      ) : groups.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<ShieldAlert />}
            title={t('admin.groups.emptyTitle')}
            description={t('admin.groups.empty')}
            action={<Button variant="primary" icon={<Plus />} onClick={openCreateGroup}>{t('admin.groups.new')}</Button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.id} className="surface">
              <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <ShieldCheck className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{g.name}</h3>
                    {g.isDefault && <Badge variant="indigo" icon={<Check />} label={t('admin.groups.default')} />}
                    <Badge variant="default" icon={<Users />} label={t('admin.groups.memberCount', { count: g.memberCount })} />
                  </div>
                  {g.description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{g.description}</p>}
                </div>
                <RowActions
                  onEdit={() => openEditGroup(g)}
                  onDelete={() => setGroupDelete(g)}
                  editLabel={t('admin.groups.edit')}
                  deleteLabel={t('admin.groups.delete')}
                />
              </header>
              <div className="columns-1 gap-x-8 px-5 py-4 sm:columns-2 lg:columns-3">
                {PAGE_CHUNKS.map((chunk) => (
                  // Parent page + its sub-permissions stay together in one column
                  <div key={chunk[0].key} className="break-inside-avoid">
                    {chunk.map((pageEntry) => {
                      const { key, labelKey, hasWriteOwn, isSubReadOnly } = pageEntry
                      const perm = (g.permissions[key] ?? defaultPermFor(pageEntry)) as PagePermission
                      const sub = hasWriteOwn || isSubReadOnly
                      return (
                        <div key={key} className={`flex items-center justify-between gap-2 py-1 ${sub ? 'pl-3' : ''}`}>
                          <span className={`truncate text-sm ${sub ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{t(labelKey)}</span>
                          <PermBadge perm={perm} />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}

      {/* ─── Teams Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'teams' && (teamList.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<UsersRound />}
            title={t('admin.teams.empty')}
            action={<Button variant="primary" icon={<Plus />} onClick={openCreateTeam}>{t('teams.createTeam')}</Button>}
          />
        </div>
      ) : (
        <ListCard>
          {teamList.map((team) => (
            <ListRow key={team.id} onClick={() => openEditTeam(team)}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">{team.name}</span>
                  {team.id === currentTeamId && <Badge variant="success" dot label={t('admin.teams.current')} />}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={team.description}>
                  {team.description || '—'}
                </p>
              </div>
              <RowActions
                onEdit={() => openEditTeam(team)}
                onDelete={() => setTeamDeleteTarget(team)}
                editLabel={t('common.edit')}
                deleteLabel={t('common.delete')}
              />
            </ListRow>
          ))}
        </ListCard>
      ))}

      {/* ─── Software Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'software' && (software.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<Monitor />}
            title={t('admin.software.empty')}
            action={<Button variant="primary" icon={<Plus />} onClick={openCreateSw}>{t('admin.software.new')}</Button>}
          />
        </div>
      ) : (
        <ListCard>
          {software.map((sw) => (
            <ListRow key={sw.id} onClick={() => openEditSw(sw)}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">{sw.name}</span>
                  {sw.version && <Badge variant="outline" label={`v${sw.version}`} className="!py-0 font-mono !text-2xs" />}
                  {sw.vendor && <span className="text-xs text-slate-500 dark:text-slate-400">{sw.vendor}</span>}
                </div>
                {sw.description && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={sw.description}>{sw.description}</p>
                )}
              </div>
              <RowActions
                onEdit={() => openEditSw(sw)}
                onDelete={() => setSwDeleteTarget(sw)}
                editLabel={t('admin.software.edit')}
                deleteLabel={t('admin.software.delete')}
              />
            </ListRow>
          ))}
        </ListCard>
      ))}

      {/* ─── Ticket Categories Tab ──────────────────────────────────────────── */}
      {activeTab === 'ticketCategories' && (ticketCats.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<Tag />}
            title={t('admin.ticketCategories.empty')}
            action={<Button variant="primary" icon={<Plus />} onClick={openCreateCat}>{t('admin.ticketCategories.new')}</Button>}
          />
        </div>
      ) : (
        <ListCard>
          {ticketCats.map((cat) => (
            <ListRow key={cat.id} onClick={() => openEditCat(cat)}>
              <span className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-inset ring-black/10 dark:ring-white/10" style={{ backgroundColor: cat.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{cat.name}</p>
                <p className="font-mono text-xs uppercase text-slate-500 dark:text-slate-400">{cat.color}</p>
              </div>
              <span
                className="hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex"
                style={{ backgroundColor: cat.color + '22', color: cat.color }}
              >
                {cat.name}
              </span>
              <RowActions
                onEdit={() => openEditCat(cat)}
                onDelete={() => setCatDeleteTarget(cat)}
                editLabel={t('admin.ticketCategories.edit')}
                deleteLabel={t('admin.ticketCategories.delete')}
              />
            </ListRow>
          ))}
        </ListCard>
      ))}

      {/* ═══ MODALS ════════════════════════════════════════════════════════════ */}

      {/* User Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? t('admin.editUser') : t('admin.newUser')}
        description={editUser ? `@${editUser.username}` : t('admin.newUserHint')}
        icon={editUser ? <User /> : <UserPlus />}
        size="md"
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="admin-user-form" loading={saving}>
              {editUser ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="admin-user-form" onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.displayName')} htmlFor="au-display" required>
              <input
                id="au-display"
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                className="form-input"
                placeholder="Max Mustermann"
                autoFocus
              />
            </Field>
            <Field label={t('admin.username')} htmlFor="au-username" required={!editUser} hint={editUser ? t('admin.usernameReadonly') : undefined}>
              <input
                id="au-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="form-input"
                placeholder="max.mustermann"
                disabled={!!editUser}
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.password')}
              htmlFor="au-password"
              required={!editUser}
              hint={editUser ? t('admin.passwordHint') : t('admin.passwordMinHint')}
            >
              <PasswordInput
                id="au-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder={editUser ? '••••••••' : ''}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t('common.role')} htmlFor="au-role">
              <Select
                id="au-role"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin' | 'user' }))}
              >
                <option value="user">{t('sidebar.user')}</option>
                <option value="admin">{t('sidebar.administrator')}</option>
              </Select>
            </Field>
          </div>

          <Field label={t('admin.linkedMember')} htmlFor="au-member" hint={t('admin.linkedMemberHint')}>
            <Select
              id="au-member"
              value={form.memberId}
              onChange={(e) => setForm((p) => ({ ...p, memberId: e.target.value }))}
            >
              <option value="">{t('admin.noLinkedMember')}</option>
              {(() => {
                const activeMembers = allMembers.filter((m) => m.isActive)
                const displayNames  = getMemberDisplayNames(activeMembers, teamList)
                return activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>{displayNames.get(m.id) ?? m.name}</option>
                ))
              })()}
            </Select>
          </Field>

          {editUser && (
            <label htmlFor="au-active" className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                id="au-active"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t('admin.userActive')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('admin.userActiveHint')}</span>
              </span>
            </label>
          )}

          {form.role === 'user' ? (
            <fieldset>
              <legend className="form-label">{t('admin.tab.groups')}</legend>
              {groups.length === 0 ? (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('admin.groups.noGroupsYet')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {groups.map((g) => {
                    const checked = form.groupIds.includes(g.id)
                    return (
                      <label
                        key={g.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                          checked
                            ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleUserGroup(g.id)} className="h-4 w-4 rounded border-slate-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{g.name}</p>
                          {g.description && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{g.description}</p>}
                        </div>
                        {g.isDefault && <Badge variant="indigo" label={t('admin.groups.default')} />}
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {t('admin.adminFullAccessHint')}
            </p>
          )}

          {formError && <FormAlert>{formError}</FormAlert>}
        </form>
      </Modal>

      {/* Group Create / Edit Modal */}
      <Modal
        isOpen={groupModal}
        onClose={() => setGroupModal(false)}
        title={editGroup ? t('admin.groups.edit') : t('admin.groups.new')}
        description={t('admin.groups.modalHint')}
        icon={<ShieldCheck />}
        size="lg"
        dismissible={!groupSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGroupModal(false)} disabled={groupSaving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="admin-group-form" loading={groupSaving}>
              {editGroup ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="admin-group-form" onSubmit={handleSaveGroup} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('common.name')} htmlFor="ag-name" required>
              <input
                id="ag-name"
                autoFocus
                type="text"
                value={groupForm.name}
                onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                className="form-input"
                placeholder={t('admin.groups.namePlaceholder')}
              />
            </Field>
            <Field label={t('admin.groups.description')} htmlFor="ag-desc" optional>
              <input
                id="ag-desc"
                type="text"
                value={groupForm.description}
                onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
                className="form-input"
                placeholder={t('admin.groups.descriptionPlaceholder')}
              />
            </Field>
          </div>

          <label htmlFor="ag-default" className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              id="ag-default"
              checked={groupForm.isDefault}
              onChange={(e) => setGroupForm((p) => ({ ...p, isDefault: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t('admin.groups.setDefault')}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t('admin.groups.setDefaultHint')}</span>
            </span>
          </label>

          <fieldset>
            <legend className="form-label">{t('admin.groups.permissions')}</legend>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {ALL_PAGES.map((pageEntry) => {
                const { key, labelKey, hasWriteOwn, isSubReadOnly } = pageEntry
                const sub = hasWriteOwn || isSubReadOnly
                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-2 px-4 py-2 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-800/40 ${
                      sub ? 'bg-slate-50/50 pl-8 dark:bg-slate-800/20' : ''
                    }`}
                  >
                    <span className={`text-sm ${sub ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                      {t(labelKey)}
                    </span>
                    <PermSegment
                      label={t(labelKey)}
                      value={groupForm.permissions[key]}
                      options={optionsFor(pageEntry)}
                      onChange={(v) => setGroupPerm(key, v)}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {PERM_OPTIONS.map(({ value }) => (
                <span key={value} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <PermBadge perm={value} />
                  {t(`admin.groups.perm.${value}Hint`)}
                </span>
              ))}
            </div>
          </fieldset>

          {groupFormError && <FormAlert>{groupFormError}</FormAlert>}
        </form>
      </Modal>

      {/* Group Delete Confirm */}
      <ConfirmDialog
        isOpen={!!groupDelete}
        title={t('admin.groups.delete')}
        message={t('admin.groups.deleteConfirm', { name: groupDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDeleteGroup}
        onClose={() => setGroupDelete(null)}
      />

      {/* User Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('admin.deleteUser')}
        message={t('admin.deleteConfirm', { name: deleteTarget?.displayName ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDeleteUser}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Team Modal */}
      <Modal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        title={editTeam ? t('admin.teams.edit') : t('teams.createTeam')}
        icon={<UsersRound />}
        size="sm"
        dismissible={!teamSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTeamModalOpen(false)} disabled={teamSaving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="admin-team-form" loading={teamSaving}>
              {editTeam ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="admin-team-form" onSubmit={saveTeam} className="space-y-4">
          <Field label={t('teams.teamName')} htmlFor="at-name" required error={teamFormError || undefined}>
            <input
              id="at-name"
              type="text"
              autoFocus
              value={teamForm.name}
              onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              placeholder="Frontend-Team"
            />
          </Field>
          <Field label={t('teams.description')} htmlFor="at-desc" optional>
            <input
              id="at-desc"
              type="text"
              value={teamForm.description}
              onChange={(e) => setTeamForm((p) => ({ ...p, description: e.target.value }))}
              className="form-input"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!teamDeleteTarget}
        title={t('admin.teams.delete')}
        message={<>
          <p>{t('teams.deleteConfirm')}</p>
          {teamDeleteTarget && <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">„{teamDeleteTarget.name}"</p>}
        </>}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteTeam}
        onClose={() => setTeamDeleteTarget(null)}
      />

      {/* Software Modal */}
      <Modal
        isOpen={swModalOpen}
        onClose={() => setSwModalOpen(false)}
        title={editSw ? t('admin.software.edit') : t('admin.software.new')}
        icon={<Monitor />}
        dismissible={!swSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSwModalOpen(false)} disabled={swSaving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="admin-sw-form" loading={swSaving}>
              {editSw ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="admin-sw-form" onSubmit={handleSaveSw} className="space-y-4">
          <Field label={t('common.name')} htmlFor="as-name" required>
            <input
              id="as-name"
              autoFocus
              type="text"
              value={swForm.name}
              onChange={(e) => setSwForm((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              placeholder={t('admin.software.namePlaceholder')}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.software.vendor')} htmlFor="as-vendor" optional>
              <input id="as-vendor" type="text" value={swForm.vendor} onChange={(e) => setSwForm((p) => ({ ...p, vendor: e.target.value }))} className="form-input" />
            </Field>
            <Field label={t('admin.software.version')} htmlFor="as-version" optional>
              <input id="as-version" type="text" value={swForm.version} onChange={(e) => setSwForm((p) => ({ ...p, version: e.target.value }))} className="form-input" placeholder="1.0" />
            </Field>
          </div>
          <Field label={t('admin.software.description')} htmlFor="as-desc" optional>
            <textarea
              id="as-desc"
              value={swForm.description}
              onChange={(e) => setSwForm((p) => ({ ...p, description: e.target.value }))}
              className="form-textarea"
              rows={3}
              placeholder={t('admin.software.descriptionPlaceholder')}
            />
          </Field>
          {swFormError && <FormAlert>{swFormError}</FormAlert>}
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!swDeleteTarget} title={t('admin.software.delete')} message={t('admin.software.deleteConfirm', { name: swDeleteTarget?.name ?? '' })} confirmLabel={t('common.delete')} variant="danger" onConfirm={handleDeleteSw} onClose={() => setSwDeleteTarget(null)} />

      {/* Ticket Category Modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editCat ? t('admin.ticketCategories.edit') : t('admin.ticketCategories.new')}
        icon={<Tag />}
        size="sm"
        dismissible={!catSaving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModalOpen(false)} disabled={catSaving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="admin-cat-form" loading={catSaving}>{t('common.save')}</Button>
          </>
        }
      >
        <form id="admin-cat-form" onSubmit={saveCat} className="space-y-4">
          <Field label={t('common.name')} htmlFor="ac-name" required error={catFormError || undefined}>
            <input
              id="ac-name"
              autoFocus
              type="text"
              value={catForm.name}
              onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              placeholder={t('admin.ticketCategories.namePlaceholder')}
            />
          </Field>
          <fieldset>
            <legend className="form-label">{t('admin.ticketCategories.color')}</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_PRESETS.map((c) => {
                const active = catForm.color.toLowerCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatForm((p) => ({ ...p, color: c }))}
                    aria-label={c}
                    aria-pressed={active}
                    title={c}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900 ${active ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`}
                    style={{ backgroundColor: c }}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                )
              })}
              <label className="relative ml-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 pl-1 pr-2.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" title={t('admin.ticketCategories.customColor')}>
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                  aria-label={t('admin.ticketCategories.customColor')}
                />
                <span className="font-mono uppercase">{catForm.color}</span>
              </label>
            </div>
          </fieldset>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('admin.ticketCategories.preview')}:</span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: catForm.color + '22', color: catForm.color }}>
              {catForm.name || t('admin.ticketCategories.preview')}
            </span>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!catDeleteTarget} title={t('admin.ticketCategories.delete')} message={t('admin.ticketCategories.deleteConfirm', { name: catDeleteTarget?.name ?? '' })} confirmLabel={t('common.delete')} variant="danger" onConfirm={confirmDeleteCat} onClose={() => setCatDeleteTarget(null)} />
    </Page>
  )
}
