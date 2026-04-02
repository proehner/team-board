import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { formatDate, sprintDurationDays } from '@/utils/date'
import { ArrowLeft, Plus, Trash2, Calendar, Target, Users, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SprintStatus } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default', Aktiv: 'info', Abgeschlossen: 'success', Abgebrochen: 'danger',
}

export default function SprintDetailPage() {
  const { t } = useTranslation()
  const { sprintId } = useParams<{ sprintId: string }>()
  const navigate = useNavigate()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members).filter((m) => m.isActive)
  const setMemberCapacity = useStore((s) => s.setMemberCapacity)
  const removeMemberFromSprint = useStore((s) => s.removeMemberFromSprint)
  const updateSprint = useStore((s) => s.updateSprint)
  const setSprintStatus = useStore((s) => s.setSprintStatus)

  const sprint = sprints.find((s) => s.id === sprintId)
  const [addingMemberId, setAddingMemberId] = useState('')
  const [velocityInput, setVelocityInput] = useState('')

  if (!sprint) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-slate-500">{t('sprintDetail.notFound')}</p>
        <Button variant="ghost" onClick={() => navigate('/sprints')} icon={<ArrowLeft className="w-4 h-4" />} className="mt-3">
          {t('common.back')}
        </Button>
      </div>
    )
  }

  const sp = sprint
  const duration = sprintDurationDays(sp.startDate, sp.endDate)
  const totalDays = sp.capacity.reduce((s, c) => s + c.availableDays, 0)
  const totalPoints = sp.capacity.reduce((s, c) => s + c.plannedPoints, 0)

  const capacityMemberIds = new Set(sp.capacity.map((c) => c.memberId))
  const availableToAdd = members.filter((m) => !capacityMemberIds.has(m.id))

  async function handleAddMember() {
    if (!addingMemberId) return
    try {
      await setMemberCapacity(sp.id, addingMemberId, duration <= 10 ? duration : 10, 0)
      setAddingMemberId('')
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  function handleCapacityChange(memberId: string, field: 'availableDays' | 'plannedPoints', value: string) {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) return
    const existing = sp.capacity.find((c) => c.memberId === memberId)
    if (!existing) return
    if (field === 'availableDays') {
      setMemberCapacity(sp.id, memberId, Math.min(num, duration), existing.plannedPoints)
    } else {
      setMemberCapacity(sp.id, memberId, existing.availableDays, num)
    }
  }

  async function handleSaveVelocity() {
    const v = parseInt(velocityInput, 10)
    if (!isNaN(v) && v >= 0) {
      try {
        await updateSprint(sp.id, { velocity: v })
        setVelocityInput('')
      } catch {
        alert(t('competencies.saveError'))
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link to="/sprints" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('sprints.title')}
      </Link>

      {/* Sprint header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{sp.name}</h1>
              <Badge label={t(`sprintStatus.${sp.status}`)} variant={STATUS_VARIANTS[sp.status]} dot />
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(sp.startDate)} – {formatDate(sp.endDate)}
              </div>
            </div>
          </div>
          <select
            value={sp.status}
            onChange={(e) => setSprintStatus(sp.id, e.target.value as SprintStatus)}
            className="form-input w-auto"
          >
            {(['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgebrochen'] as SprintStatus[]).map((s) => (
              <option key={s} value={s}>{t(`sprintStatus.${s}`)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
          <Target className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <p className="text-sm italic">{sp.goal}</p>
        </div>

        {sp.notes && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm text-slate-600 dark:text-slate-400">
            {sp.notes}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label={t('sprintDetail.membersHeader')} value={sp.capacity.length} icon={<Users className="w-4 h-4" />} />
        <StatBox label={t('sprintDetail.availableDays')} value={totalDays} icon={<Calendar className="w-4 h-4" />} />
        <StatBox label={t('sprintDetail.plannedStoryPoints')} value={totalPoints} icon={<Target className="w-4 h-4" />} />
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">{t('sprintDetail.velocity')}</span>
          </div>
          {sp.status === 'Abgeschlossen' ? (
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{sp.velocity ?? '—'}</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={velocityInput}
                onChange={(e) => setVelocityInput(e.target.value)}
                placeholder={sp.velocity?.toString() ?? '0'}
                className="form-input py-1 text-sm w-20"
                min={0}
              />
              <Button size="sm" variant="secondary" onClick={handleSaveVelocity}>OK</Button>
            </div>
          )}
        </div>
      </div>

      {/* Capacity Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {t('sprintDetail.capacityPlanning')}
          </h2>
          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={addingMemberId}
                onChange={(e) => setAddingMemberId(e.target.value)}
                className="form-input py-1 text-sm w-44"
              >
                <option value="">{t('sprintDetail.selectMember')}</option>
                {availableToAdd.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddMember}>
                {t('common.add')}
              </Button>
            </div>
          )}
        </div>

        {sp.capacity.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            {t('sprintDetail.noMembers')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprintDetail.memberColumn')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprintDetail.availableDays')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprintDetail.plannedStoryPoints')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprintDetail.spPerDay')}</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {sp.capacity.map((cap) => {
                  const member = members.find((m) => m.id === cap.memberId)
                  if (!member) return null
                  const spPerDay = cap.availableDays > 0
                    ? Math.round(cap.plannedPoints / cap.availableDays * 10) / 10
                    : 0
                  return (
                    <tr key={cap.memberId} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.name} color={member.avatarColor} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{member.name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{member.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={cap.availableDays}
                          onChange={(e) => handleCapacityChange(member.id, 'availableDays', e.target.value)}
                          min={0}
                          max={duration}
                          className="form-input text-center w-20 mx-auto"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={cap.plannedPoints}
                          onChange={(e) => handleCapacityChange(member.id, 'plannedPoints', e.target.value)}
                          min={0}
                          className="form-input text-center w-20 mx-auto"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${spPerDay > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
                          {spPerDay > 0 ? spPerDay : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeMemberFromSprint(sp.id, member.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold">
                  <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300">{t('sprintDetail.total')}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{totalDays}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">{totalPoints}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">
                    {totalDays > 0 ? Math.round(totalPoints / totalDays * 10) / 10 : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}
