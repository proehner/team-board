import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import { UserCheck } from 'lucide-react'

/** Matrix members × responsibilities: who takes part in which rotation. */
export default function RotationParticipantsModal({ isOpen, onClose, canWrite }: { isOpen: boolean; onClose: () => void; canWrite: boolean }) {
  const { t } = useTranslation()
  const types = useStore((s) => s.responsibilityTypes)
  const members = useStore((s) => s.members).filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name))
  const updateResponsibilityType = useStore((s) => s.updateResponsibilityType)
  const [pending, setPending] = useState<string | null>(null)

  async function toggle(typeId: string, memberId: string, participates: boolean) {
    const rt = types.find((x) => x.id === typeId)
    if (!rt) return
    const excludedMemberIds = participates
      ? rt.excludedMemberIds.filter((id) => id !== memberId)
      : [...rt.excludedMemberIds, memberId]
    setPending(`${typeId}:${memberId}`)
    try {
      await updateResponsibilityType(typeId, { excludedMemberIds })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setPending(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('rotation.participants')}
      description={t('rotation.participantsHint')}
      icon={<UserCheck />}
      size="xl"
      footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}
    >
      {types.length === 0 ? (
        <EmptyState compact icon={<UserCheck />} title={t('rotation.noTypes')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 scrollbar-thin dark:border-slate-700">
          {/* Initial focus anchor: avoids a focus ring on the first checkbox */}
          <div data-autofocus tabIndex={-1} className="sr-only" />
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-left align-bottom dark:border-slate-700 dark:bg-[#162032]"
                >
                  <span className="section-label">{t('sprintDetail.memberColumn')}</span>
                </th>
                {types.map((rt) => (
                  <th
                    key={rt.id}
                    scope="col"
                    className="min-w-[7rem] border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center align-bottom dark:border-slate-700 dark:bg-[#162032]"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                      <span className="line-clamp-2 text-xs font-medium leading-tight text-slate-700 dark:text-slate-300" title={rt.name}>
                        {rt.name}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2 text-left font-normal group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar name={m.name} color={m.avatarColor} size="xs" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                    </div>
                  </th>
                  {types.map((rt) => {
                    const participates = !rt.excludedMemberIds.includes(m.id)
                    const busy = pending === `${rt.id}:${m.id}`
                    return (
                      <td key={rt.id} className="border-b border-slate-100 px-2 py-2 text-center group-hover:bg-slate-50 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                        <label className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${canWrite ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}>
                          {busy ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={participates}
                              disabled={!canWrite || pending !== null}
                              onChange={(e) => toggle(rt.id, m.id, e.target.checked)}
                              className="h-4 w-4 cursor-pointer rounded disabled:cursor-default disabled:opacity-50"
                              aria-label={`${m.name} – ${rt.name}`}
                            />
                          )}
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-2 text-left dark:border-slate-700 dark:bg-[#162032]"
                >
                  <span className="section-label">{t('rotation.participantCount')}</span>
                </th>
                {types.map((rt) => {
                  const count = members.filter((m) => !rt.excludedMemberIds.includes(m.id)).length
                  return (
                    <td key={rt.id} className="bg-slate-50 px-2 py-2 text-center text-xs tabular-nums text-slate-500 dark:bg-[#162032] dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{count}</span> / {members.length}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  )
}
