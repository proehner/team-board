import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { Plus, Search, Edit2, Trash2, Users, Mail, Calendar } from 'lucide-react'
import type { TeamMember, MemberRole } from '@/types'

const ROLES: MemberRole[] = [
  'Developer', 'Senior Developer', 'Tech Lead', 'QA Engineer',
  'DevOps Engineer', 'Product Owner', 'Scrum Master', 'UX Designer',
]

interface MemberFormData {
  name: string
  email: string
  role: MemberRole
  isActive: boolean
}

const defaultForm: MemberFormData = { name: '', email: '', role: 'Developer', isActive: true }

export default function TeamPage() {
  const { t } = useTranslation()
  const members = useStore((s) => s.members)
  const memberSkills = useStore((s) => s.memberSkills)
  const addMember = useStore((s) => s.addMember)
  const updateMember = useStore((s) => s.updateMember)
  const deleteMember = useStore((s) => s.deleteMember)

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<MemberFormData>(defaultForm)
  const [errors, setErrors] = useState<Partial<MemberFormData>>({})

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()),
  )

  function openAdd() {
    setEditTarget(null)
    setForm(defaultForm)
    setErrors({})
    setShowModal(true)
  }

  function openEdit(m: TeamMember) {
    setEditTarget(m)
    setForm({ name: m.name, email: m.email, role: m.role, isActive: m.isActive })
    setErrors({})
    setShowModal(true)
  }

  function validate(): boolean {
    const e: Partial<MemberFormData> = {}
    if (form.name.trim().length < 2) e.name = t('team.nameError')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('team.emailError')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      if (editTarget) {
        await updateMember(editTarget.id, form)
      } else {
        await addMember(form)
      }
      setShowModal(false)
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  const skillCount = (memberId: string) =>
    memberSkills.filter((ms) => ms.memberId === memberId && ms.level > 0).length

  const avgLevel = (memberId: string): number => {
    const ms = memberSkills.filter((s) => s.memberId === memberId && s.level > 0)
    if (ms.length === 0) return 0
    return Math.round(ms.reduce((sum, s) => sum + s.level, 0) / ms.length * 10) / 10
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('team.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('team.activeMembers', { count: members.filter((m) => m.isActive).length })}</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
          {t('team.addMember')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>

      {/* Member grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title={t('team.noMembersFound')}
          description={t('team.noMembersSubtitle')}
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>{t('team.addMember')}</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              skillCount={skillCount(m.id)}
              avgLevel={avgLevel(m.id)}
              onEdit={() => openEdit(m)}
              onDelete={() => setDeleteTarget(m)}
              onToggle={() => updateMember(m.id, { isActive: !m.isActive })}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? t('team.editMember') : t('team.newMember')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSubmit}>{editTarget ? t('common.save') : t('common.add')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('common.name')} error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('team.namePlaceholder')}
              className="form-input"
            />
          </FormField>
          <FormField label={t('common.email')} error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder={t('team.emailPlaceholder')}
              className="form-input"
            />
          </FormField>
          <FormField label={t('common.role')}>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as MemberRole }))}
              className="form-input"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {t('team.activeMember')}
          </label>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMember(deleteTarget.id) }}
        title={t('team.removeMember')}
        message={t('team.removeConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.remove')}
      />
    </div>
  )
}

interface MemberCardProps {
  member: TeamMember
  skillCount: number
  avgLevel: number
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function MemberCard({ member, skillCount, avgLevel, onEdit, onDelete, onToggle }: MemberCardProps) {
  const { t } = useTranslation()
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-5 space-y-4 transition-opacity ${member.isActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} color={member.avatarColor} size="lg" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
            <Badge label={member.role} variant="info" />
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{formatDate(member.joinedAt)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span><span className="font-semibold text-slate-700 dark:text-slate-300">{skillCount}</span></span>
          {avgLevel > 0 && <span>Ø <span className="font-semibold text-slate-700 dark:text-slate-300">{avgLevel}</span></span>}
        </div>
        <button
          onClick={onToggle}
          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
            member.isActive
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {member.isActive ? t('common.active') : t('common.inactive')}
        </button>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
