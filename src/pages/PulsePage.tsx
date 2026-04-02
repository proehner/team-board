import { useState } from 'react'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { Plus, Activity, Lock, Trash2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PulseCheck } from '@/types'

const DEFAULT_QUESTIONS = [
  'Wie zufrieden bist du mit deiner aktuellen Arbeitslast?',
  'Wie gut fühlt sich die Teamkommunikation an?',
  'Wie motiviert bist du aktuell?',
]

const RATING_LABELS: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

export default function PulsePage() {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const pulseChecks = useStore((s) => s.pulseChecks)
  const createPulse = useStore((s) => s.createPulse)
  const respondPulse = useStore((s) => s.respondPulse)
  const closePulse = useStore((s) => s.closePulse)
  const deletePulse = useStore((s) => s.deletePulse)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRespondModal, setShowRespondModal] = useState<PulseCheck | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PulseCheck | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newQuestions, setNewQuestions] = useState<string[]>(DEFAULT_QUESTIONS)
  const [newSprintId, setNewSprintId] = useState('')
  const [ratings, setRatings] = useState<number[]>([])

  function openCreate() {
    setNewTitle('Pulse Check')
    setNewQuestions([...DEFAULT_QUESTIONS])
    setNewSprintId(sprints.find((s) => s.status === 'Aktiv')?.id ?? '')
    setShowCreateModal(true)
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    try {
      await createPulse({ title: newTitle.trim(), questions: newQuestions.filter((q) => q.trim()), sprintId: newSprintId || undefined })
      setShowCreateModal(false)
    } catch { alert(t('competencies.saveError')) }
  }

  function openRespond(pc: PulseCheck) {
    setRatings(new Array(pc.questions.length).fill(0))
    setShowRespondModal(pc)
  }

  async function handleRespond() {
    if (!showRespondModal) return
    if (ratings.some((r) => r === 0)) { alert('Please answer all questions.'); return }
    try {
      await respondPulse(showRespondModal.id, ratings)
      setShowRespondModal(null)
    } catch { alert(t('competencies.saveError')) }
  }

  const open = pulseChecks.filter((p) => !p.closedAt)
  const closed = pulseChecks.filter((p) => !!p.closedAt)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('pulse.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('pulse.subtitle')}</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('pulse.newCheck')}</Button>
      </div>

      {pulseChecks.length === 0 ? (
        <EmptyState icon={<Activity className="w-12 h-12" />} title={t('pulse.noChecks')} description={t('pulse.noChecksSubtitle')} action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>{t('pulse.newCheck')}</Button>} />
      ) : (
        <div className="space-y-4">
          {open.length > 0 && <>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{t('pulse.active')}</h2>
            {open.map((pc) => <PulseCard key={pc.id} pc={pc} onRespond={() => openRespond(pc)} onClose={() => closePulse(pc.id)} onDelete={() => setDeleteTarget(pc)} />)}
          </>}
          {closed.length > 0 && <>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mt-4">{t('pulse.completed')}</h2>
            {closed.map((pc) => <PulseCard key={pc.id} pc={pc} onDelete={() => setDeleteTarget(pc)} />)}
          </>}
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('pulse.newCheck')}
        footer={<><Button variant="secondary" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={handleCreate}>{t('common.create')}</Button></>}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pulse.titleLabel')}</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="form-input" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pulse.sprintOptional')}</label>
            <select value={newSprintId} onChange={(e) => setNewSprintId(e.target.value)} className="form-input">
              <option value="">{t('pulse.noSprint')}</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pulse.questionsLabel')}</label>
            {newQuestions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={q} onChange={(e) => setNewQuestions((qs) => qs.map((x, j) => j === i ? e.target.value : x))} className="form-input flex-1 text-sm" placeholder={t('pulse.questionLabel', { number: i + 1 })} />
                {newQuestions.length > 1 && <button onClick={() => setNewQuestions((qs) => qs.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600">×</button>}
              </div>
            ))}
            {newQuestions.length < 5 && <button onClick={() => setNewQuestions((qs) => [...qs, ''])} className="text-xs text-indigo-600 hover:underline">{t('pulse.addQuestion')}</button>}
          </div>
          <p className="text-xs text-slate-400">{t('pulse.anonymousNote')}</p>
        </div>
      </Modal>

      {showRespondModal && (
        <Modal isOpen={true} onClose={() => setShowRespondModal(null)} title={showRespondModal.title}
          footer={<><Button variant="secondary" onClick={() => setShowRespondModal(null)}>{t('common.cancel')}</Button><Button variant="primary" icon={<Send className="w-4 h-4" />} onClick={handleRespond}>{t('pulse.submitAnonymously')}</Button></>}>
          <div className="space-y-5">
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-950 dark:text-slate-500 rounded-lg px-3 py-2">{t('pulse.anonymousAnswerNote')}</p>
            {showRespondModal.questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{q}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setRatings((r) => r.map((x, j) => j === i ? v : x))}
                      className={`flex-1 py-3 rounded-xl border-2 text-xl transition-all ${ratings[i] === v ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                      {RATING_LABELS[v]}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 px-1"><span>{t('pulse.veryBad')}</span><span>{t('pulse.veryGood')}</span></div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deletePulse(deleteTarget.id) }} title={t('pulse.deleteCheck')} message={t('pulse.deleteConfirm', { title: deleteTarget?.title ?? '' })} confirmLabel={t('common.delete')} />
    </div>
  )
}

function PulseCard({ pc, onRespond, onClose, onDelete }: { pc: PulseCheck; onRespond?: () => void; onClose?: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === pc.sprintId))
  const isClosed = !!pc.closedAt
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-5 ${isClosed ? 'opacity-75 border-slate-100 dark:border-slate-800' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{pc.title}</span>
            {isClosed ? <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full"><Lock className="w-3 h-3" /> {t('pulse.closed')}</span>
              : <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{t('pulse.active')}</span>}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(pc.createdAt)} · {t('pulse.responses', { count: pc.responseCount })}{sprint ? ` · ${sprint.name}` : ''}</p>
        </div>
        <div className="flex gap-1">
          {!isClosed && onClose && <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><Lock className="w-4 h-4" /></button>}
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {pc.responseCount > 0 && (
        <div className="space-y-2 mb-3">
          {pc.questions.map((q, i) => {
            const avg = pc.averageRatings[i] ?? 0
            const barColor = avg >= 4 ? 'bg-green-400' : avg >= 3 ? 'bg-amber-400' : 'bg-red-400'
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-xs">{q}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2 shrink-0">{avg.toFixed(1)} / 5</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${(avg / 5) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}
      {pc.responseCount === 0 && !isClosed && <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{t('pulse.noResponses')}</p>}
      {!isClosed && onRespond && <Button variant="secondary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={onRespond}>{t('pulse.participate')}</Button>}
    </div>
  )
}
