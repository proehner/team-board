import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { Plus, Zap, Calendar, Target, ChevronRight, Edit2, Trash2, Play, CheckCircle, X } from 'lucide-react'
import type { Sprint, SprintStatus } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default',
  Aktiv: 'info',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

type Tab = SprintStatus | 'Alle'

const TABS: Tab[] = ['Alle', 'Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

interface SprintFormData {
  name: string
  goal: string
  startDate: string
  endDate: string
  notes: string
}

export default function SprintsPage() {
  const navigate = useNavigate()
  const sprints = useStore((s) => s.sprints)
  const addSprint = useStore((s) => s.addSprint)
  const updateSprint = useStore((s) => s.updateSprint)
  const deleteSprint = useStore((s) => s.deleteSprint)
  const setSprintStatus = useStore((s) => s.setSprintStatus)

  const [tab, setTab] = useState<Tab>('Alle')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Sprint | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)
  const [form, setForm] = useState<SprintFormData>(defaultForm())
  const [errors, setErrors] = useState<Partial<SprintFormData>>({})

  function defaultForm(): SprintFormData {
    const nextNum = sprints.length + 1
    return { name: `Sprint ${nextNum}`, goal: '', startDate: '', endDate: '', notes: '' }
  }

  const filtered = tab === 'Alle' ? sprints : sprints.filter((s) => s.status === tab)
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function openAdd() {
    setEditTarget(null)
    setForm(defaultForm())
    setErrors({})
    setShowModal(true)
  }

  function openEdit(sp: Sprint) {
    setEditTarget(sp)
    setForm({ name: sp.name, goal: sp.goal, startDate: sp.startDate, endDate: sp.endDate, notes: sp.notes })
    setErrors({})
    setShowModal(true)
  }

  function validate(): boolean {
    const e: Partial<SprintFormData> = {}
    if (!form.name.trim()) e.name = 'Name erforderlich.'
    if (!form.goal.trim()) e.goal = 'Sprint-Ziel erforderlich.'
    if (!form.startDate) e.startDate = 'Startdatum erforderlich.'
    if (!form.endDate) e.endDate = 'Enddatum erforderlich.'
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      e.endDate = 'Enddatum muss nach dem Startdatum liegen.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      if (editTarget) {
        await updateSprint(editTarget.id, form)
      } else {
        const id = await addSprint(form)
        navigate(`/sprints/${id}`)
      }
      setShowModal(false)
    } catch {
      alert('Fehler beim Speichern. Bitte prüfe, ob der Server läuft.')
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sprints</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sprints.length} Sprints gesamt</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
          Neuer Sprint
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((t) => {
          const count = t === 'Alle' ? sprints.length : sprints.filter((s) => s.status === t).length
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sprint list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-12 h-12" />}
          title="Keine Sprints"
          description="Erstelle deinen ersten Sprint, um zu beginnen."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>Neuer Sprint</Button>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((sp) => (
            <SprintCard
              key={sp.id}
              sprint={sp}
              onEdit={() => openEdit(sp)}
              onDelete={() => setDeleteTarget(sp)}
              onStatusChange={(status) => setSprintStatus(sp.id, status)}
              onClick={() => navigate(`/sprints/${sp.id}`)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? 'Sprint bearbeiten' : 'Neuer Sprint'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button variant="primary" onClick={handleSubmit}>{editTarget ? 'Speichern' : 'Erstellen'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" error={errors.name}>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="form-input" />
          </FormField>
          <FormField label="Sprint-Ziel" error={errors.goal}>
            <textarea value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} rows={2} className="form-textarea" placeholder="Was soll in diesem Sprint erreicht werden?" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Startdatum" error={errors.startDate}>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="form-input" />
            </FormField>
            <FormField label="Enddatum" error={errors.endDate}>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="form-input" />
            </FormField>
          </div>
          <FormField label="Notizen (optional)">
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="form-textarea" placeholder="Hinweise, Besonderheiten…" />
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteSprint(deleteTarget.id) }}
        title="Sprint löschen"
        message={`Möchtest du "${deleteTarget?.name}" wirklich löschen?`}
        confirmLabel="Löschen"
      />
    </div>
  )
}

interface SprintCardProps {
  sprint: Sprint
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: SprintStatus) => void
  onClick: () => void
}

function SprintCard({ sprint, onEdit, onDelete, onStatusChange, onClick }: SprintCardProps) {
  const capacityCount = sprint.capacity.length

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-start gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
      <button className="flex-1 text-left" onClick={onClick}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{sprint.name}</span>
            <Badge label={sprint.status} variant={STATUS_VARIANTS[sprint.status]} dot />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <div className="flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-2">
          <Target className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="line-clamp-1">{sprint.goal}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </div>
          <span>{capacityCount} Mitglieder</span>
          {sprint.plannedPoints > 0 && <span>{sprint.plannedPoints} SP geplant</span>}
          {sprint.velocity !== undefined && <span>{sprint.velocity} SP abgeschlossen</span>}
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {sprint.status === 'Geplant' && (
          <button
            title="Sprint starten"
            onClick={() => onStatusChange('Aktiv')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {sprint.status === 'Aktiv' && (
          <button
            title="Sprint abschließen"
            onClick={() => onStatusChange('Abgeschlossen')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
        {sprint.status === 'Aktiv' && (
          <button
            title="Sprint abbrechen"
            onClick={() => onStatusChange('Abgebrochen')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
