import { useEffect, useState } from 'react'
import {
  Users, Plus, Pencil, Trash2, ShieldCheck, User, Loader2, Key,
  Monitor, UsersRound, Tag, ShieldAlert, Lock, Unlock, Eye, UserCheck,
} from 'lucide-react'
import { adminApi, groupsApi, teamsApi, ticketCategoriesApi } from '@/api/client'
import type { AdminUser, PermissionGroup, PagePermission, Software, Team, TicketCategory } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'

// ─── Page keys + labels (same order as sidebar) ───────────────────────────────
const ALL_PAGES: { key: string; labelKey: string; hasWriteOwn?: boolean; isSubReadOnly?: boolean }[] = [
  { key: 'dashboard',          labelKey: 'nav.dashboard' },
  { key: 'team',               labelKey: 'nav.team' },
  { key: 'kompetenzen',        labelKey: 'nav.competencies' },
  { key: 'kompetenzen-matrix',        labelKey: 'admin.groups.matrixPermLabel',  hasWriteOwn: true },
  { key: 'kompetenzen-matrix-footer', labelKey: 'admin.groups.footerPermLabel',  isSubReadOnly: true },
  { key: 'sprints',            labelKey: 'nav.sprints' },
  { key: 'rotation',      labelKey: 'nav.rotation' },
  { key: 'retro',         labelKey: 'nav.retrospectives' },
  { key: 'health',        labelKey: 'nav.teamHealth' },
  { key: 'pulse',         labelKey: 'nav.pulseCheck' },
  { key: 'stakeholder',   labelKey: 'nav.stakeholder' },
  { key: 'azure-ranking',         labelKey: 'nav.azureRankings' },
  { key: 'azure-ranking-refresh', labelKey: 'admin.groups.azureRankingRefreshLabel', isSubReadOnly: true },
  { key: 'known-errors',  labelKey: 'nav.knownErrors' },
  { key: 'meetings',      labelKey: 'nav.meetings' },
  { key: 'tickets',       labelKey: 'nav.tickets' },
  { key: 'roadmap',       labelKey: 'nav.roadmap' },
]

// ─── Permission icons / labels ─────────────────────────────────────────────────
const PERM_OPTIONS: { value: PagePermission; icon: React.ReactNode; className: string }[] = [
  { value: 'write',     icon: <Unlock    className="w-3 h-3" />, className: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'write-own', icon: <UserCheck className="w-3 h-3" />, className: 'bg-blue-50  text-blue-700  border-blue-200'  },
  { value: 'read',      icon: <Eye       className="w-3 h-3" />, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'none',      icon: <Lock      className="w-3 h-3" />, className: 'bg-red-50   text-red-700   border-red-200'   },
]
// Standard options without write-own (used for all pages except kompetenzen-matrix)
const PERM_OPTIONS_STANDARD = PERM_OPTIONS.filter((o) => o.value !== 'write-own')
// Matrix options: write-own included, but 'none' excluded (use parent page 'none' to block entirely)
const PERM_OPTIONS_MATRIX = PERM_OPTIONS.filter((o) => o.value !== 'none')
// Sub-read-only options: only read/none (visibility toggle, no write semantics)
const PERM_OPTIONS_READONLY = PERM_OPTIONS.filter((o) => o.value === 'read' || o.value === 'none')

/** Returns the default PagePermission for a page entry (used when the group has no explicit value). */
function defaultPermFor(page: { isSubReadOnly?: boolean }): PagePermission {
  return page.isSubReadOnly ? 'read' : 'write'
}

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

export default function AdminPage() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)
  const setTeams    = useAuthStore((s) => s.setTeams)

  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'software' | 'teams' | 'ticketCategories'>('users')

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

  async function handleSaveUser() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorDeleting'))
    } finally { setDeleteTarget(null) }
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

  async function handleSaveGroup() {
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
      } else {
        const created = await groupsApi.create({
          name: groupForm.name.trim(), description: groupForm.description.trim(),
          permissions: groupForm.permissions, isDefault: groupForm.isDefault,
        })
        setGroups((prev) => [...prev, created])
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorDeleting'))
    } finally { setGroupDelete(null) }
  }

  // ─── Software ─────────────────────────────────────────────────────────────────
  async function handleSaveSw() {
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
      if (editSw) { await updateSoftware(editSw.id, data) }
      else { await addSoftware(data) }
      setSwModalOpen(false)
    } catch (err) {
      setSwFormError(err instanceof Error ? err.message : t('admin.software.saveError'))
    } finally { setSwSaving(false) }
  }

  async function handleDeleteSw() {
    if (!swDeleteTarget) return
    try { await deleteSoftware(swDeleteTarget.id) }
    catch (err) { setError(err instanceof Error ? err.message : t('admin.software.deleteError')) }
    finally { setSwDeleteTarget(null) }
  }

  // ─── Ticket Categories ────────────────────────────────────────────────────────
  async function saveCat() {
    if (!catForm.name.trim()) { setCatFormError(t('admin.ticketCategories.nameRequired')); return }
    setCatSaving(true); setCatFormError('')
    try {
      if (editCat) {
        const updated = await ticketCategoriesApi.update(editCat.id, catForm)
        setTicketCats((prev) => prev.map((c) => (c.id === editCat.id ? updated : c)))
      } else {
        const created = await ticketCategoriesApi.create(catForm)
        setTicketCats((prev) => [...prev, created])
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorDeleting'))
    } finally { setCatDeleteTarget(null) }
  }

  // ─── Teams ────────────────────────────────────────────────────────────────────
  async function saveTeam() {
    if (!teamForm.name.trim()) { setTeamFormError(t('teams.teamName') + ' required.'); return }
    setTeamSaving(true); setTeamFormError('')
    try {
      if (editTeam) { await teamsApi.update(editTeam.id, teamForm) }
      else { await teamsApi.create(teamForm) }
      await loadTeams(); setTeamModalOpen(false)
    } catch (err) {
      setTeamFormError(err instanceof Error ? err.message : t('admin.errorLoading'))
    } finally { setTeamSaving(false) }
  }

  async function confirmDeleteTeam() {
    if (!teamDeleteTarget) return
    try { await teamsApi.delete(teamDeleteTarget.id); await loadTeams() }
    catch (err) { setError(err instanceof Error ? err.message : t('teams.lastTeamError')) }
    finally { setTeamDeleteTarget(null) }
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

  function permIcon(perm: PagePermission) {
    const opt = PERM_OPTIONS.find((o) => o.value === perm)
    return opt ? <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${opt.className}`}>{opt.icon}{t(`admin.groups.perm.${perm}`)}</span> : null
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'users',            icon: <Users       className="w-4 h-4" />, label: t('admin.tab.users') },
    { key: 'groups',           icon: <ShieldAlert className="w-4 h-4" />, label: t('admin.tab.groups') },
    { key: 'teams',            icon: <UsersRound  className="w-4 h-4" />, label: t('teams.manage') },
    { key: 'software',         icon: <Monitor     className="w-4 h-4" />, label: t('admin.tab.software') },
    { key: 'ticketCategories', icon: <Tag         className="w-4 h-4" />, label: t('admin.tab.ticketCategories') },
  ] as const

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.pageTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('admin.pageSubtitle')}</p>
          </div>
        </div>
        <div>
          {activeTab === 'users' && (
            <button onClick={openCreateUser} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t('admin.newUser')}
            </button>
          )}
          {activeTab === 'groups' && (
            <button onClick={openCreateGroup} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t('admin.groups.new')}
            </button>
          )}
          {activeTab === 'software' && (
            <button onClick={() => { setEditSw(null); setSwForm(emptySoftwareForm()); setSwFormError(''); setSwModalOpen(true) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t('admin.software.new')}
            </button>
          )}
          {activeTab === 'teams' && (
            <button onClick={() => { setEditTeam(null); setTeamForm({ name: '', description: '' }); setTeamFormError(''); setTeamModalOpen(true) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t('teams.createTeam')}
            </button>
          )}
          {activeTab === 'ticketCategories' && (
            <button onClick={() => { setEditCat(null); setCatForm({ name: '', color: '#6366f1' }); setCatFormError(''); setCatModalOpen(true) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t('admin.ticketCategories.new')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 flex-wrap">
        {TABS.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* ─── Users Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.userColumn')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.roleColumn')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.tab.groups')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('common.status')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                        {u.role === 'admin' ? <ShieldCheck className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{u.displayName}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                        {u.memberId && (() => {
                          const m = allMembers.find((x) => x.id === u.memberId)
                          return m ? <p className="text-xs text-indigo-500">↳ {m.name}</p> : null
                        })()}
                      </div>
                      {u.id === currentUser?.id && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5 ml-1">{t('admin.me')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                      u.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      {u.role === 'admin' ? t('sidebar.administrator') : t('sidebar.user')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-slate-400">{t('admin.fullAccess')}</span>
                    ) : (u.groupIds?.length ?? 0) === 0 ? (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{t('admin.groups.noGroupAssigned')}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(u.groupIds ?? []).map((gid) => {
                          const g = groups.find((x) => x.id === gid)
                          return g ? (
                            <span key={gid} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
                              {g.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${
                      u.isActive
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}>
                      {u.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEditUser(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        disabled={u.id === currentUser?.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ─── Groups Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (groupLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 py-16 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">{t('admin.groups.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{g.name}</h3>
                    {g.isDefault && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5">{t('admin.groups.default')}</span>
                    )}
                  </div>
                  {g.description && <p className="text-sm text-slate-500 mt-0.5">{g.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">{t('admin.groups.memberCount', { count: g.memberCount })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditGroup(g)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setGroupDelete(g)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ALL_PAGES.map((pageEntry) => {
                  const { key, labelKey } = pageEntry
                  const perm = (g.permissions[key] ?? defaultPermFor(pageEntry)) as PagePermission
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{t(labelKey)}</span>
                      {permIcon(perm)}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ─── Software Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'software' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          {software.length === 0 ? (
            <div className="py-16 text-center text-slate-400"><Monitor className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">{t('admin.software.empty')}</p></div>
          ) : (
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.software.vendor')}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.software.version')}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.software.description')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {software.map((sw) => (
                  <tr key={sw.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                          <Monitor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{sw.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{sw.vendor ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{sw.version ? `v${sw.version}` : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">{sw.description ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditSw(sw); setSwForm({ name: sw.name, vendor: sw.vendor ?? '', version: sw.version ?? '', description: sw.description ?? '' }); setSwFormError(''); setSwModalOpen(true) }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setSwDeleteTarget(sw)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Teams Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'teams' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          {teamList.length === 0 ? (
            <div className="py-16 text-center text-slate-400"><UsersRound className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">{t('teams.selectTitle')}</p></div>
          ) : (
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('teams.teamName')}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('teams.description')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teamList.map((team) => (
                  <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{team.description ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditTeam(team); setTeamForm({ name: team.name, description: team.description ?? '' }); setTeamFormError(''); setTeamModalOpen(true) }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setTeamDeleteTarget(team)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Ticket Categories Tab ──────────────────────────────────────────── */}
      {activeTab === 'ticketCategories' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {ticketCats.length === 0 ? (
            <div className="py-16 text-center text-slate-400"><Tag className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">{t('admin.ticketCategories.empty')}</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('common.name')}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.ticketCategories.color')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ticketCats.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="text-xs font-mono text-slate-500 dark:text-slate-400">{cat.color}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditCat(cat); setCatForm({ name: cat.name, color: cat.color }); setCatFormError(''); setCatModalOpen(true) }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setCatDeleteTarget(cat)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ MODALS ════════════════════════════════════════════════════════════ */}

      {/* User Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? t('common.edit') : t('admin.newUser')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.displayName')}</label>
            <input type="text" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} className="form-input w-full" placeholder="Max Mustermann" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.username')}</label>
            <input type="text" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="form-input w-full" placeholder="max.mustermann" disabled={!!editUser} />
            {editUser && <p className="text-xs text-slate-400 mt-1">{t('admin.usernameReadonly')}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Key className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.password')} {editUser && <span className="text-slate-400 font-normal">({t('admin.passwordHint')})</span>}
            </label>
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="form-input w-full" placeholder={editUser ? '••••••••' : t('admin.passwordMinHint')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.role')}</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin' | 'user' }))} className="form-input w-full">
              <option value="user">{t('sidebar.user')}</option>
              <option value="admin">{t('sidebar.administrator')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.linkedMember')}</label>
            <select value={form.memberId} onChange={(e) => setForm((p) => ({ ...p, memberId: e.target.value }))} className="form-input w-full">
              <option value="">{t('admin.noLinkedMember')}</option>
              {allMembers.filter((m) => m.isActive).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {editUser && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded border-slate-300 text-indigo-600" />
              <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">{t('admin.userActive')}</label>
            </div>
          )}
          {form.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('admin.tab.groups')}</label>
              {groups.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t('admin.groups.noGroupsYet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        form.groupIds.includes(g.id)
                          ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-700'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggleUserGroup(g.id)} className="rounded border-slate-300 text-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{g.name}</p>
                        {g.description && <p className="text-xs text-slate-500 truncate">{g.description}</p>}
                      </div>
                      {g.isDefault && <span className="text-xs bg-indigo-100 text-indigo-600 rounded px-1.5 py-0.5">{t('admin.groups.default')}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
            <button onClick={handleSaveUser} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editUser ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Group Create / Edit Modal */}
      <Modal isOpen={groupModal} onClose={() => setGroupModal(false)} title={editGroup ? t('admin.groups.edit') : t('admin.groups.new')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.name')} *</label>
              <input autoFocus type="text" value={groupForm.name} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} className="form-input w-full" placeholder={t('admin.groups.namePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.groups.description')}</label>
              <input type="text" value={groupForm.description} onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))} className="form-input w-full" placeholder={t('admin.groups.descriptionPlaceholder')} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isDefault" checked={groupForm.isDefault} onChange={(e) => setGroupForm((p) => ({ ...p, isDefault: e.target.checked }))} className="rounded border-slate-300 text-indigo-600" />
            <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">
              {t('admin.groups.setDefault')}
              <span className="ml-1 text-slate-400 font-normal">({t('admin.groups.setDefaultHint')})</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('admin.groups.permissions')}</label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 gap-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('common.page')}</span>
                {PERM_OPTIONS_STANDARD.map(({ value, icon }) => (
                  <span key={value} className="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wide px-2.5">{icon} {t(`admin.groups.perm.${value}`)}</span>
                ))}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ALL_PAGES.map(({ key, labelKey, hasWriteOwn, isSubReadOnly }) => {
                  if (hasWriteOwn) {
                    // Render the matrix row with write/write-own/read (no 'none' — block via parent page)
                    return (
                      <div key={key} className="flex items-center justify-between px-4 py-2.5 pl-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{t(labelKey)}</span>
                        <div className="flex items-center gap-1.5">
                          {PERM_OPTIONS_MATRIX.map(({ value, icon, className }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setGroupPerm(key, value)}
                              title={t(`admin.groups.perm.${value}Hint`)}
                              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border text-xs font-medium transition-all ${
                                groupForm.permissions[key] === value
                                  ? className
                                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {icon} {t(`admin.groups.perm.${value}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  if (isSubReadOnly) {
                    // Render as indented sub-row with read/none only (pure visibility toggle)
                    return (
                      <div key={key} className="flex items-center justify-between px-4 py-2.5 pl-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{t(labelKey)}</span>
                        <div className="flex items-center gap-1.5">
                          {PERM_OPTIONS_READONLY.map(({ value, icon, className }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setGroupPerm(key, value)}
                              title={t(`admin.groups.perm.${value}Hint`)}
                              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border text-xs font-medium transition-all ${
                                groupForm.permissions[key] === value
                                  ? className
                                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {icon} {t(`admin.groups.perm.${value}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={key} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{t(labelKey)}</span>
                      {PERM_OPTIONS_STANDARD.map(({ value, icon, className }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGroupPerm(key, value)}
                          className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border text-xs font-medium transition-all ${
                            groupForm.permissions[key] === value
                              ? className
                              : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {icon} {t(`admin.groups.perm.${value}`)}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {PERM_OPTIONS.map(({ value, icon, className }) => (
                <span key={value} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${className}`}>
                  {icon} {t(`admin.groups.perm.${value}`)}: {t(`admin.groups.perm.${value}Hint`)}
                </span>
              ))}
            </div>
          </div>

          {groupFormError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{groupFormError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setGroupModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
            <button onClick={handleSaveGroup} disabled={groupSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {groupSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editGroup ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
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
      <Modal isOpen={teamModalOpen} onClose={() => setTeamModalOpen(false)} title={editTeam ? t('common.edit') : t('teams.createTeam')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('teams.teamName')}</label>
            <input type="text" value={teamForm.name} onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))} className="form-input w-full" placeholder="Frontend-Team" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('teams.description')}</label>
            <input type="text" value={teamForm.description} onChange={(e) => setTeamForm((p) => ({ ...p, description: e.target.value }))} className="form-input w-full" />
          </div>
          {teamFormError && <p className="text-sm text-red-600">{teamFormError}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setTeamModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">{t('common.cancel')}</button>
            <button onClick={saveTeam} disabled={teamSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {teamSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!teamDeleteTarget} title={t('common.delete')} message={`${t('teams.deleteConfirm')} "${teamDeleteTarget?.name}"?`} onConfirm={confirmDeleteTeam} onClose={() => setTeamDeleteTarget(null)} />

      {/* Software Modal */}
      <Modal isOpen={swModalOpen} onClose={() => setSwModalOpen(false)} title={editSw ? t('admin.software.edit') : t('admin.software.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.name')} *</label>
            <input autoFocus type="text" value={swForm.name} onChange={(e) => setSwForm((p) => ({ ...p, name: e.target.value }))} className="form-input w-full" placeholder="z. B. SAP ERP" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.software.vendor')}</label>
            <input type="text" value={swForm.vendor} onChange={(e) => setSwForm((p) => ({ ...p, vendor: e.target.value }))} className="form-input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.software.version')}</label>
            <input type="text" value={swForm.version} onChange={(e) => setSwForm((p) => ({ ...p, version: e.target.value }))} className="form-input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.software.description')}</label>
            <textarea value={swForm.description} onChange={(e) => setSwForm((p) => ({ ...p, description: e.target.value }))} className="form-input w-full resize-none" rows={3} placeholder={t('admin.software.descriptionPlaceholder')} />
          </div>
          {swFormError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{swFormError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSwModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
            <button onClick={handleSaveSw} disabled={swSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {swSaving && <Loader2 className="w-4 h-4 animate-spin" />}{editSw ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!swDeleteTarget} title={t('admin.software.delete')} message={t('admin.software.deleteConfirm', { name: swDeleteTarget?.name ?? '' })} confirmLabel={t('common.delete')} variant="danger" onConfirm={handleDeleteSw} onClose={() => setSwDeleteTarget(null)} />

      {/* Ticket Category Modal */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={editCat ? t('admin.ticketCategories.edit') : t('admin.ticketCategories.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.name')} *</label>
            <input autoFocus type="text" value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} className="form-input w-full" placeholder={t('admin.ticketCategories.namePlaceholder')} onKeyDown={(e) => e.key === 'Enter' && saveCat()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.ticketCategories.color')}</label>
            <div className="flex items-center gap-3">
              <input type="color" value={catForm.color} onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-800" />
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: catForm.color + '22', color: catForm.color }}>
                {catForm.name || t('admin.ticketCategories.preview')}
              </span>
            </div>
          </div>
          {catFormError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{catFormError}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setCatModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">{t('common.cancel')}</button>
            <button onClick={saveCat} disabled={catSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {catSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!catDeleteTarget} title={t('admin.ticketCategories.delete')} message={t('admin.ticketCategories.deleteConfirm', { name: catDeleteTarget?.name ?? '' })} confirmLabel={t('common.delete')} variant="danger" onConfirm={confirmDeleteCat} onClose={() => setCatDeleteTarget(null)} />
    </div>
  )
}
