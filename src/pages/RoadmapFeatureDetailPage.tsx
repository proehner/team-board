import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import {
  Save, Trash2, Plus, Map, Calendar, Lightbulb, CheckCircle2, ChevronDown, Copy, Check,
  LayoutTemplate, Server, Cpu, AlertTriangle, FileText, Ticket, Download, Wand2,
  Monitor, Code2, MoreHorizontal, ClipboardList, Flag, Circle, Filter,
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Chip from '@/components/ui/Chip'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { LoadingState } from '@/components/ui/Spinner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { RoadmapStatusBadge, PriorityIndicator } from '@/components/roadmap/RoadmapBadges'
import { TicketFormModal, TicketRow } from '@/components/roadmap/RoadmapTicketParts'
import { EndpointFormModal, EndpointRow, ScreenFormModal, ScreenRow } from '@/components/roadmap/BlueprintParts'
import {
  ROADMAP_STATUSES, ROADMAP_PRIORITIES, STATUS_META, PRIORITY_META,
  TICKET_TYPES, TICKET_AREAS, TICKET_TYPE_META, TICKET_AREA_META, COMPLEXITY_META,
  PLANNING_KEYS, type PlanningKey, planningBarCls, dateLocale,
} from '@/components/roadmap/roadmapConfig'
import type {
  RoadmapFeature, RoadmapStatus, RoadmapPriority,
  RoadmapTicketType, RoadmapTicketArea,
} from '@/types'

// ─── Planning sections ────────────────────────────────────────────────────────

const PLANNING_SECTIONS: { key: PlanningKey; icon: React.ElementType; rows: number; placeholder: string; hint: string; exportTitle: string }[] = [
  { key: 'goals',              icon: Lightbulb,      rows: 5, placeholder: 'roadmap.goalsPlaceholder',                   hint: 'roadmap.goalsHint',              exportTitle: 'Ziele & Motivation' },
  { key: 'acceptanceCriteria', icon: CheckCircle2,   rows: 5, placeholder: 'roadmap.acceptanceCriteriaFeaturePlaceholder', hint: 'roadmap.acceptanceCriteriaHint', exportTitle: 'Akzeptanzkriterien' },
  { key: 'uiNotes',            icon: LayoutTemplate, rows: 6, placeholder: 'roadmap.uiNotesPlaceholder',                 hint: 'roadmap.uiNotesHint',            exportTitle: 'Frontend / UI' },
  { key: 'backendNotes',       icon: Server,         rows: 6, placeholder: 'roadmap.backendNotesPlaceholder',            hint: 'roadmap.backendNotesHint',       exportTitle: 'Backend / API' },
  { key: 'technicalNotes',     icon: Cpu,            rows: 5, placeholder: 'roadmap.technicalNotesPlaceholder',          hint: 'roadmap.technicalNotesHint',     exportTitle: 'Technische Entscheidungen' },
  { key: 'risks',              icon: AlertTriangle,  rows: 4, placeholder: 'roadmap.risksPlaceholder',                   hint: 'roadmap.risksHint',              exportTitle: 'Risiken & Herausforderungen' },
]

const QUARTERS = [1, 2, 3, 4] as const

function filledCount(f: Partial<RoadmapFeature>) {
  return PLANNING_KEYS.filter((k) => ((f[k] as string | undefined) ?? '').trim().length > 0).length
}

function parseTags(text: string) {
  return text.split(',').map((tag) => tag.trim()).filter(Boolean)
}

// ─── Collapsible planning section ─────────────────────────────────────────────

interface PlanningSectionProps {
  id: string
  icon: React.ElementType
  title: string
  value: string
  placeholder?: string
  hint?: string
  rows?: number
  expanded: boolean
  onToggle: () => void
  onChange: (v: string) => void
  readOnly?: boolean
}

function PlanningSection({ id, icon: Icon, title, value, placeholder, hint, rows = 6, expanded, onToggle, onChange, readOnly }: PlanningSectionProps) {
  const { t } = useTranslation()
  const filled = value.trim().length > 0
  const preview = value.trim().split('\n')[0]
  return (
    <div id={id} className="scroll-mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`${id}-body`}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          filled ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
        }`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
          {!expanded && (
            <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
              {filled ? preview : <span className="italic text-slate-400 dark:text-slate-500">{t('roadmap.sectionEmpty')}</span>}
            </span>
          )}
        </span>
        {filled && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label={t('roadmap.sectionFilled')} />
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div id={`${id}-body`} className="px-5 pb-5 pt-0.5 animate-fade-in">
          {hint && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
          <textarea
            aria-label={title}
            value={value}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            rows={rows}
            placeholder={readOnly ? '' : placeholder}
            readOnly={readOnly}
            className="form-textarea font-mono text-[13px] leading-relaxed read-only:bg-slate-50 read-only:text-slate-600 dark:read-only:bg-slate-800/40 dark:read-only:text-slate-300"
          />
        </div>
      )}
    </div>
  )
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export default function RoadmapFeatureDetailPage() {
  const { featureId } = useParams<{ featureId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('roadmap')

  const features               = useStore((s) => s.roadmapFeatures)
  const storeLoading           = useStore((s) => s.loading)
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
  const addRoadmapEndpoint     = useStore((s) => s.addRoadmapEndpoint)
  const addRoadmapScreen       = useStore((s) => s.addRoadmapScreen)
  const authTeams              = useStore((s) => s.members) // only used for count check

  // We get the team list from the auth store for display in tickets
  const [teamNames, setTeamNames] = useState<string[]>([])

  const feature   = features.find((f) => f.id === featureId)
  const tickets   = featureId ? (roadmapTickets[featureId] ?? null) : null
  const endpoints = featureId ? (roadmapEndpoints[featureId] ?? null) : null
  const screens   = featureId ? (roadmapScreens[featureId] ?? null) : null

  // Load teams for ticket assignment from the global teams list
  useEffect(() => {
    setTeamNames(useAuthStore.getState().teams.map((tm) => tm.name))
  }, [authTeams])

  useEffect(() => {
    if (featureId && tickets === null) {
      loadRoadmapTickets(featureId).catch((err) => toast.error(t('common.loadError'), { description: errorMessage(err) }))
    }
  }, [featureId, tickets, loadRoadmapTickets, t])

  // ─── Local editable state ────────────────────────────────────────────────
  const [form, setForm]           = useState<Partial<RoadmapFeature>>({})
  const [tagsText, setTagsText]   = useState('')
  const [dirty, setDirty]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const { isBlocked, confirmLeave, cancelLeave, guardedNavigate } = useUnsavedChanges(dirty)
  const [showDelete, setShowDelete]           = useState(false)
  const [showAddTicket, setShowAddTicket]     = useState(false)
  const [ticketAreaFilter, setTicketAreaFilter] = useState<RoadmapTicketArea | 'all'>('all')
  const [ticketTypeFilter, setTicketTypeFilter] = useState<RoadmapTicketType | 'all'>('all')
  const [blueprintOpen, setBlueprintOpen]     = useState(false)
  const [showAddEndpoint, setShowAddEndpoint] = useState(false)
  const [showAddScreen,   setShowAddScreen]   = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [exportCopied, setExportCopied]       = useState(false)

  // Planning sections expand/collapse
  // Editors see every section expanded; read-only viewers only see filled ones expanded by default.
  const [sectionsState, setSectionsState] = useState<Partial<Record<string, boolean>>>({})
  const defaultExpanded = (key: PlanningKey) => canWrite || ((form[key] as string | undefined) ?? '').trim().length > 0
  const isSectionExpanded = (key: PlanningKey) => sectionsState[key] ?? defaultExpanded(key)
  const toggleSection = (key: PlanningKey) => setSectionsState((s) => ({ ...s, [key]: !(s[key] ?? defaultExpanded(key)) }))
  const expandAllSections  = () => setSectionsState(Object.fromEntries(PLANNING_KEYS.map((k) => [k, true])))
  const collapseAllSections = () => setSectionsState(Object.fromEntries(PLANNING_KEYS.map((k) => [k, false])))
  const allCollapsed = PLANNING_KEYS.every((k) => !isSectionExpanded(k))

  function jumpToSection(key: PlanningKey) {
    setSectionsState((s) => ({ ...s, [key]: true }))
    requestAnimationFrame(() => document.getElementById(`plan-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    if (!featureId || !blueprintOpen) return
    const onErr = (err: unknown) => toast.error(t('common.loadError'), { description: errorMessage(err) })
    if (endpoints === null) loadRoadmapEndpoints(featureId).catch(onErr)
    if (screens === null) loadRoadmapScreens(featureId).catch(onErr)
  }, [featureId, blueprintOpen, endpoints, screens, loadRoadmapEndpoints, loadRoadmapScreens, t])

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
        startYear:          feature.startYear,
        startQuarter:       feature.startQuarter,
        category:           feature.category ?? '',
        tags:               feature.tags,
        goals:              feature.goals,
        acceptanceCriteria: feature.acceptanceCriteria,
        uiNotes:            feature.uiNotes,
        backendNotes:       feature.backendNotes,
        technicalNotes:     feature.technicalNotes,
        risks:              feature.risks,
      })
      setTagsText(feature.tags.join(', '))
      setDirty(false)
    }
  }, [feature?.id])

  const updateField = useCallback(<K extends keyof RoadmapFeature>(key: K, value: RoadmapFeature[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }, [])

  // Ctrl+S shortcut — use ref to always call the latest handleSave
  const handleSaveRef = useRef<() => void>(() => {})

  async function generateTicketsFromBlueprint() {
    if (!featureId || !endpoints || !screens) return
    let count = 0
    try {
      for (const ep of endpoints) {
        const desc = [
          `**Methode:** \`${ep.method}\``,
          `**Pfad:** \`${ep.path}\``,
          ep.authRequired ? '**Auth:** Erforderlich' : '**Auth:** Öffentlich',
          `**Komplexität:** ${COMPLEXITY_META[ep.complexity].label}`,
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
      toast.success(t('roadmap.generatedTickets', { count }))
    } catch (err) {
      toast.error(t('roadmap.generateError', { count }), { description: errorMessage(err) })
    }
  }

  async function handleSave() {
    if (!featureId || saving) return
    setSaving(true)
    try {
      await updateRoadmapFeature(featureId, {
        ...form,
        targetVersion:  (form.targetVersion as string)?.trim() || undefined,
        // Send null explicitly so JSON.stringify includes them and the backend clears the column
        targetYear:     (form.targetYear ?? null) as unknown as number,
        targetQuarter:  (form.targetQuarter ?? null) as unknown as 1,
        startYear:      (form.startYear ?? null) as unknown as number,
        startQuarter:   (form.startQuarter ?? null) as unknown as 1,
        category:       (form.category as string)?.trim() || undefined,
        tags:           form.tags ?? [],
      })
      setDirty(false)
      toast.success(t('roadmap.toast.featureSaved'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  // Keep ref in sync so Ctrl+S always calls the current closure
  handleSaveRef.current = handleSave

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (canWrite) handleSaveRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canWrite])

  async function handleDelete() {
    if (!featureId) return
    try {
      await deleteRoadmapFeature(featureId)
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
    toast.success(t('roadmap.toast.featureDeleted'))
    navigate('/roadmap')  // intentional hard nav after delete — no "back" target exists
  }

  function exportAsDocument() {
    const f = { ...feature, ...form } as RoadmapFeature
    const tks = tickets ?? []

    const lines: string[] = [
      `# ${f.title}`,
      '',
      `**Status:** ${STATUS_META[f.status].exportLabel}  |  **Priorität:** ${PRIORITY_META[f.priority].exportLabel}${f.targetVersion ? `  |  **Version:** ${f.targetVersion}` : ''}${f.targetYear ? `  |  **Ziel:** ${f.targetYear}${f.targetQuarter ? ` Q${f.targetQuarter}` : ''}` : ''}${f.category ? `  |  **Kategorie:** ${f.category}` : ''}`,
      f.tags.length > 0 ? `**Tags:** ${f.tags.join(', ')}` : '',
      '',
      f.description ? `> ${f.description}` : '',
      '',
      '---',
    ]

    for (const s of PLANNING_SECTIONS) {
      const content = (f[s.key] as string) ?? ''
      if (!content.trim()) continue
      lines.push('', `## ${s.exportTitle}`, '', content.trim())
    }

    if (tks.length > 0) {
      lines.push('', '---', '', `## Azure DevOps Tickets (${tks.length})`)
      for (const area of TICKET_AREAS) {
        const areaTickets = tks.filter((tk) => tk.area === area)
        if (areaTickets.length === 0) continue
        lines.push('', `### ${TICKET_AREA_META[area].exportLabel}`)
        for (const tk of areaTickets) {
          lines.push(
            '',
            `#### ${tk.title}`,
            `**Typ:** ${TICKET_TYPE_META[tk.type].exportLabel}  |  **Priorität:** ${PRIORITY_META[tk.priority].exportLabel}${tk.storyPoints ? `  |  **SP:** ${tk.storyPoints}` : ''}${tk.assignedTeam ? `  |  **Team:** ${tk.assignedTeam}` : ''}`,
          )
          if (tk.description) lines.push('', tk.description)
          if (tk.acceptanceCriteria) lines.push('', '**Akzeptanzkriterien:**', '', tk.acceptanceCriteria)
          if (tk.tags.length > 0) lines.push('', `**Tags:** ${tk.tags.join(', ')}`)
        }
      }
    }

    const score = filledCount(f)
    lines.push('', '---', `*Planungsfortschritt: ${score}/${PLANNING_KEYS.length} Abschnitte ausgefüllt · Exportiert am ${new Date().toLocaleDateString('de-DE')}*`)

    navigator.clipboard.writeText(lines.filter((l) => l !== null).join('\n'))
      .then(() => {
        setExportCopied(true)
        setTimeout(() => setExportCopied(false), 2500)
        toast.success(t('roadmap.toast.exportCopied'), { description: t('roadmap.toast.exportCopiedHint') })
      })
      .catch((err) => toast.error(t('common.unknownError'), { description: errorMessage(err) }))
  }

  const filteredTickets = useMemo(() => (tickets ?? [])
    .filter((tk) => ticketAreaFilter === 'all' || tk.area === ticketAreaFilter)
    .filter((tk) => ticketTypeFilter === 'all' || tk.type === ticketTypeFilter), [tickets, ticketAreaFilter, ticketTypeFilter])

  function copyAllTickets() {
    const text = filteredTickets.map((tk) => [
      `## ${tk.title}`,
      `**Typ:** ${TICKET_TYPE_META[tk.type].exportLabel}  |  **Bereich:** ${TICKET_AREA_META[tk.area].exportLabel}  |  **Priorität:** ${PRIORITY_META[tk.priority].exportLabel}${tk.storyPoints ? `  |  **SP:** ${tk.storyPoints}` : ''}${tk.assignedTeam ? `  |  **Team:** ${tk.assignedTeam}` : ''}`,
      tk.description ? `\n${tk.description}` : '',
      tk.acceptanceCriteria ? `\n**Akzeptanzkriterien:**\n${tk.acceptanceCriteria}` : '',
    ].filter(Boolean).join('\n')).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
      .then(() => toast.success(t('roadmap.toast.ticketsCopied', { count: filteredTickets.length })))
      .catch((err) => toast.error(t('common.unknownError'), { description: errorMessage(err) }))
  }

  const categories = useMemo(() => {
    const cats = new Set(features.map((f) => f.category).filter(Boolean) as string[])
    return [...cats].sort()
  }, [features])

  // ── Loading / not found ────────────────────────────────────────────────
  if (!feature) {
    return (
      <Page size="default">
        {storeLoading ? (
          <LoadingState label={t('common.loading')} />
        ) : (
          <div className="surface">
            <EmptyState
              icon={<Map />}
              title={t('roadmap.featureNotFound')}
              description={t('roadmap.featureNotFoundHint')}
              action={<Button variant="secondary" onClick={() => navigate('/roadmap')}>{t('roadmap.backToRoadmap')}</Button>}
            />
          </div>
        )}
      </Page>
    )
  }

  const status   = (form.status ?? feature.status) as RoadmapStatus
  const priority = (form.priority ?? feature.priority) as RoadmapPriority
  const score    = filledCount(form)
  const locale   = dateLocale(i18n.language)
  const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })

  // Story points sum per area
  const spByArea = TICKET_AREAS.reduce<Record<RoadmapTicketArea, number>>((acc, a) => {
    acc[a] = (tickets ?? []).filter((tk) => tk.area === a).reduce((s, tk) => s + (tk.storyPoints ?? 0), 0)
    return acc
  }, {} as Record<RoadmapTicketArea, number>)
  const totalSP = Object.values(spByArea).reduce((a, b) => a + b, 0)
  const withSP  = (tickets ?? []).filter((tk) => tk.storyPoints !== undefined && tk.storyPoints !== null).length

  const target = [
    feature.targetVersion,
    feature.targetYear ? `${feature.targetYear}${feature.targetQuarter ? ` Q${feature.targetQuarter}` : ''}` : '',
  ].filter(Boolean).join(' · ')

  const subtitleParts = [
    feature.category,
    target && `${t('roadmap.target')}: ${target}`,
    `${t('roadmap.updated')} ${fmtDate(feature.updatedAt)}`,
  ].filter(Boolean)

  const blueprintCount = (endpoints?.length ?? 0) + (screens?.length ?? 0)
  const readOnlyInput = 'read-only:bg-slate-50 read-only:text-slate-600 dark:read-only:bg-slate-800/40 dark:read-only:text-slate-300'

  return (
    <Page size="default">
      <PageHeader
        back={{ onClick: () => guardedNavigate(-1), label: t('roadmap.backToRoadmap') }}
        title={(form.title as string)?.trim() || feature.title}
        documentTitle={feature.title}
        meta={
          <>
            <RoadmapStatusBadge status={status} />
            <PriorityIndicator priority={priority} />
            {dirty && <Badge variant="warning" dot label={t('roadmap.unsavedChanges')} />}
          </>
        }
        subtitle={subtitleParts.join(' · ')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={exportCopied ? <Check className="text-emerald-500" /> : <Download />}
              onClick={exportAsDocument}
              title={t('roadmap.exportDocumentHint')}
            >
              {exportCopied ? t('roadmap.exportCopied') : t('roadmap.exportDocument')}
            </Button>
            {canWrite && (
              <Button variant="primary" icon={<Save />} onClick={handleSave} disabled={!dirty} loading={saving} title={`${t('common.save')} (Ctrl+S)`}>
                {t('common.save')}
              </Button>
            )}
            {canWrite && (
              <DropdownMenu
                trigger={(p) => <IconButton {...p} variant="secondary" size="md" icon={<MoreHorizontal />} label={t('common.moreActions')} />}
                items={[
                  { label: t('roadmap.deleteFeatureTitle'), icon: <Trash2 />, danger: true, onClick: () => setShowDelete(true) },
                ]}
              />
            )}
          </>
        }
      />

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      <div className="space-y-6">
        {/* ── Details ── */}
        <Card title={t('roadmap.detailsCard')} icon={<FileText />}>
          <div className="space-y-5">
            <Field label={t('roadmap.featureTitle')} htmlFor="fd-title" required={canWrite}>
              <input
                id="fd-title"
                value={(form.title as string) ?? ''}
                onChange={(e) => updateField('title', e.target.value)}
                readOnly={!canWrite}
                className={`form-input text-base font-semibold ${readOnlyInput}`}
                placeholder={t('roadmap.featureTitle')}
              />
            </Field>
            <Field label={t('roadmap.shortDescription')} htmlFor="fd-desc">
              <textarea
                id="fd-desc"
                value={(form.description as string) ?? ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                readOnly={!canWrite}
                className={`form-textarea ${readOnlyInput}`}
                placeholder={canWrite ? t('roadmap.shortDescriptionPlaceholder') : ''}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t('roadmap.status')} htmlFor="fd-status">
                <Select
                  id="fd-status"
                  value={status}
                  onChange={(e) => updateField('status', e.target.value as RoadmapStatus)}
                  disabled={!canWrite}
                  icon={<span className={`block h-2 w-2 rounded-full ${STATUS_META[status].dotCls}`} />}
                >
                  {ROADMAP_STATUSES.map((s) => <option key={s} value={s}>{t(`roadmap.statusLabels.${s}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('roadmap.priority')} htmlFor="fd-priority">
                <Select
                  id="fd-priority"
                  value={priority}
                  onChange={(e) => updateField('priority', e.target.value as RoadmapPriority)}
                  disabled={!canWrite}
                  icon={<Flag />}
                >
                  {ROADMAP_PRIORITIES.map((p) => <option key={p} value={p}>{t(`roadmap.priorityLabels.${p}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('roadmap.targetVersion')} htmlFor="fd-version">
                <input
                  id="fd-version"
                  value={(form.targetVersion as string) ?? ''}
                  onChange={(e) => updateField('targetVersion', e.target.value)}
                  placeholder="v2.0" readOnly={!canWrite}
                  className={`form-input ${readOnlyInput}`}
                />
              </Field>
              <Field label={t('roadmap.category')} htmlFor="fd-category">
                <input
                  id="fd-category"
                  list="fd-category-list"
                  value={(form.category as string) ?? ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  placeholder={canWrite ? t('roadmap.categoryPlaceholder') : ''}
                  readOnly={!canWrite}
                  className={`form-input ${readOnlyInput}`}
                />
                <datalist id="fd-category-list">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 section-label">
                <Calendar className="h-3.5 w-3.5" />
                {t('roadmap.schedule')}
              </p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Field label={t('roadmap.startYear')} htmlFor="fd-start-year">
                  <input
                    id="fd-start-year"
                    type="number" min={2024} max={2035} inputMode="numeric"
                    value={form.startYear ?? ''}
                    onChange={(e) => updateField('startYear', e.target.value ? Number(e.target.value) : undefined as unknown as number)}
                    placeholder="2025" readOnly={!canWrite}
                    className={`form-input tabular-nums ${readOnlyInput}`}
                  />
                </Field>
                <Field label={t('roadmap.startQuarter')} htmlFor="fd-start-q">
                  <Select
                    id="fd-start-q"
                    value={form.startQuarter ?? ''}
                    onChange={(e) => updateField('startQuarter', e.target.value ? Number(e.target.value) as 1 | 2 | 3 | 4 : undefined as unknown as 1)}
                    disabled={!canWrite}
                  >
                    <option value="">{t('roadmap.quarterNotSet')}</option>
                    {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
                  </Select>
                </Field>
                <Field label={t('roadmap.targetYear')} htmlFor="fd-target-year">
                  <input
                    id="fd-target-year"
                    type="number" min={2024} max={2035} inputMode="numeric"
                    value={form.targetYear ?? ''}
                    onChange={(e) => updateField('targetYear', e.target.value ? Number(e.target.value) : undefined as unknown as number)}
                    placeholder="2025" readOnly={!canWrite}
                    className={`form-input tabular-nums ${readOnlyInput}`}
                  />
                </Field>
                <Field label={t('roadmap.targetQuarter')} htmlFor="fd-target-q">
                  <Select
                    id="fd-target-q"
                    value={form.targetQuarter ?? ''}
                    onChange={(e) => updateField('targetQuarter', e.target.value ? Number(e.target.value) as 1 | 2 | 3 | 4 : undefined as unknown as 1)}
                    disabled={!canWrite}
                  >
                    <option value="">{t('roadmap.quarterNotSet')}</option>
                    {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
                  </Select>
                </Field>
              </div>
            </div>

            <Field label={t('roadmap.tags')} htmlFor="fd-tags" hint={canWrite ? t('roadmap.tagsSeparator') : undefined}>
              <input
                id="fd-tags"
                value={tagsText}
                onChange={(e) => { setTagsText(e.target.value); updateField('tags', parseTags(e.target.value)) }}
                placeholder={canWrite ? 'dashboard, ui, api' : ''}
                readOnly={!canWrite}
                className={`form-input ${readOnlyInput}`}
              />
            </Field>
          </div>
        </Card>

        {/* ── Planning ── */}
        <Card
          title={t('roadmap.planningDetails')}
          subtitle={`${score}/${PLANNING_KEYS.length} ${t('roadmap.sectionsFilled')}`}
          icon={<ClipboardList />}
          padding={false}
          action={
            <Button size="xs" variant="ghost" onClick={allCollapsed ? expandAllSections : collapseAllSections}>
              {allCollapsed ? t('roadmap.expandAll') : t('roadmap.collapseAll')}
            </Button>
          }
        >
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={PLANNING_KEYS.length} aria-valuenow={score} aria-label={t('roadmap.planningProgress')}>
                <div className={`h-full rounded-full transition-all ${planningBarCls(score, PLANNING_KEYS.length)}`} style={{ width: `${(score / PLANNING_KEYS.length) * 100}%` }} />
              </div>
              <span className={`text-xs font-semibold tabular-nums ${score === PLANNING_KEYS.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {Math.round((score / PLANNING_KEYS.length) * 100)}%
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PLANNING_KEYS.map((key) => {
                const filled = ((form[key] as string) ?? '').trim().length > 0
                return (
                  <Chip
                    key={key}
                    active={filled}
                    icon={filled ? <Check /> : <Circle />}
                    onClick={() => jumpToSection(key)}
                    title={t('roadmap.jumpToSection')}
                  >
                    {t(`roadmap.planningShort.${key}`)}
                  </Chip>
                )
              })}
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {PLANNING_SECTIONS.map((s) => (
              <PlanningSection
                key={s.key}
                id={`plan-${s.key}`}
                icon={s.icon}
                title={t(`roadmap.${s.key}`)}
                value={(form[s.key] as string) ?? ''}
                onChange={(v) => updateField(s.key, v)}
                placeholder={t(s.placeholder)}
                hint={t(s.hint)}
                rows={s.rows}
                expanded={isSectionExpanded(s.key)}
                onToggle={() => toggleSection(s.key)}
                readOnly={!canWrite}
              />
            ))}
          </div>
        </Card>

        {/* ── Technical Blueprint ── */}
        <section className="surface overflow-hidden">
          <button
            type="button"
            onClick={() => setBlueprintOpen((v) => !v)}
            aria-expanded={blueprintOpen}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Code2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{t('roadmap.blueprint')}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {endpoints !== null && screens !== null
                  ? t('roadmap.blueprintSummary', { endpoints: endpoints.length, screens: screens.length })
                  : t('roadmap.blueprintHintShort')}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${blueprintOpen ? 'rotate-180' : ''}`} />
          </button>

          {blueprintOpen && (
            <div className="space-y-6 border-t border-slate-100 px-5 py-5 animate-fade-in dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('roadmap.blueprintHint')}</p>

              {/* API Endpoints */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 section-label">
                    <Server className="h-3.5 w-3.5" />
                    {t('roadmap.endpoints')}
                    {endpoints && <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">{endpoints.length}</span>}
                  </h3>
                  {canWrite && (
                    <Button size="xs" variant="subtle" icon={<Plus />} onClick={() => setShowAddEndpoint(true)}>
                      {t('roadmap.addEndpoint')}
                    </Button>
                  )}
                </div>
                {endpoints === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : endpoints.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    <EmptyState compact icon={<Server />} title={t('roadmap.noEndpoints')} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {endpoints.map((ep) => (
                      <EndpointRow
                        key={ep.id}
                        endpoint={ep}
                        onUpdate={(data) => updateRoadmapEndpoint(featureId!, ep.id, data)}
                        onDelete={() => deleteRoadmapEndpoint(featureId!, ep.id)}
                        canWrite={canWrite}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Frontend Screens */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 section-label">
                    <Monitor className="h-3.5 w-3.5" />
                    {t('roadmap.screens')}
                    {screens && <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">{screens.length}</span>}
                  </h3>
                  {canWrite && (
                    <Button size="xs" variant="subtle" icon={<Plus />} onClick={() => setShowAddScreen(true)}>
                      {t('roadmap.addScreen')}
                    </Button>
                  )}
                </div>
                {screens === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : screens.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    <EmptyState compact icon={<Monitor />} title={t('roadmap.noScreens')} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {screens.map((sc) => (
                      <ScreenRow
                        key={sc.id}
                        screen={sc}
                        endpoints={endpoints ?? []}
                        onUpdate={(data) => updateRoadmapScreen(featureId!, sc.id, data)}
                        onDelete={() => deleteRoadmapScreen(featureId!, sc.id)}
                        canWrite={canWrite}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Tickets */}
              {canWrite && blueprintCount > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center dark:border-indigo-500/20 dark:bg-indigo-500/[0.07]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('roadmap.generateTickets')}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('roadmap.generateTicketsHint', { count: blueprintCount })}</p>
                  </div>
                  <Button variant="primary" icon={<Wand2 />} onClick={() => setConfirmGenerate(true)} className="shrink-0">
                    {t('roadmap.generateTicketsShort')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Azure DevOps Tickets ── */}
        <Card
          title={t('roadmap.azureTickets')}
          subtitle={tickets && tickets.length > 0
            ? `${t('roadmap.workload.ticketCount', { count: tickets.length })}${totalSP > 0 ? ` · ${totalSP} SP` : ''}`
            : undefined}
          icon={<Ticket />}
          padding={false}
          action={
            <>
              {tickets && tickets.length > 0 && (
                <Button size="sm" variant="secondary" icon={<Copy />} onClick={copyAllTickets} title={t('roadmap.copyAllTickets')} aria-label={t('roadmap.copyAllTickets')}>
                  <span className="hidden sm:inline">{t('roadmap.copyAll')}</span>
                </Button>
              )}
              {canWrite && (
                <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setShowAddTicket(true)} aria-label={t('roadmap.addTicket')}>
                  <span className="hidden sm:inline">{t('roadmap.addTicket')}</span>
                </Button>
              )}
            </>
          }
        >
          {/* Area + type filters + SP coverage */}
          {tickets && tickets.length > 0 && (
            <div className="space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('roadmap.ticketArea')}>
                {TICKET_AREAS.map((area) => {
                  const count = tickets.filter((tk) => tk.area === area).length
                  if (count === 0) return null
                  const AreaIcon = TICKET_AREA_META[area].icon
                  return (
                    <Chip
                      key={area}
                      active={ticketAreaFilter === area}
                      icon={<AreaIcon />}
                      count={count}
                      onClick={() => setTicketAreaFilter(ticketAreaFilter === area ? 'all' : area)}
                    >
                      {t(`roadmap.areas.${area}`)}
                      {spByArea[area] > 0 && <span className="font-normal opacity-70">· {spByArea[area]} SP</span>}
                    </Chip>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs
                  variant="pills"
                  size="sm"
                  aria-label={t('roadmap.ticketType')}
                  value={ticketTypeFilter}
                  onChange={setTicketTypeFilter}
                  items={[
                    { value: 'all' as const, label: t('roadmap.allTicketTypes') },
                    ...TICKET_TYPES.map((tp) => ({ value: tp, label: t(`roadmap.ticketTypes.${tp}`) })),
                  ]}
                />
                <span className={`ml-auto text-xs tabular-nums ${withSP === tickets.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {t('roadmap.spEstimated', { n: withSP, total: tickets.length })}
                </span>
              </div>
            </div>
          )}

          {tickets === null ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filteredTickets.length === 0 ? (
            tickets.length > 0 ? (
              <EmptyState
                compact
                icon={<Filter />}
                title={t('roadmap.noTicketsFiltered')}
                action={
                  <Button size="sm" variant="secondary" onClick={() => { setTicketAreaFilter('all'); setTicketTypeFilter('all') }}>
                    {t('common.resetFilters')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                compact
                icon={<Ticket />}
                title={t('roadmap.noTickets')}
                description={t('roadmap.noTicketsHint')}
                action={canWrite && (
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setShowAddTicket(true)}>
                    {t('roadmap.addTicket')}
                  </Button>
                )}
              />
            )
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  teams={teamNames}
                  onUpdate={(data) => updateRoadmapTicket(featureId!, ticket.id, data)}
                  onDelete={() => deleteRoadmapTicket(featureId!, ticket.id)}
                  canWrite={canWrite}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Meta info */}
        <p className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-xs text-slate-400 dark:text-slate-500">
          <span>{t('roadmap.created')}: {fmtDate(feature.createdAt)}</span>
          <span>{t('roadmap.updated')}: {fmtDate(feature.updatedAt)}</span>
        </p>

        {/* Sticky save bar */}
        {canWrite && dirty && (
          <div className="sticky bottom-4 z-20 animate-slide-up">
            <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-popover backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{t('roadmap.unsavedChanges')}</span>
              <span className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex">
                <kbd className="kbd">Ctrl</kbd><kbd className="kbd">S</kbd>
              </span>
              <Button size="sm" variant="primary" icon={<Save />} onClick={handleSave} loading={saving}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      {canWrite && featureId && (
        <>
          <TicketFormModal
            isOpen={showAddTicket}
            onClose={() => setShowAddTicket(false)}
            teams={teamNames}
            onSubmit={async (data) => { await addRoadmapTicket(featureId, data) }}
          />
          <EndpointFormModal
            isOpen={showAddEndpoint}
            onClose={() => setShowAddEndpoint(false)}
            onSubmit={async (data) => { await addRoadmapEndpoint(featureId, data) }}
          />
          <ScreenFormModal
            isOpen={showAddScreen}
            onClose={() => setShowAddScreen(false)}
            endpoints={endpoints ?? []}
            onSubmit={async (data) => { await addRoadmapScreen(featureId, data) }}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('roadmap.deleteFeatureTitle')}
        message={t('roadmap.deleteFeatureConfirm', { title: feature.title })}
        confirmLabel={t('common.delete')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={generateTicketsFromBlueprint}
        title={t('roadmap.generateTickets')}
        message={t('roadmap.generateTicketsConfirm', { count: blueprintCount })}
        confirmLabel={t('roadmap.generateTicketsShort')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={isBlocked}
        onClose={cancelLeave}
        onConfirm={confirmLeave}
        title={t('confirmDialog.unsavedTitle')}
        message={t('confirmDialog.unsavedMessage')}
        confirmLabel={t('confirmDialog.unsavedLeave')}
        cancelLabel={t('confirmDialog.unsavedStay')}
        variant="warning"
      />
    </Page>
  )
}
