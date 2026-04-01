import { useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, ShieldCheck, User, Loader2, Key } from 'lucide-react'
import { adminApi } from '@/api/client'
import type { AdminUser } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'

interface UserFormState {
  username: string
  password: string
  displayName: string
  role: 'admin' | 'user'
  forbiddenPages: string[]
  isActive: boolean
}

const emptyForm = (): UserFormState => ({
  username: '',
  password: '',
  displayName: '',
  role: 'user',
  forbiddenPages: [],
  isActive: true,
})

export default function AdminPage() {
  const { t } = useTranslation()

  const ALL_PAGES: { key: string; label: string }[] = [
    { key: 'dashboard',    label: t('nav.dashboard') },
    { key: 'team',         label: t('nav.team') },
    { key: 'kompetenzen',  label: t('nav.competencies') },
    { key: 'sprints',      label: t('nav.sprints') },
    { key: 'rotation',     label: t('nav.rotation') },
    { key: 'retro',        label: t('nav.retrospectives') },
    { key: 'health',       label: t('nav.teamHealth') },
    { key: 'pulse',        label: t('nav.pulseCheck') },
    { key: 'stakeholder',  label: t('nav.stakeholder') },
    { key: 'azure-ranking', label: t('nav.azureRankings') },
  ]

  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser]   = useState<AdminUser | null>(null)
  const [form, setForm]           = useState<UserFormState>(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  async function loadUsers() {
    try {
      setLoading(true)
      setError('')
      const data = await adminApi.listUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(u: AdminUser) {
    setEditUser(u)
    setForm({
      username:       u.username,
      password:       '',
      displayName:    u.displayName,
      role:           u.role,
      forbiddenPages: [...u.forbiddenPages],
      isActive:       u.isActive,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    setFormError('')
    if (!form.username.trim() || !form.displayName.trim()) {
      setFormError(t('admin.usernameDisplayNameRequired'))
      return
    }
    if (!editUser && !form.password) {
      setFormError(t('admin.passwordRequired'))
      return
    }
    if (form.password && form.password.length < 6) {
      setFormError(t('admin.passwordMinLength'))
      return
    }
    setSaving(true)
    try {
      if (editUser) {
        const updated = await adminApi.updateUser(editUser.id, {
          displayName:    form.displayName.trim(),
          role:           form.role,
          forbiddenPages: form.role === 'admin' ? [] : form.forbiddenPages,
          isActive:       form.isActive,
          password:       form.password || undefined,
        })
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      } else {
        const created = await adminApi.createUser({
          username:       form.username.trim(),
          password:       form.password,
          displayName:    form.displayName.trim(),
          role:           form.role,
          forbiddenPages: form.role === 'admin' ? [] : form.forbiddenPages,
        })
        setUsers((prev) => [...prev, created])
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.errorSaving'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await adminApi.deleteUser(deleteTarget.id)
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errorDeleting'))
    } finally {
      setDeleteTarget(null)
    }
  }

  function toggleForbidden(page: string) {
    setForm((prev) => ({
      ...prev,
      forbiddenPages: prev.forbiddenPages.includes(page)
        ? prev.forbiddenPages.filter((p) => p !== page)
        : [...prev.forbiddenPages, page],
    }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('admin.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('admin.newUser')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.userColumn')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.roleColumn')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('admin.restrictionsColumn')}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{t('common.status')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        {u.role === 'admin'
                          ? <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          : <User className="w-4 h-4 text-slate-500" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{u.displayName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">@{u.username}</p>
                      </div>
                      {u.id === currentUser?.id && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5 ml-1">{t('admin.me')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {u.role === 'admin' ? t('sidebar.administrator') : t('sidebar.user')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">{t('admin.fullAccess')}</span>
                    ) : u.forbiddenPages.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">{t('admin.noRestrictions')}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.forbiddenPages.map((p) => (
                          <span key={p} className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">
                            {ALL_PAGES.find((x) => x.key === p)?.label ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.isActive
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {u.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"
                      >
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
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? t('common.edit') : t('admin.newUser')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.displayName')}</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              className="form-input w-full"
              placeholder="Max Mustermann"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('admin.username')}</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="form-input w-full"
              placeholder="max.mustermann"
              disabled={!!editUser}
            />
            {editUser && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('admin.usernameReadonly')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Key className="w-3.5 h-3.5 inline mr-1" />
              {t('admin.password')} {editUser && <span className="text-slate-400 dark:text-slate-500 font-normal">({t('admin.passwordHint')})</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="form-input w-full"
              placeholder={editUser ? '••••••••' : t('admin.passwordMinHint')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('common.role')}</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin' | 'user' }))}
              className="form-input w-full"
            >
              <option value="user">{t('sidebar.user')}</option>
              <option value="admin">{t('sidebar.administrator')}</option>
            </select>
          </div>

          {editUser && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">{t('admin.userActive')}</label>
            </div>
          )}

          {form.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('admin.restrictedAreas')}
                <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal">({t('admin.restrictedAreasHint')})</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_PAGES.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                      form.forbiddenPages.includes(key)
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.forbiddenPages.includes(key)}
                      onChange={() => toggleForbidden(key)}
                      className="rounded border-slate-300 text-red-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editUser ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('admin.deleteUser')}
        message={t('admin.deleteConfirm', { name: deleteTarget?.displayName ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
