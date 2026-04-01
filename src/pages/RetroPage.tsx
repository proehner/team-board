import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, todayISO } from '@/utils/date'
import { Plus, MessageSquare, Trash2, ChevronRight, CheckCircle, Lock } from 'lucide-react'

interface RetroFormData {
  title: string
  date: string
  sprintId: string
  facilitatorId: string
}

export default function RetroPage() {
  const navigate = useNavigate()
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const retrospectives = useStore((s) => s.retrospectives)
  const addRetrospective = useStore((s) => s.addRetrospective)
  const deleteRetrospective = useStore((s) => s.deleteRetrospective)

  const [showModal, setShowModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [filterSprint, setFilterSprint] = useState('')
  const [form, setForm] = useState<RetroFormData>(defaultForm())

  function defaultForm(): RetroFormData {
    const activeSprint = sprints.find((s) => s.status === 'Aktiv')
    return {
      title: activeSprint ? `${activeSprint.name} Retrospektive` : 'Retrospektive',
      date: todayISO(),
      sprintId: activeSprint?.id ?? '',
      facilitatorId: '',
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return
    try {
      const id = await addRetrospective({
        title: form.title,
        date: form.date,
        sprintId: form.sprintId || undefined,
        facilitatorId: form.facilitatorId || undefined,
        isFinalized: false,
      })
      setShowModal(false)
      navigate(`/retro/${id}`)
    } catch {
      alert('Fehler beim Speichern. Bitte prüfe, ob der Server läuft.')
    }
  }

  const sorted = [...retrospectives]
    .filter((r) => !filterSprint || r.sprintId === filterSprint)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Retrospektiven</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{retrospectives.length} gesamt</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { setForm(defaultForm()); setShowModal(true) }}>
          Neue Retrospektive
        </Button>
      </div>

      {/* Sprint filter */}
      {sprints.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Filtern:</span>
          <select
            value={filterSprint}
            onChange={(e) => setFilterSprint(e.target.value)}
            className="form-input py-1 text-xs w-40"
          >
            <option value="">Alle Sprints</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Retro list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-12 h-12" />}
          title="Keine Retrospektiven"
          description="Erstelle deine erste Retrospektive für das Team."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { setForm(defaultForm()); setShowModal(true) }}>Neue Retrospektive</Button>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((retro) => {
            const sprint = retro.sprintId ? sprints.find((s) => s.id === retro.sprintId) : null
            const facilitator = retro.facilitatorId ? members.find((m) => m.id === retro.facilitatorId) : null
            const wellCount = retro.items.filter((i) => i.type === 'GutGelaufen').length
            const improvCount = retro.items.filter((i) => i.type === 'Verbesserung').length
            const actionCount = retro.items.filter((i) => i.type === 'Aktionspunkt').length
            const doneActions = retro.items.filter((i) => i.type === 'Aktionspunkt' && i.status === 'Erledigt').length

            return (
              <div
                key={retro.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group cursor-pointer flex items-start gap-4"
                onClick={() => navigate(`/retro/${retro.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{retro.title}</span>
                    {retro.isFinalized && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" /> Finalisiert
                      </span>
                    )}
                    {sprint && <Badge label={sprint.name} variant="info" />}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mb-3">
                    <span>{formatDate(retro.date)}</span>
                    {facilitator && (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={facilitator.name} color={facilitator.avatarColor} size="xs" />
                        <span>{facilitator.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <ItemCount label="Gut gelaufen" count={wellCount} color="bg-green-100 text-green-700" />
                    <ItemCount label="Verbesserung" count={improvCount} color="bg-amber-100 text-amber-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {actionCount} Aktionspunkte
                      </span>
                      {actionCount > 0 && (
                        <span className="text-xs text-slate-400">
                          <CheckCircle className="w-3.5 h-3.5 inline text-green-500 mr-0.5" />
                          {doneActions}/{actionCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(retro.id) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Neue Retrospektive"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button variant="primary" onClick={handleSubmit}>Erstellen</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Titel</label>
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="form-input" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Datum</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="form-input" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sprint (optional)</label>
            <select value={form.sprintId} onChange={(e) => setForm((f) => ({ ...f, sprintId: e.target.value }))} className="form-input">
              <option value="">Kein Sprint</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Moderator (optional)</label>
            <select value={form.facilitatorId} onChange={(e) => setForm((f) => ({ ...f, facilitatorId: e.target.value }))} className="form-input">
              <option value="">Kein Moderator</option>
              {members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteRetrospective(deleteTarget) }}
        title="Retrospektive löschen"
        message="Möchtest du diese Retrospektive wirklich löschen? Alle Items werden ebenfalls gelöscht."
        confirmLabel="Löschen"
      />
    </div>
  )
}

function ItemCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {count} {label}
    </span>
  )
}
