import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatDate } from '@/utils/date'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock, Unlock,
  Edit2, Check, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RetroItemType, RetroItemStatus, RetroItem, TeamMember } from '@/types'

const STATUS_OPTIONS: RetroItemStatus[] = ['Offen', 'InBearbeitung', 'Erledigt']

const STATUS_VARIANTS: Record<RetroItemStatus, 'default' | 'warning' | 'success'> = {
  Offen: 'default',
  InBearbeitung: 'warning',
  Erledigt: 'success',
}

export default function RetroDetailPage() {
  const { t } = useTranslation()

  const COLUMNS: { type: RetroItemType; label: string; color: string; bg: string; border: string }[] = [
    { type: 'GutGelaufen',  label: t('retroDetail.wentWell'),    color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
    { type: 'Verbesserung', label: t('retroDetail.improvements'), color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
    { type: 'Aktionspunkt', label: t('retroDetail.actionItems'),  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200'   },
  ]

  const { retroId } = useParams<{ retroId: string }>()
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const retrospectives = useStore((s) => s.retrospectives)
  const addRetroItem = useStore((s) => s.addRetroItem)
  const updateRetroItem = useStore((s) => s.updateRetroItem)
  const deleteRetroItem = useStore((s) => s.deleteRetroItem)
  const voteRetroItem = useStore((s) => s.voteRetroItem)
  const updateRetrospective = useStore((s) => s.updateRetrospective)

  const retro = retrospectives.find((r) => r.id === retroId)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newTexts, setNewTexts] = useState<Partial<Record<RetroItemType, string>>>({})

  if (!retro) {
    return (
      <div className="p-6">
        <p className="text-slate-500">{t('retroDetail.notFound')}</p>
        <Link to="/retro" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline mt-3">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Link>
      </div>
    )
  }

  const sprint = retro.sprintId ? sprints.find((s) => s.id === retro.sprintId) : null
  const facilitator = retro.facilitatorId ? members.find((m) => m.id === retro.facilitatorId) : null

  async function handleAddItem(type: RetroItemType) {
    const text = (newTexts[type] ?? '').trim()
    if (!text) return
    try {
      await addRetroItem(retro!.id, type, text)
      setNewTexts((t) => ({ ...t, [type]: '' }))
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Back */}
      <Link to="/retro" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('retroDetail.allRetros')}
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{retro.title}</h1>
              {retro.isFinalized && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> {t('retroDetail.finalized')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{formatDate(retro.date)}</span>
              {sprint && <Badge label={sprint.name} variant="info" />}
              {facilitator && (
                <div className="flex items-center gap-1.5">
                  <Avatar name={facilitator.name} color={facilitator.avatarColor} size="xs" />
                  <span>{facilitator.name}</span>
                </div>
              )}
            </div>
          </div>
          <Button
            variant={retro.isFinalized ? 'secondary' : 'primary'}
            size="sm"
            icon={retro.isFinalized ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            onClick={() => updateRetrospective(retro.id, { isFinalized: !retro.isFinalized })}
          >
            {retro.isFinalized ? t('retroDetail.unlock') : t('retroDetail.finalize')}
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid lg:grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const items = retro.items
            .filter((i) => i.type === col.type)
            .sort((a, b) => b.votes - a.votes)

          return (
            <div key={col.type} className={`rounded-xl border ${col.border} ${col.bg} flex flex-col`}>
              {/* Column header */}
              <div className={`px-4 py-3 border-b ${col.border} flex items-center justify-between`}>
                <h2 className={`text-sm font-semibold ${col.color}`}>{col.label}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${col.color}`}>
                  {items.length}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[600px] scrollbar-thin">
                {items.map((item) => (
                  <RetroItemCard
                    key={item.id}
                    item={item}
                    members={members}
                    isFinalized={retro.isFinalized}
                    onUpdate={(data) => updateRetroItem(retro.id, item.id, data)}
                    onDelete={() => setDeleteTarget(item.id)}
                    onVote={(delta) => voteRetroItem(retro.id, item.id, delta)}
                    colColor={col.color}
                  />
                ))}
              </div>

              {/* Add item */}
              {!retro.isFinalized && (
                <div className={`p-3 border-t ${col.border}`}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('retroDetail.addNewPlaceholder')}
                      value={newTexts[col.type] ?? ''}
                      onChange={(e) => setNewTexts((txt) => ({ ...txt, [col.type]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(col.type) }}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => handleAddItem(col.type)} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-1">{t('retroDetail.pressEnter')}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteRetroItem(retro.id, deleteTarget) }}
        title={t('retroDetail.deleteItem')}
        message={t('retroDetail.deleteItemConfirm')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

interface RetroItemCardProps {
  item: RetroItem
  members: TeamMember[]
  isFinalized: boolean
  onUpdate: (data: Partial<RetroItem>) => void
  onDelete: () => void
  onVote: (delta: 1 | -1) => void
  colColor: string
}

function RetroItemCard({ item, members, isFinalized, onUpdate, onDelete, onVote, colColor }: RetroItemCardProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const inputRef = useRef<HTMLInputElement>(null)

  function saveEdit() {
    if (editText.trim()) onUpdate({ text: editText.trim() })
    setEditing(false)
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-white dark:border-slate-800 shadow-sm p-3 space-y-2 hover:shadow transition-shadow">
      {/* Text */}
      {editing ? (
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p
          className="text-sm text-slate-800 dark:text-slate-200 leading-snug"
          onDoubleClick={() => { if (!isFinalized) { setEditText(item.text); setEditing(true) } }}
        >
          {item.text}
        </p>
      )}

      {/* Action item extras */}
      {item.type === 'Aktionspunkt' && (
        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <select
              value={item.status}
              onChange={(e) => onUpdate({ status: e.target.value as RetroItemStatus })}
              disabled={isFinalized}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`retroItemStatus.${s}`)}</option>
              ))}
            </select>
            <Badge label={t(`retroItemStatus.${item.status}`)} variant={STATUS_VARIANTS[item.status]} />
          </div>
          <select
            value={item.assigneeId ?? ''}
            onChange={(e) => onUpdate({ assigneeId: e.target.value || undefined })}
            disabled={isFinalized}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">{t('retroDetail.noOwner')}</option>
            {members.filter((m) => m.isActive).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={item.dueDate ?? ''}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
            disabled={isFinalized}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
          />
        </div>
      )}

      {/* Footer: votes + actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onVote(-1)}
            disabled={isFinalized || item.votes === 0}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className={`text-xs font-semibold w-4 text-center ${item.votes > 0 ? colColor : 'text-slate-400'}`}>
            {item.votes}
          </span>
          <button
            onClick={() => onVote(1)}
            disabled={isFinalized}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {!isFinalized && (
            <>
              <button
                onClick={() => { setEditText(item.text); setEditing(true) }}
                className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
