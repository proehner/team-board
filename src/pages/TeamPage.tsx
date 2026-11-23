import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import SearchInput from '@/components/ui/SearchInput'
import Avatar from '@/components/ui/Avatar'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SkillLevelBadge from '@/components/ui/SkillLevelBadge'
import { usePagePermission } from '@/hooks/usePagePermission'
import { formatDate } from '@/utils/date'
import {
  Plus, Users, Pencil, Trash2, MoreHorizontal, UserPlus, UserCog, UserCheck, UserMinus, SearchX, Check,
} from 'lucide-react'
import type { TeamMember, MemberRole, SkillLevel } from '@/types'

const ROLES: MemberRole[] = [
  'Developer', 'Senior Developer', 'Tech Lead', 'QA Engineer',
  'DevOps Engineer', 'Product Owner', 'Scrum Master', 'UX Designer',
]

/** Leadership roles get a distinct tint so they stand out in the grid. */
const ROLE_VARIANT: Partial<Record<MemberRole, BadgeVariant>> = {
  'Product Owner': 'purple',
  'Scrum Master': 'info',
  'Tech Lead': 'indigo',
}

type StatusFilter = 'active' | 'inactive' | 'all'

interface MemberFormData {
  name: string
  email: string
  roles: MemberRole[]
  isActive: boolean
}

interface MemberFormErrors {
  name?: string
  email?: string
  roles?: string
}

const defaultForm: MemberFormData = { name: '', email: '', roles: ['Developer'], isActive: true }

export default function TeamPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('team')
  const members = useStore((s) => s.members)
  const memberSkills = useStore((s) => s.memberSkills)
  const addMember = useStore((s) => s.addMember)
  const updateMember = useStore((s) => s.updateMember)
  const deleteMember = useStore((s) => s.deleteMember)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<MemberFormData>(defaultForm)
  const [errors, setErrors] = useState<MemberFormErrors>({})
  const [saving, setSaving] = useState(false)

  // Search applies first so the status tab counts reflect the current query
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...members]
      .filter((m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.roles.some((r) => r.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, search])

  const counts = {
    active: searched.filter((m) => m.isActive).length,
    inactive: searched.filter((m) => !m.isActive).length,
    all: searched.length,
  }
  const filtered = searched.filter((m) => status === 'all' || (status === 'active' ? m.isActive : !m.isActive))
  const activeTotal = members.filter((m) => m.isActive).length
  const isFiltered = !!search.trim() || status !== 'all'

  function resetFilters() {
    setSearch('')
    setStatus('all')
  }

  function openAdd() {
    setEditTarget(null)
    setForm(defaultForm)
    setErrors({})
    setShowModal(true)
  }

  function openEdit(m: TeamMember) {
    setEditTarget(m)
    setForm({ name: m.name, email: m.email, roles: m.roles, isActive: m.isActive })
    setErrors({})
    setShowModal(true)
  }

  function toggleRole(role: MemberRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
    setErrors((e) => ({ ...e, roles: undefined }))
  }

  function validate(): boolean {
    const e: MemberFormErrors = {}
    if (form.name.trim().length < 2) e.name = t('team.nameError')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('team.emailError')
    if (form.roles.length === 0) e.roles = t('team.rolesError')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    try {
      if (editTarget) {
        await updateMember(editTarget.id, form)
        toast.success(t('common.saved'))
      } else {
        await addMember(form)
        toast.success(t('team.memberAdded', { name: form.name.trim() }))
      }
      setShowModal(false)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(m: TeamMember) {
    try {
      await updateMember(m.id, { isActive: !m.isActive })
      toast.success(m.isActive ? t('team.deactivated', { name: m.name }) : t('team.activated', { name: m.name }))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteMember(deleteTarget.id)
      toast.success(t('team.memberRemoved', { name: deleteTarget.name }))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const statsFor = (memberId: string) => {
    const rated = memberSkills.filter((s) => s.memberId === memberId && s.level > 0)
    const avg = rated.length === 0 ? 0 : rated.reduce((sum, s) => sum + s.level, 0) / rated.length
    return { skillCount: rated.length, avgLevel: avg }
  }

  return (
    <Page size="wide">
      <PageHeader
        icon={Users}
        title={t('team.title')}
        subtitle={t('team.activeMembers', { count: activeTotal })}
        actions={canWrite && (
          <Button variant="primary" icon={<Plus />} onClick={openAdd}>
            {t('team.addMember')}
          </Button>
        )}
      >
        {members.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('team.searchPlaceholder')}
              aria-label={t('team.searchPlaceholder')}
              className="w-full sm:w-72"
            />
            <Tabs<StatusFilter>
              variant="pills"
              size="sm"
              value={status}
              onChange={setStatus}
              aria-label={t('team.statusFilter')}
              items={[
                { value: 'active', label: t('team.filterActive'), count: counts.active },
                { value: 'inactive', label: t('team.filterInactive'), count: counts.inactive },
                { value: 'all', label: t('common.all'), count: counts.all },
              ]}
            />
          </div>
        )}
      </PageHeader>

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      {members.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<Users />}
            title={t('team.emptyTitle')}
            description={t('team.noMembersSubtitle')}
            action={canWrite ? <Button variant="primary" icon={<Plus />} onClick={openAdd}>{t('team.addMember')}</Button> : undefined}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<SearchX />}
            title={t('team.noMembersFound')}
            description={status === 'inactive' && !search.trim() ? t('team.noInactiveHint') : t('team.noResultsHint')}
            action={isFiltered ? <Button variant="secondary" onClick={resetFilters}>{t('common.resetFilters')}</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              {...statsFor(m.id)}
              canWrite={canWrite}
              onEdit={() => openEdit(m)}
              onDelete={() => setDeleteTarget(m)}
              onToggle={() => toggleActive(m)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { if (!saving) setShowModal(false) }}
        title={editTarget ? t('team.editMember') : t('team.newMember')}
        description={editTarget ? editTarget.name : t('team.newMemberHint')}
        icon={editTarget ? <UserCog /> : <UserPlus />}
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="member-form" loading={saving}>
              {editTarget ? t('common.save') : t('common.add')}
            </Button>
          </>
        }
      >
        <form id="member-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.name')} htmlFor="member-name" error={errors.name} required>
              <input
                id="member-name"
                type="text"
                autoFocus
                autoComplete="off"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((x) => ({ ...x, name: undefined })) }}
                placeholder={t('team.namePlaceholder')}
                aria-invalid={!!errors.name}
                className="form-input"
              />
            </Field>
            <Field label={t('common.email')} htmlFor="member-email" error={errors.email} required>
              <input
                id="member-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors((x) => ({ ...x, email: undefined })) }}
                placeholder={t('team.emailPlaceholder')}
                aria-invalid={!!errors.email}
                className="form-input"
              />
            </Field>
          </div>

          <fieldset>
            <legend className="form-label">
              {t('team.rolesLabel')}<span className="ml-0.5 text-red-500">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLES.map((r) => {
                const checked = form.roles.includes(r)
                return (
                  <label
                    key={r}
                    className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500/60 ${
                      checked
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-100'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleRole(r)} className="sr-only" />
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-900'
                          : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {r}
                  </label>
                )
              })}
            </div>
            {errors.roles && <p className="form-error">{errors.roles}</p>}
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t('team.activeMember')}</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('team.activeMemberHint')}</span>
            </span>
          </label>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('team.removeMember')}
        message={t('team.removeConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.remove')}
      />
    </Page>
  )
}

interface MemberCardProps {
  member: TeamMember
  skillCount: number
  avgLevel: number
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function MemberCard({ member, skillCount, avgLevel, canWrite, onEdit, onDelete, onToggle }: MemberCardProps) {
  const { t } = useTranslation()
  const inactive = !member.isActive

  return (
    <article
      className={`group relative flex flex-col p-5 ${canWrite ? 'surface-interactive' : 'surface'} ${
        inactive ? 'bg-slate-50/70 dark:bg-slate-900/60' : ''
      }`}
    >
      {/* Whole card opens the editor (stretched button keeps inner links/menus clickable) */}
      {canWrite && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('team.editMemberNamed', { name: member.name })}
          className="absolute inset-0 rounded-xl"
        />
      )}

      <div className="flex-1">
        <div className="flex items-start gap-3.5">
          <Avatar
            name={member.name}
            color={member.avatarColor}
            size="md"
            className={inactive ? 'opacity-50 grayscale' : ''}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                className={`truncate text-sm font-semibold ${inactive ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
                title={member.name}
              >
                {member.name}
              </h3>
              {inactive && <Badge label={t('common.inactive')} variant="outline" dot className="shrink-0" />}
            </div>
            <a
              href={`mailto:${member.email}`}
              title={member.email}
              className="relative z-10 mt-0.5 block w-fit max-w-full truncate rounded text-xs text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              {member.email}
            </a>
          </div>
          {canWrite && (
            <div className="relative z-10 -mr-2 -mt-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <DropdownMenu
                width="w-52"
                trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('common.moreActions')} />}
                items={[
                  { label: t('common.edit'), icon: <Pencil />, onClick: onEdit },
                  inactive
                    ? { label: t('team.activate'), icon: <UserCheck />, onClick: onToggle }
                    : { label: t('team.deactivate'), icon: <UserMinus />, onClick: onToggle },
                  { type: 'divider' },
                  { label: t('common.remove'), icon: <Trash2 />, danger: true, onClick: onDelete },
                ]}
              />
            </div>
          )}
        </div>

        {member.roles.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {member.roles.map((r) => (
              <Badge key={r} label={r} variant={inactive ? 'outline' : ROLE_VARIANT[r] ?? 'default'} />
            ))}
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3.5 dark:border-slate-800">
        <div className="min-w-0" title={t('team.skillsRatedHint')}>
          <dt className="truncate text-2xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('team.statSkills')}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{skillCount}</dd>
        </div>
        <div className="min-w-0" title={t('team.avgLevelHint')}>
          <dt className="truncate text-2xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('team.statAvgLevel')}</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
            {avgLevel > 0 ? (
              <>
                {avgLevel.toFixed(1)}
                <SkillLevelBadge level={Math.round(avgLevel) as SkillLevel} />
              </>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">–</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-2xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('team.statSince')}</dt>
          <dd className="mt-1 truncate text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">{formatDate(member.joinedAt)}</dd>
        </div>
      </dl>
    </article>
  )
}
