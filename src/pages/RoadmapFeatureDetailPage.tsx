import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Save, Trash2, Plus, Map, Calendar, Tag, Layers,
  Lightbulb, Clock, Circle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Copy, Check, Pencil, X,
  LayoutTemplate, Server, Cpu, Star, AlertTriangle,
  FileText, Ticket, Download, Wand2, Globe, Lock,
  Monitor, Code2,
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import type {
  RoadmapFeature, RoadmapTicket,
  RoadmapStatus, RoadmapPriority,
  RoadmapTicketType, RoadmapTicketArea,
  RoadmapEndpoint, RoadmapScreen,
  HttpMethod, EndpointComplexity,
} from '@/types'

// ─── Config / Constants ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  idea:         { label: 'Idee',        icon: Lightbulb,    color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  planned:      { label: 'Geplant',     icon: Clock,        color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'in-progress':{ label: 'In Arbeit',   icon: Circle,       color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  done:         { label: 'Fertig',      icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  cancelled:    { label: 'Abgebrochen', icon: XCircle,      color: 'text-slate-500',                      bg: 'bg-slate-100 dark:bg-slate-800' },
}

const PRIORITY_CONFIG: Record<RoadmapPriority, { label: string; color: string; dotColor: string }> = {
  low:      { label: 'Niedrig',  color: 'text-slate-500',                        dotColor: 'bg-slate-400' },
  medium:   { label: 'Mittel',   color: 'text-blue-600 dark:text-blue-400',      dotColor: 'bg-blue-500' },
  high:     { label: 'Hoch',     color: 'text-orange-600 dark:text-orange-400',  dotColor: 'bg-orange-500' },
  critical: { label: 'Kritisch', color: 'text-red-600 dark:text-red-400',        dotColor: 'bg-red-500' },
}

const TICKET_TYPE_CONFIG: Record<RoadmapTicketType, { label: string; color: string }> = {
  epic:        { label: 'Epic',        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  'user-story':{ label: 'User Story',  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  task:        { label: 'Task',        color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  bug:         { label: 'Bug',         color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
}

const TICKET_AREA_CONFIG: Record<RoadmapTicketArea, { label: string; icon: React.ElementType }> = {
  frontend:  { label: 'Frontend',   icon: LayoutTemplate },
  backend:   { label: 'Backend',    icon: Server },
  devops:    { label: 'DevOps',     icon: Cpu },
  design:    { label: 'Design',     icon: Star },
  database:  { label: 'Datenbank',  icon: FileText },
  other:     { label: 'Sonstiges',  icon: Layers },
}

const STATUSES: RoadmapStatus[]      = ['idea', 'planned', 'in-progress', 'done', 'cancelled']
const PRIORITIES: RoadmapPriority[]  = ['low', 'medium', 'high', 'critical']
const TICKET_TYPES: RoadmapTicketType[] = ['epic', 'user-story', 'task', 'bug']
const TICKET_AREAS: RoadmapTicketArea[] = ['frontend', 'backend', 'devops', 'design', 'database', 'other']
const QUARTERS = [1, 2, 3, 4] as const

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const METHOD_CONFIG: Record<HttpMethod, { bg: string; text: string }> = {
  GET:    { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-300' },
  POST:   { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300' },
  PUT:    { bg: 'bg-orange-100 dark:bg-orange-900/30',text: 'text-orange-700 dark:text-orange-300' },
  PATCH:  { bg: 'bg-yellow-100 dark:bg-yellow-900/30',text: 'text-yellow-700 dark:text-yellow-300' },
  DELETE: { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-300' },
}

const COMPLEXITIES: EndpointComplexity[] = ['xs', 's', 'm', 'l', 'xl']
const COMPLEXITY_CONFIG: Record<EndpointComplexity, { label: string; color: string }> = {
  xs: { label: 'XS', color: 'text-slate-500' },
  s:  { label: 'S',  color: 'text-green-600 dark:text-green-400' },
  m:  { label: 'M',  color: 'text-blue-600 dark:text-blue-400' },
  l:  { label: 'L',  color: 'text-orange-600 dark:text-orange-400' },
  xl: { label: 'XL', color: 'text-red-600 dark:text-red-400' },
}

const PLANNING_SECTIONS: { key: keyof RoadmapFeature; label: string }[] = [
  { key: 'goals',              label: 'Ziele' },
  { key: 'acceptanceCriteria', label: 'Akzeptanzkriterien' },
  { key: 'uiNotes',            label: 'Frontend/UI' },
  { key: 'backendNotes',       label: 'Backend' },
  { key: 'technicalNotes',     label: 'Technik' },
  { key: 'risks',              label: 'Risiken' },
]

function planningScore(f: Partial<RoadmapFeature>) {
  return PLANNING_SECTIONS.filter((s) => ((f[s.key] as string) ?? '').trim().length > 0).length
}

// ─── Markdown Section Editor ──────────────────────────────────────────────────

interface SectionProps {
  icon: React.ElementType
  title: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  rows?: number
  hint?: string
}

function MarkdownSection({ icon: Icon, title, value, placeholder, onChange, rows = 6, hint }: SectionProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
          {value && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="p-3 bg-white dark:bg-slate-900">
          {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        </div>
      )}
    </div>
  )
}

// ─── Ticket Row ───────────────────────────────────────────────────────────────

interface TicketRowProps {
  ticket: RoadmapTicket
  featureId: string
  teams: string[]
  onUpdate: (data: Partial<RoadmapTicket>) => Promise<void>
  onDelete: () => Promise<void>
}

function TicketRow({ ticket, teams, onUpdate, onDelete }: TicketRowProps) {
  const { t } = useTranslation()
  const [editing,   setEditing]   = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [form, setForm] = useState({
    title:             ticket.title,
    description:       ticket.description,
    acceptanceCriteria:ticket.acceptanceCriteria,
    type:              ticket.type,
    area:              ticket.area,
    storyPoints:       ticket.storyPoints ?? '' as number | '',
    priority:          ticket.priority,
    assignedTeam:      ticket.assignedTeam ?? '',
    tags:              ticket.tags.join(', '),
  })

  function copyToClipboard() {
    const text = [
      `# ${ticket.title}`,
      `**Typ:** ${TICKET_TYPE_CONFIG[ticket.type].label}  |  **Bereich:** ${TICKET_AREA_CONFIG[ticket.area].label}  |  **Priorität:** ${PRIORITY_CONFIG[ticket.priority].label}${ticket.storyPoints ? `  |  **Story Points:** ${ticket.storyPoints}` : ''}${ticket.assignedTeam ? `  |  **Team:** ${ticket.assignedTeam}` : ''}`,
      '',
      ticket.description ? `## Beschreibung\n${ticket.description}` : '',
      ticket.acceptanceCriteria ? `## Akzeptanzkriterien\n${ticket.acceptanceCriteria}` : '',
      ticket.tags.length > 0 ? `**Tags:** ${ticket.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    await onUpdate({
      title: form.title.trim(),
      description: form.description,
      acceptanceCriteria: form.acceptanceCriteria,
      type: form.type,
      area: form.area,
      storyPoints: form.storyPoints === '' ? undefined : Number(form.storyPoints),
      priority: form.priority,
      assignedTeam: form.assignedTeam.trim() || undefined,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete() } catch { setDeleting(false) }
  }

  const tc = TICKET_TYPE_CONFIG[ticket.type]
  const ac = TICKET_AREA_CONFIG[ticket.area]
  const pc = PRIORITY_CONFIG[ticket.priority]
  const AreaIcon = ac.icon

  if (editing) {
    return (
      <div className="border border-indigo-300 dark:border-indigo-600 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketTitle')} *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketType')}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoadmapTicketType })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {TICKET_TYPES.map((tp) => <option key={tp} value={tp}>{TICKET_TYPE_CONFIG[tp].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketArea')}</label>
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as RoadmapTicketArea })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {TICKET_AREAS.map((a) => <option key={a} value={a}>{TICKET_AREA_CONFIG[a].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.priority')}</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as RoadmapPriority })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.storyPoints')}</label>
            <input type="number" min={0} max={100} value={form.storyPoints}
              onChange={(e) => setForm({ ...form, storyPoints: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.assignedTeam')}</label>
            {teams.length > 0 ? (
              <select value={form.assignedTeam} onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">{t('common.none')}</option>
                {teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
            ) : (
              <input value={form.assignedTeam} onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}
                placeholder={t('roadmap.assignedTeamPlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              placeholder={t('roadmap.ticketDescPlaceholder')}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.acceptanceCriteria')}</label>
            <textarea value={form.acceptanceCriteria} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} rows={4}
              placeholder={t('roadmap.acceptanceCriteriaPlaceholder')}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.tags')} <span className="text-slate-400">({t('roadmap.tagsSeparator')})</span></label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="frontend, authentication, v2"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Save className="w-3.5 h-3.5" />
            {t('common.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <AreaIcon className="w-3 h-3" />
              {ac.label}
            </span>
            <span className={`text-xs font-medium ${pc.color}`}>▲ {pc.label}</span>
            {ticket.storyPoints !== undefined && (
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {ticket.storyPoints} SP
              </span>
            )}
            {ticket.assignedTeam && (
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {ticket.assignedTeam}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ticket.title}</p>
          {ticket.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{ticket.description}</p>
          )}
          {ticket.acceptanceCriteria && (
            <details className="mt-2">
              <summary className="text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                {t('roadmap.showAC')}
              </summary>
              <pre className="mt-1 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">{ticket.acceptanceCriteria}</pre>
            </details>
          )}
          {ticket.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticket.tags.map((tag) => (
                <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={copyToClipboard} title={t('roadmap.copyTicket')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setEditing(true)} title={t('common.edit')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={deleting} title={t('common.delete')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Ticket Form ──────────────────────────────────────────────────────────

interface AddTicketFormProps {
  featureId: string
  teams: string[]
  onCreated: () => void
  onCancel: () => void
}

function AddTicketForm({ featureId, teams, onCreated, onCancel }: AddTicketFormProps) {
  const { t } = useTranslation()
  const addRoadmapTicket = useStore((s) => s.addRoadmapTicket)
  const [form, setForm] = useState({
    title: '', description: '', acceptanceCriteria: '',
    type: 'task' as RoadmapTicketType, area: 'frontend' as RoadmapTicketArea,
    storyPoints: '' as number | '', priority: 'medium' as RoadmapPriority,
    assignedTeam: '', tags: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('roadmap.titleRequired')); return }
    setSaving(true)
    try {
      await addRoadmapTicket(featureId, {
        title: form.title.trim(), description: form.description,
        acceptanceCriteria: form.acceptanceCriteria, type: form.type, area: form.area,
        storyPoints: form.storyPoints === '' ? undefined : Number(form.storyPoints),
        priority: form.priority,
        assignedTeam: form.assignedTeam.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      onCreated()
    } catch (err) { setError(String(err)); setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketTitle')} *</label>
          <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('roadmap.ticketTitlePlaceholder')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketType')}</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoadmapTicketType })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {TICKET_TYPES.map((tp) => <option key={tp} value={tp}>{TICKET_TYPE_CONFIG[tp].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.ticketArea')}</label>
          <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as RoadmapTicketArea })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {TICKET_AREAS.map((a) => <option key={a} value={a}>{TICKET_AREA_CONFIG[a].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.priority')}</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as RoadmapPriority })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.storyPoints')}</label>
          <input type="number" min={0} max={100} value={form.storyPoints}
            onChange={(e) => setForm({ ...form, storyPoints: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.assignedTeam')}</label>
          {teams.length > 0 ? (
            <select value={form.assignedTeam} onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">{t('common.none')}</option>
              {teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
            </select>
          ) : (
            <input value={form.assignedTeam} onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}
              placeholder={t('roadmap.assignedTeamPlaceholder')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.description')}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
            placeholder={t('roadmap.ticketDescPlaceholder')}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.acceptanceCriteria')}</label>
          <textarea value={form.acceptanceCriteria} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} rows={3}
            placeholder={t('roadmap.acceptanceCriteriaPlaceholder')}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.tags')} <span className="text-slate-400">({t('roadmap.tagsSeparator')})</span></label>
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="frontend, authentication, v2"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          {saving ? t('common.save') + '…' : t('roadmap.addTicket')}
        </button>
      </div>
    </form>
  )
}

// ─── Blueprint: Endpoint Row ──────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const textareaCls = inputCls + ' font-mono resize-y'

interface EndpointRowProps {
  endpoint: RoadmapEndpoint
  featureId: string
  onUpdate: (data: Partial<RoadmapEndpoint>) => Promise<void>
  onDelete: () => Promise<void>
}

function EndpointRow({ endpoint, onUpdate, onDelete }: EndpointRowProps) {
  const { t } = useTranslation()
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    method:       endpoint.method,
    path:         endpoint.path,
    title:        endpoint.title,
    description:  endpoint.description,
    requestBody:  endpoint.requestBody,
    responseBody: endpoint.responseBody,
    authRequired: endpoint.authRequired,
    complexity:   endpoint.complexity,
    notes:        endpoint.notes,
  })

  const mc = METHOD_CONFIG[endpoint.method]
  const cc = COMPLEXITY_CONFIG[endpoint.complexity]

  async function handleSave() {
    await onUpdate(form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointMethod')}</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as HttpMethod })} className={inputCls}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointComplexity')}</label>
            <select value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value as EndpointComplexity })} className={inputCls}>
              {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_CONFIG[c].label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointPath')}</label>
            <input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/api/..." className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointTitle')}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Liste aller Dashboard-Einträge abrufen" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointDescription')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={textareaCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointRequestBody')}</label>
            <textarea value={form.requestBody} onChange={(e) => setForm({ ...form, requestBody: e.target.value })} rows={4}
              placeholder={'{\n  "field": "type"\n}'} className={textareaCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointResponseBody')}</label>
            <textarea value={form.responseBody} onChange={(e) => setForm({ ...form, responseBody: e.target.value })} rows={4}
              placeholder={'{\n  "id": "string",\n  "data": []\n}'} className={textareaCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointNotes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={textareaCls} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="ep-auth" checked={form.authRequired} onChange={(e) => setForm({ ...form, authRequired: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="ep-auth" className="text-sm text-slate-700 dark:text-slate-300">{t('roadmap.endpointAuth')}</label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
          <button type="button" onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Save className="w-3.5 h-3.5" />{t('common.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${mc.bg} ${mc.text}`}>{endpoint.method}</span>
        <span className="text-sm font-mono text-slate-700 dark:text-slate-300 flex-1 truncate">{endpoint.path || <span className="text-slate-400 italic">kein Pfad</span>}</span>
        {endpoint.title && <span className="text-xs text-slate-500 truncate max-w-[200px] hidden sm:block">{endpoint.title}</span>}
        <span className={`text-xs font-semibold ${cc.color} shrink-0`}>{cc.label}</span>
        {endpoint.authRequired
          ? <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          : <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        }
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={async () => { setDeleting(true); try { await onDelete() } catch { setDeleting(false) } }} disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3 bg-slate-50/50 dark:bg-slate-800/30 text-sm">
          {endpoint.description && <p className="text-slate-600 dark:text-slate-400">{endpoint.description}</p>}
          <div className="grid grid-cols-2 gap-3">
            {endpoint.requestBody && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{t('roadmap.endpointRequestBody')}</p>
                <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-300">{endpoint.requestBody}</pre>
              </div>
            )}
            {endpoint.responseBody && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{t('roadmap.endpointResponseBody')}</p>
                <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-300">{endpoint.responseBody}</pre>
              </div>
            )}
          </div>
          {endpoint.notes && <p className="text-xs text-slate-500 italic">{endpoint.notes}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Blueprint: Add Endpoint Form ─────────────────────────────────────────────

interface AddEndpointFormProps {
  featureId: string
  onCreated: () => void
  onCancel: () => void
}

function AddEndpointForm({ featureId, onCreated, onCancel }: AddEndpointFormProps) {
  const { t } = useTranslation()
  const addRoadmapEndpoint = useStore((s) => s.addRoadmapEndpoint)
  const [form, setForm] = useState({ method: 'GET' as HttpMethod, path: '', title: '', complexity: 'm' as EndpointComplexity, authRequired: true })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await addRoadmapEndpoint(featureId, form)
      onCreated()
    } catch { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointMethod')}</label>
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as HttpMethod })} className={inputCls}>
            {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointComplexity')}</label>
          <select value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value as EndpointComplexity })} className={inputCls}>
            {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_CONFIG[c].label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointPath')} *</label>
          <input autoFocus value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/api/v1/resource" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.endpointTitle')}</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Alle Einträge auflisten" className={inputCls} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="new-ep-auth" checked={form.authRequired} onChange={(e) => setForm({ ...form, authRequired: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="new-ep-auth" className="text-sm text-slate-700 dark:text-slate-300">{t('roadmap.endpointAuth')}</label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />{saving ? '…' : t('roadmap.addEndpoint')}
        </button>
      </div>
    </form>
  )
}

// ─── Blueprint: Screen Row ────────────────────────────────────────────────────

interface ScreenRowProps {
  screen: RoadmapScreen
  endpoints: RoadmapEndpoint[]
  onUpdate: (data: Partial<RoadmapScreen>) => Promise<void>
  onDelete: () => Promise<void>
}

function ScreenRow({ screen, endpoints, onUpdate, onDelete }: ScreenRowProps) {
  const { t } = useTranslation()
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    title:          screen.title,
    route:          screen.route,
    description:    screen.description,
    components:     screen.components.join(', '),
    endpointIds:    screen.endpointIds,
    wireframeNotes: screen.wireframeNotes,
  })

  async function handleSave() {
    await onUpdate({
      ...form,
      components: form.components.split(',').map((c) => c.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  const linkedEps = endpoints.filter((e) => screen.endpointIds.includes(e.id))

  if (editing) {
    return (
      <div className="border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenTitle')}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenRoute')}</label>
            <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="/dashboard" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenDescription')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={textareaCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('roadmap.screenComponents')} <span className="text-slate-400 font-normal">({t('roadmap.tagsSeparator')})</span>
            </label>
            <input value={form.components} onChange={(e) => setForm({ ...form, components: e.target.value })}
              placeholder={t('roadmap.screenComponentsPlaceholder')} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenLinkedEndpoints')}</label>
            <div className="flex flex-wrap gap-2">
              {endpoints.map((ep) => (
                <label key={ep.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.endpointIds.includes(ep.id)}
                    onChange={(e) => setForm({ ...form, endpointIds: e.target.checked ? [...form.endpointIds, ep.id] : form.endpointIds.filter((id) => id !== ep.id) })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className={`font-bold font-mono ${METHOD_CONFIG[ep.method].text}`}>{ep.method}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{ep.path || '/'}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenWireframeNotes')}</label>
            <textarea value={form.wireframeNotes} onChange={(e) => setForm({ ...form, wireframeNotes: e.target.value })} rows={3} className={textareaCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
          <button type="button" onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Save className="w-3.5 h-3.5" />{t('common.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Monitor className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1 truncate">{screen.title || <span className="text-slate-400 italic">kein Titel</span>}</span>
        {screen.route && <span className="text-xs font-mono text-slate-500 truncate max-w-[160px] hidden sm:block">{screen.route}</span>}
        {linkedEps.length > 0 && (
          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded shrink-0">
            {linkedEps.length} EP
          </span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={async () => { setDeleting(true); try { await onDelete() } catch { setDeleting(false) } }} disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/30 text-sm">
          {screen.description && <p className="text-slate-600 dark:text-slate-400">{screen.description}</p>}
          {screen.components.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {screen.components.map((c, i) => (
                <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono">{c}</span>
              ))}
            </div>
          )}
          {linkedEps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">{t('roadmap.screenLinkedEndpoints')}:</p>
              <div className="flex flex-col gap-1">
                {linkedEps.map((ep) => (
                  <span key={ep.id} className="text-xs font-mono">
                    <span className={`font-bold ${METHOD_CONFIG[ep.method].text} mr-1.5`}>{ep.method}</span>
                    <span className="text-slate-600 dark:text-slate-400">{ep.path}</span>
                    {ep.title && <span className="text-slate-400 ml-2">— {ep.title}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {screen.wireframeNotes && (
            <pre className="text-xs text-slate-500 whitespace-pre-wrap font-sans">{screen.wireframeNotes}</pre>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Blueprint: Add Screen Form ───────────────────────────────────────────────

interface AddScreenFormProps {
  featureId: string
  endpoints: RoadmapEndpoint[]
  onCreated: () => void
  onCancel: () => void
}

function AddScreenForm({ featureId, endpoints, onCreated, onCancel }: AddScreenFormProps) {
  const { t } = useTranslation()
  const addRoadmapScreen = useStore((s) => s.addRoadmapScreen)
  const [form, setForm] = useState({ title: '', route: '', endpointIds: [] as string[] })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await addRoadmapScreen(featureId, form)
      onCreated()
    } catch { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenTitle')} *</label>
          <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z. B. Dashboard-Übersicht" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenRoute')}</label>
          <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="/dashboard" className={inputCls} />
        </div>
        {endpoints.length > 0 && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.screenLinkedEndpoints')}</label>
            <div className="flex flex-wrap gap-2">
              {endpoints.map((ep) => (
                <label key={ep.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.endpointIds.includes(ep.id)}
                    onChange={(e) => setForm({ ...form, endpointIds: e.target.checked ? [...form.endpointIds, ep.id] : form.endpointIds.filter((id) => id !== ep.id) })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className={`font-bold font-mono ${METHOD_CONFIG[ep.method].text}`}>{ep.method}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{ep.path || '/'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">{t('common.cancel')}</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />{saving ? '…' : t('roadmap.addScreen')}
        </button>
      </div>
    </form>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, title }: { onConfirm: () => void; onCancel: () => void; title: string }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('roadmap.deleteFeatureTitle')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('roadmap.deleteFeatureConfirm', { title })}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export default function RoadmapFeatureDetailPage() {
  const { featureId } = useParams<{ featureId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const features               = useStore((s) => s.roadmapFeatures)
  const roadmapTickets         = useStore((s) => s.roadmapTickets)
  const roadmapEndpoints       = useStore((s) => s.roadmapEndpoints)
  const roadmapScreens         = useStore((s) => s.roadmapScreens)
  const loadRoadmapTickets     = useStore((s) => s.loadRoadmapTickets)
  const loadRoadmapEndpoints   = useStore((s) => s.loadRoadmapEndpoints)
  const loadRoadmapScreens     = useStore((s) => s.loadRoadmapScreens)
  const updateRoadmapFeature   = useStore((s) => s.updateRoadmapFeature)
  const deleteRoadmapFeature   = useStore((s) => s.deleteRoadmapFeature)
  const updateRoadmapTicket    = useStore((s) => s.updateRoadmapTicket)
  const deleteRoadmapTicket    = useStore((s) => s.deleteRoadmapTicket)
  const updateRoadmapEndpoint  = useStore((s) => s.updateRoadmapEndpoint)
  const deleteRoadmapEndpoint  = useStore((s) => s.deleteRoadmapEndpoint)
  const updateRoadmapScreen    = useStore((s) => s.updateRoadmapScreen)
  const deleteRoadmapScreen    = useStore((s) => s.deleteRoadmapScreen)
  const addRoadmapTicket       = useStore((s) => s.addRoadmapTicket)
  const authTeams              = useStore((s) => s.members) // only used for count check

  // We get the team list from the auth store for display in tickets
  const [teamNames, setTeamNames] = useState<string[]>([])

  const feature   = features.find((f) => f.id === featureId)
  const tickets   = featureId ? (roadmapTickets[featureId] ?? null) : null
  const endpoints = featureId ? (roadmapEndpoints[featureId] ?? null) : null
  const screens   = featureId ? (roadmapScreens[featureId] ?? null) : null

  // Load teams for ticket assignment from the global teams list
  useEffect(() => {
    setTeamNames(useAuthStore.getState().teams.map((t) => t.name))
  }, [authTeams])

  useEffect(() => {
    if (featureId && tickets === null) {
      loadRoadmapTickets(featureId)
    }
  }, [featureId, tickets, loadRoadmapTickets])

  // ─── Local editable state ────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<RoadmapFeature>>({})
  const [dirty, setDirty]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAddTicket, setShowAddTicket]   = useState(false)
  const [ticketAreaFilter, setTicketAreaFilter] = useState<RoadmapTicketArea | 'all'>('all')
  const [blueprintOpen, setBlueprintOpen]   = useState(false)
  const [showAddEndpoint, setShowAddEndpoint] = useState(false)
  const [showAddScreen,   setShowAddScreen]   = useState(false)

  useEffect(() => {
    if (featureId && blueprintOpen && endpoints === null) {
      loadRoadmapEndpoints(featureId)
    }
    if (featureId && blueprintOpen && screens === null) {
      loadRoadmapScreens(featureId)
    }
  }, [featureId, blueprintOpen, endpoints, screens, loadRoadmapEndpoints, loadRoadmapScreens])
  const [generating, setGenerating]         = useState(false)
  const [generatedCount, setGeneratedCount] = useState<number | null>(null)

  // Sync form when feature loads / changes
  useEffect(() => {
    if (feature) {
      setForm({
        title:              feature.title,
        description:        feature.description,
        status:             feature.status,
        priority:           feature.priority,
        targetVersion:      feature.targetVersion ?? '',
        targetYear:         feature.targetYear,
        targetQuarter:      feature.targetQuarter,
        category:           feature.category ?? '',
        tags:               feature.tags,
        goals:              feature.goals,
        acceptanceCriteria: feature.acceptanceCriteria,
        uiNotes:            feature.uiNotes,
        backendNotes:       feature.backendNotes,
        technicalNotes:     feature.technicalNotes,
        risks:              feature.risks,
      })
      setDirty(false)
    }
  }, [feature?.id])

  const updateField = useCallback(<K extends keyof RoadmapFeature>(key: K, value: RoadmapFeature[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }, [])

  async function generateTicketsFromBlueprint() {
    if (!featureId || !endpoints || !screens) return
    const confirmMsg = t('roadmap.generateTicketsConfirm', { count: endpoints.length + screens.length })
    if (!window.confirm(confirmMsg)) return
    setGenerating(true)
    let count = 0
    try {
      for (const ep of endpoints) {
        const desc = [
          `**Methode:** \`${ep.method}\``,
          `**Pfad:** \`${ep.path}\``,
          ep.authRequired ? '**Auth:** Erforderlich' : '**Auth:** Öffentlich',
          `**Komplexität:** ${COMPLEXITY_CONFIG[ep.complexity].label}`,
          ep.description ? `\n${ep.description}` : '',
          ep.requestBody ? `\n**Request-Body:**\n\`\`\`json\n${ep.requestBody}\n\`\`\`` : '',
          ep.responseBody ? `\n**Response-Body:**\n\`\`\`json\n${ep.responseBody}\n\`\`\`` : '',
          ep.notes ? `\n**Notizen:** ${ep.notes}` : '',
        ].filter(Boolean).join('\n')
        const ac = [
          `- [ ] Endpoint \`${ep.method} ${ep.path}\` ist implementiert`,
          ep.authRequired ? '- [ ] Authentifizierung/Autorisierung ist geprüft' : '- [ ] Endpoint ist ohne Auth erreichbar',
          ep.requestBody ? '- [ ] Request-Body wird validiert' : '',
          '- [ ] Fehlerbehandlung (4xx/5xx) ist implementiert',
          '- [ ] Unit-Tests vorhanden',
        ].filter(Boolean).join('\n')
        await addRoadmapTicket(featureId, {
          title: `[API] ${ep.method} ${ep.path}${ep.title ? ` – ${ep.title}` : ''}`,
          description: desc,
          acceptanceCriteria: ac,
          type: 'task',
          area: 'backend',
          priority: 'medium',
        })
        count++
      }
      for (const sc of screens) {
        const linkedEpsForScreen = endpoints.filter((e) => sc.endpointIds.includes(e.id))
        const desc = [
          sc.route ? `**Route:** \`${sc.route}\`` : '',
          sc.description ? `\n${sc.description}` : '',
          sc.components.length > 0 ? `\n**Komponenten:** ${sc.components.join(', ')}` : '',
          linkedEpsForScreen.length > 0 ? `\n**Verwendete Endpoints:**\n${linkedEpsForScreen.map((e) => `- \`${e.method} ${e.path}\``).join('\n')}` : '',
          sc.wireframeNotes ? `\n**Wireframe-Notizen:**\n${sc.wireframeNotes}` : '',
        ].filter(Boolean).join('\n')
        const ac = [
          `- [ ] Screen "${sc.title}" ist implementiert${sc.route ? ` unter \`${sc.route}\`` : ''}`,
          sc.components.length > 0 ? `- [ ] Alle Komponenten sind vorhanden: ${sc.components.join(', ')}` : '',
          linkedEpsForScreen.length > 0 ? '- [ ] API-Anbindung an alle verlinkten Endpoints ist funktional' : '',
          '- [ ] Responsive Design geprüft',
          '- [ ] Ladezustand und Fehlerbehandlung implementiert',
        ].filter(Boolean).join('\n')
        await addRoadmapTicket(featureId, {
          title: `[SCREEN] ${sc.title}${sc.route ? ` (${sc.route})` : ''}`,
          description: desc,
          acceptanceCriteria: ac,
          type: 'task',
          area: 'frontend',
          priority: 'medium',
        })
        count++
      }
      setGeneratedCount(count)
      setTimeout(() => setGeneratedCount(null), 3000)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!featureId) return
    setSaving(true)
    try {
      await updateRoadmapFeature(featureId, {
        ...form,
        targetVersion:  (form.targetVersion as string)?.trim() || undefined,
        category:       (form.category as string)?.trim() || undefined,
        tags:           form.tags ?? [],
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!featureId) return
    await deleteRoadmapFeature(featureId)
    navigate('/roadmap')
  }

  const [exportCopied, setExportCopied] = useState(false)

  function exportAsDocument() {
    const f = { ...feature, ...form } as RoadmapFeature
    const tks = tickets ?? []
    const sc  = STATUS_CONFIG[f.status]
    const pc  = PRIORITY_CONFIG[f.priority]

    const lines: string[] = [
      `# ${f.title}`,
      '',
      `**Status:** ${sc.label}  |  **Priorität:** ${pc.label}${f.targetVersion ? `  |  **Version:** ${f.targetVersion}` : ''}${f.targetYear ? `  |  **Ziel:** ${f.targetYear}${f.targetQuarter ? ` Q${f.targetQuarter}` : ''}` : ''}${f.category ? `  |  **Kategorie:** ${f.category}` : ''}`,
      f.tags.length > 0 ? `**Tags:** ${f.tags.join(', ')}` : '',
      '',
      f.description ? `> ${f.description}` : '',
      '',
      '---',
    ]

    const addSection = (title: string, content: string) => {
      if (!content.trim()) return
      lines.push('', `## ${title}`, '', content.trim())
    }

    addSection('Ziele & Motivation', f.goals)
    addSection('Akzeptanzkriterien', f.acceptanceCriteria)
    addSection('Frontend / UI', f.uiNotes)
    addSection('Backend / API', f.backendNotes)
    addSection('Technische Entscheidungen', f.technicalNotes)
    addSection('Risiken & Herausforderungen', f.risks)

    if (tks.length > 0) {
      lines.push('', '---', '', `## Azure DevOps Tickets (${tks.length})`)
      const grouped = TICKET_AREAS.reduce<Record<RoadmapTicketArea, typeof tks>>((acc, a) => {
        acc[a] = tks.filter((t) => t.area === a)
        return acc
      }, {} as Record<RoadmapTicketArea, typeof tks>)
      for (const area of TICKET_AREAS) {
        const areaTickets = grouped[area]
        if (areaTickets.length === 0) continue
        lines.push('', `### ${TICKET_AREA_CONFIG[area].label}`)
        for (const tk of areaTickets) {
          lines.push(
            '',
            `#### ${tk.title}`,
            `**Typ:** ${TICKET_TYPE_CONFIG[tk.type].label}  |  **Priorität:** ${PRIORITY_CONFIG[tk.priority].label}${tk.storyPoints ? `  |  **SP:** ${tk.storyPoints}` : ''}${tk.assignedTeam ? `  |  **Team:** ${tk.assignedTeam}` : ''}`,
          )
          if (tk.description) lines.push('', tk.description)
          if (tk.acceptanceCriteria) lines.push('', '**Akzeptanzkriterien:**', '', tk.acceptanceCriteria)
          if (tk.tags.length > 0) lines.push('', `**Tags:** ${tk.tags.join(', ')}`)
        }
      }
    }

    const score = planningScore(f)
    lines.push('', '---', `*Planungsfortschritt: ${score}/${PLANNING_SECTIONS.length} Abschnitte ausgefüllt · Exportiert am ${new Date().toLocaleDateString('de-DE')}*`)

    navigator.clipboard.writeText(lines.filter((l) => l !== null).join('\n'))
    setExportCopied(true)
    setTimeout(() => setExportCopied(false), 2500)
  }

  function copyAllTickets() {
    const tks = tickets ?? []
    const filtered = ticketAreaFilter === 'all' ? tks : tks.filter((t) => t.area === ticketAreaFilter)
    const text = filtered.map((tk) => [
      `## ${tk.title}`,
      `**Typ:** ${TICKET_TYPE_CONFIG[tk.type].label}  |  **Bereich:** ${TICKET_AREA_CONFIG[tk.area].label}  |  **Priorität:** ${PRIORITY_CONFIG[tk.priority].label}${tk.storyPoints ? `  |  **SP:** ${tk.storyPoints}` : ''}${tk.assignedTeam ? `  |  **Team:** ${tk.assignedTeam}` : ''}`,
      tk.description ? `\n${tk.description}` : '',
      tk.acceptanceCriteria ? `\n**Akzeptanzkriterien:**\n${tk.acceptanceCriteria}` : '',
    ].filter(Boolean).join('\n')).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
  }

  if (!feature) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <Map className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-500">{t('roadmap.featureNotFound')}</p>
          <button onClick={() => navigate('/roadmap')} className="text-sm text-indigo-600 hover:underline">{t('roadmap.backToRoadmap')}</button>
        </div>
      </div>
    )
  }

  const sc = STATUS_CONFIG[form.status ?? feature.status]
  const pc = PRIORITY_CONFIG[form.priority ?? feature.priority]
  const StatusIcon = sc.icon
  const filteredTickets = tickets ? (ticketAreaFilter === 'all' ? tickets : tickets.filter((t) => t.area === ticketAreaFilter)) : []

  // Story points sum per area
  const spByArea = TICKET_AREAS.reduce<Record<RoadmapTicketArea, number>>((acc, a) => {
    acc[a] = (tickets ?? []).filter((t) => t.area === a).reduce((s, t) => s + (t.storyPoints ?? 0), 0)
    return acc
  }, {} as Record<RoadmapTicketArea, number>)
  const totalSP = Object.values(spByArea).reduce((a, b) => a + b, 0)

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/roadmap')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Map className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-sm text-slate-500 hidden sm:block">{t('roadmap.title')}</span>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:block">/</span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate max-w-xs">{feature.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 hidden sm:block">{t('roadmap.unsavedChanges')}</span>
          )}
          <button onClick={exportAsDocument} title={t('roadmap.exportDocument')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            {exportCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{exportCopied ? t('roadmap.exportCopied') : t('roadmap.exportDocument')}</span>
          </button>
          <button onClick={handleSave} disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Save className="w-3.5 h-3.5" />
            {saving ? t('common.save') + '…' : t('common.save')}
          </button>
          <button onClick={() => setShowDelete(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Title & Meta ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
            <input
              value={(form.title as string) ?? ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full text-xl font-bold text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-1 transition-colors"
              placeholder={t('roadmap.featureTitle')}
            />
            <textarea
              value={(form.description as string) ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-600 dark:text-slate-400 bg-transparent resize-none focus:outline-none placeholder-slate-400"
              placeholder={t('roadmap.shortDescriptionPlaceholder')}
            />

            {/* Status / Priority / Timeline row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('roadmap.status')}</label>
                <select value={form.status} onChange={(e) => updateField('status', e.target.value as RoadmapStatus)}
                  className={`w-full px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 ${sc.bg} ${sc.color} focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer`}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('roadmap.priority')}</label>
                <select value={form.priority} onChange={(e) => updateField('priority', e.target.value as RoadmapPriority)}
                  className="w-full px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('roadmap.targetVersion')}</label>
                <input value={(form.targetVersion as string) ?? ''} onChange={(e) => updateField('targetVersion', e.target.value)}
                  placeholder="v2.0"
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('roadmap.category')}</label>
                <input value={(form.category as string) ?? ''} onChange={(e) => updateField('category', e.target.value)}
                  placeholder={t('roadmap.categoryPlaceholder')}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Year / Quarter / Tags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />{t('roadmap.targetYear')}
                </label>
                <input type="number" min={2024} max={2035} value={form.targetYear ?? ''}
                  onChange={(e) => updateField('targetYear', e.target.value ? Number(e.target.value) : undefined as unknown as number)}
                  placeholder="2025"
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('roadmap.targetQuarter')}</label>
                <select value={form.targetQuarter ?? ''} onChange={(e) => updateField('targetQuarter', e.target.value ? Number(e.target.value) as 1 | 2 | 3 | 4 : undefined as unknown as 1)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t('common.none')}</option>
                  {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  <Tag className="w-3 h-3 inline mr-1" />{t('roadmap.tags')} <span className="text-slate-400">({t('roadmap.tagsSeparator')})</span>
                </label>
                <input
                  value={(form.tags as string[])?.join(', ') ?? ''}
                  onChange={(e) => updateField('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                  placeholder="dashboard, ui, api"
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          {/* ── Planning Completeness ── */}
          {(() => {
            const score = planningScore(form)
            const pct = (score / PLANNING_SECTIONS.length) * 100
            const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{t('roadmap.planningProgress')}</span>
                  <span className={`text-xs font-semibold tabular-nums ${pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                    {score}/{PLANNING_SECTIONS.length} {t('roadmap.sectionsFilled')}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PLANNING_SECTIONS.map(({ key, label }) => {
                    const filled = ((form[key] as string) ?? '').trim().length > 0
                    return (
                      <span key={key} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        filled
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {filled ? '✓ ' : ''}{label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Planning Sections ── */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide px-1">{t('roadmap.planningDetails')}</h2>
            <MarkdownSection
              icon={Lightbulb}
              title={t('roadmap.goals')}
              value={(form.goals as string) ?? ''}
              onChange={(v) => updateField('goals', v)}
              placeholder={t('roadmap.goalsPlaceholder')}
              hint={t('roadmap.goalsHint')}
              rows={5}
            />
            <MarkdownSection
              icon={CheckCircle2}
              title={t('roadmap.acceptanceCriteria')}
              value={(form.acceptanceCriteria as string) ?? ''}
              onChange={(v) => updateField('acceptanceCriteria', v)}
              placeholder={t('roadmap.acceptanceCriteriaFeaturePlaceholder')}
              hint={t('roadmap.acceptanceCriteriaHint')}
              rows={5}
            />
            <MarkdownSection
              icon={LayoutTemplate}
              title={t('roadmap.uiNotes')}
              value={(form.uiNotes as string) ?? ''}
              onChange={(v) => updateField('uiNotes', v)}
              placeholder={t('roadmap.uiNotesPlaceholder')}
              hint={t('roadmap.uiNotesHint')}
              rows={6}
            />
            <MarkdownSection
              icon={Server}
              title={t('roadmap.backendNotes')}
              value={(form.backendNotes as string) ?? ''}
              onChange={(v) => updateField('backendNotes', v)}
              placeholder={t('roadmap.backendNotesPlaceholder')}
              hint={t('roadmap.backendNotesHint')}
              rows={6}
            />
            <MarkdownSection
              icon={Cpu}
              title={t('roadmap.technicalNotes')}
              value={(form.technicalNotes as string) ?? ''}
              onChange={(v) => updateField('technicalNotes', v)}
              placeholder={t('roadmap.technicalNotesPlaceholder')}
              hint={t('roadmap.technicalNotesHint')}
              rows={5}
            />
            <MarkdownSection
              icon={AlertTriangle}
              title={t('roadmap.risks')}
              value={(form.risks as string) ?? ''}
              onChange={(v) => updateField('risks', v)}
              placeholder={t('roadmap.risksPlaceholder')}
              hint={t('roadmap.risksHint')}
              rows={4}
            />
          </div>

          {/* ── Technical Blueprint ── */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setBlueprintOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('roadmap.blueprint')}</span>
                {endpoints !== null && screens !== null && (
                  <span className="text-xs text-slate-400">
                    {endpoints.length} Endpoints · {screens.length} Screens
                  </span>
                )}
              </div>
              {blueprintOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {blueprintOpen && (
              <div className="p-5 space-y-6 bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-500">{t('roadmap.blueprintHint')}</p>

                {/* API Endpoints */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('roadmap.endpoints')}</h3>
                    </div>
                    <button
                      onClick={() => setShowAddEndpoint((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                      {showAddEndpoint ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {showAddEndpoint ? t('common.cancel') : t('roadmap.addEndpoint')}
                    </button>
                  </div>
                  {showAddEndpoint && featureId && (
                    <AddEndpointForm featureId={featureId} onCreated={() => setShowAddEndpoint(false)} onCancel={() => setShowAddEndpoint(false)} />
                  )}
                  {endpoints === null ? (
                    <p className="text-sm text-slate-400 py-2 text-center">{t('common.loading') || 'Laden…'}</p>
                  ) : endpoints.length === 0 && !showAddEndpoint ? (
                    <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">{t('roadmap.noEndpoints')}</p>
                  ) : (
                    <div className="space-y-2">
                      {endpoints.map((ep) => (
                        <EndpointRow
                          key={ep.id}
                          endpoint={ep}
                          featureId={featureId!}
                          onUpdate={(data) => updateRoadmapEndpoint(featureId!, ep.id, data)}
                          onDelete={() => deleteRoadmapEndpoint(featureId!, ep.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Frontend Screens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('roadmap.screens')}</h3>
                    </div>
                    <button
                      onClick={() => setShowAddScreen((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                      {showAddScreen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {showAddScreen ? t('common.cancel') : t('roadmap.addScreen')}
                    </button>
                  </div>
                  {showAddScreen && featureId && (
                    <AddScreenForm featureId={featureId} endpoints={endpoints ?? []} onCreated={() => setShowAddScreen(false)} onCancel={() => setShowAddScreen(false)} />
                  )}
                  {screens === null ? (
                    <p className="text-sm text-slate-400 py-2 text-center">{t('common.loading') || 'Laden…'}</p>
                  ) : screens.length === 0 && !showAddScreen ? (
                    <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">{t('roadmap.noScreens')}</p>
                  ) : (
                    <div className="space-y-2">
                      {screens.map((sc) => (
                        <ScreenRow
                          key={sc.id}
                          screen={sc}
                          endpoints={endpoints ?? []}
                          onUpdate={(data) => updateRoadmapScreen(featureId!, sc.id, data)}
                          onDelete={() => deleteRoadmapScreen(featureId!, sc.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Generate Tickets */}
                {((endpoints?.length ?? 0) + (screens?.length ?? 0)) > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <button
                      onClick={generateTicketsFromBlueprint}
                      disabled={generating}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      <Wand2 className="w-4 h-4" />
                      {generating ? '…' : t('roadmap.generateTickets')}
                    </button>
                    {generatedCount !== null && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {t('roadmap.generatedTickets', { count: generatedCount })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Azure DevOps Tickets ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{t('roadmap.azureTickets')}</h2>
                {tickets && tickets.length > 0 && (
                  <span className="text-xs text-slate-400">({tickets.length} {t('roadmap.tickets')}{totalSP > 0 ? `, ${totalSP} SP` : ''})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tickets && tickets.length > 0 && (
                  <button onClick={copyAllTickets} title={t('roadmap.copyAllTickets')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                    {t('roadmap.copyAll')}
                  </button>
                )}
                <button
                  onClick={() => setShowAddTicket((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {showAddTicket ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddTicket ? t('common.cancel') : t('roadmap.addTicket')}
                </button>
              </div>
            </div>

            {/* SP Summary per area */}
            {tickets && tickets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {TICKET_AREAS.map((area) => {
                  const count = (tickets ?? []).filter((t) => t.area === area).length
                  if (count === 0) return null
                  const ac = TICKET_AREA_CONFIG[area]
                  const AreaIcon = ac.icon
                  return (
                    <button
                      key={area}
                      onClick={() => setTicketAreaFilter(ticketAreaFilter === area ? 'all' : area)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        ticketAreaFilter === area
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                      }`}
                    >
                      <AreaIcon className="w-3 h-3" />
                      {ac.label} ({count}{spByArea[area] > 0 ? ` · ${spByArea[area]} SP` : ''})
                    </button>
                  )
                })}
              </div>
            )}

            {showAddTicket && featureId && (
              <AddTicketForm
                featureId={featureId}
                teams={teamNames}
                onCreated={() => setShowAddTicket(false)}
                onCancel={() => setShowAddTicket(false)}
              />
            )}

            {tickets === null ? (
              <p className="text-sm text-slate-400 py-4 text-center">{t('roadmap.loadingTickets')}</p>
            ) : filteredTickets.length === 0 && !showAddTicket ? (
              <div className="text-center py-8 space-y-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <Ticket className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm text-slate-400">
                  {ticketAreaFilter !== 'all' ? t('roadmap.noTicketsArea') : t('roadmap.noTickets')}
                </p>
                {ticketAreaFilter === 'all' && (
                  <p className="text-xs text-slate-400">{t('roadmap.noTicketsHint')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    featureId={featureId!}
                    teams={teamNames}
                    onUpdate={(data) => updateRoadmapTicket(featureId!, ticket.id, data)}
                    onDelete={() => deleteRoadmapTicket(featureId!, ticket.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="text-xs text-slate-400 dark:text-slate-600 pb-6 flex gap-4">
            <span>{t('roadmap.created')}: {new Date(feature.createdAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })}</span>
            <span>{t('roadmap.updated')}: {new Date(feature.updatedAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })}</span>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteConfirm
          title={feature.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
