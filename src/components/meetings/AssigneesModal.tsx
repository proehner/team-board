import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import SearchInput from '@/components/ui/SearchInput'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import type { Team, TeamMember } from '@/types'

interface AssigneesModalProps {
  isOpen: boolean
  onClose: () => void
  pool: TeamMember[]
  teams: Team[]
  /** Group members by team (global meetings) */
  groupByTeam: boolean
  selected: string[]
  /** Persist; throw to keep the dialog open */
  onSave: (ids: string[]) => Promise<void>
}

export default function AssigneesModal({ isOpen, onClose, pool, teams, groupByTeam, selected, onSave }: AssigneesModalProps) {
  const { t } = useTranslation()
  const [draft, setDraft]   = useState<string[]>([])
  const [query, setQuery]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) { setDraft([...selected]); setQuery(''); setSaving(false) }
  }, [isOpen])

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => (q ? pool.filter((m) => m.name.toLowerCase().includes(q)) : pool), [pool, q])

  const groups = useMemo(() => {
    if (!groupByTeam || teams.length === 0) return [{ id: '_all', name: '', members: visible }]
    return teams
      .map((team) => ({ id: team.id, name: team.name, members: visible.filter((m) => m.teamId === team.id) }))
      .filter((g) => g.members.length > 0)
  }, [groupByTeam, teams, visible])

  const dirty = draft.length !== selected.length || draft.some((id) => !selected.includes(id))

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } catch {
      // caller shows a toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!dirty}
      icon={<Users />}
      title={t('meetings.editAssignees')}
      description={t('meetings.selectedCount', { count: draft.length })}
      size="md"
      bodyClassName="px-0 py-0"
      footer={
        <>
          {draft.length > 0 && (
            <Button variant="ghost" className="mr-auto" onClick={() => setDraft([])} disabled={saving}>
              {t('meetings.clearSelection')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={!dirty}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <SearchInput size="sm" value={query} onChange={setQuery} placeholder={t('meetings.searchMembers')} autoFocus />
      </div>
      <div className="px-3 py-2 sm:px-4">
        {pool.length === 0 ? (
          <EmptyState compact icon={<Users />} title={t('meetings.noMembers')} />
        ) : visible.length === 0 ? (
          <EmptyState compact icon={<Users />} title={t('common.noResults')} />
        ) : (
          groups.map((g) => (
            <div key={g.id} className="py-1">
              {g.name && <p className="px-2 pb-1 pt-2 section-label">{g.name}</p>}
              <ul>
                {g.members.map((m) => {
                  const on = draft.includes(m.id)
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(m.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          on
                            ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200'
                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Avatar name={m.name} color={m.avatarColor} size="xs" />
                        <span className="flex-1 truncate font-medium">{m.name}</span>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            on
                              ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
                              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                          }`}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
