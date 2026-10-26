import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

/** Matrix members × responsibilities: who takes part in which rotation. */
export default function RotationParticipantsModal({ isOpen, onClose, canWrite }: { isOpen: boolean; onClose: () => void; canWrite: boolean }) {
  const { t } = useTranslation()
  const types = useStore((s) => s.responsibilityTypes)
  const members = useStore((s) => s.members).filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name))
  const updateResponsibilityType = useStore((s) => s.updateResponsibilityType)
  const [error, setError] = useState('')

  async function toggle(typeId: string, memberId: string, participates: boolean) {
    const rt = types.find((x) => x.id === typeId)
    if (!rt) return
    setError('')
    const excludedMemberIds = participates
      ? rt.excludedMemberIds.filter((id) => id !== memberId)
      : [...rt.excludedMemberIds, memberId]
    try {
      await updateResponsibilityType(typeId, { excludedMemberIds })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('rotation.participants')} size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('rotation.participantsHint')}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {types.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t('rotation.noTypes')}</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="text-left px-4 py-2.5">{t('sprintDetail.memberColumn')}</th>
                  {types.map((rt) => (
                    <th key={rt.id} className="px-2 py-2.5 text-center font-medium leading-tight">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
                        {rt.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={m.name} color={m.avatarColor} size="xs" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                      </div>
                    </td>
                    {types.map((rt) => {
                      const participates = !rt.excludedMemberIds.includes(m.id)
                      return (
                        <td key={rt.id} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={participates}
                            disabled={!canWrite}
                            onChange={(e) => toggle(rt.id, m.id, e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 disabled:opacity-50"
                            aria-label={`${m.name} – ${rt.name}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <td className="px-4 py-2 font-semibold">{t('rotation.participantCount')}</td>
                  {types.map((rt) => (
                    <td key={rt.id} className="px-2 py-2 text-center">
                      {members.filter((m) => !rt.excludedMemberIds.includes(m.id)).length} / {members.length}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
