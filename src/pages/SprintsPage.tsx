import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SprintLineChart from '@/components/ui/SprintLineChart'
import type { SprintChartSeries } from '@/components/ui/SprintLineChart'
import { formatDate, formatDateShort } from '@/utils/date'
import { buildSprintName, sprintEndDate, suggestNextSprint, SPRINT_NAME_PLACEHOLDERS } from '@/utils/sprint'
import { usePagePermission } from '@/hooks/usePagePermission'
import { Plus, Zap, Calendar, Target, ChevronRight, Edit2, Trash2, Play, CheckCircle, X, TrendingUp, BarChart2, Settings, Filter } from 'lucide-react'
import type { Sprint, SprintStatus, SprintGoalMet, SprintSettings } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default',
  Aktiv: 'info',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

type MainTab = SprintStatus | 'Alle' | 'Auswertung'

const STATUS_TABS: (SprintStatus | 'Alle')[] = ['Alle', 'Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

interface SprintFormData {
  name: string
  goal: string
  startDate: string
  endDate: string
  notes: string
}

/** ISO weekday (1 = Monday … 7 = Sunday) → i18n key under `meetings.days`. */
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface DateRange {
  from: string
  to: string
}

const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Default analysis range: exactly one year, ending today. */
function defaultAnalysisRange(): DateRange {
  const today = new Date()
  const from = new Date(today)
  from.setFullYear(from.getFullYear() - 1)
  return { from: isoDate(from), to: isoDate(today) }
}

const calendarYearRange = (year: number): DateRange => ({ from: `${year}-01-01`, to: `${year}-12-31` })

// ─── Chart series definitions ─────────────────────────────────────────────────
const CHART_SERIES_ALL: SprintChartSeries[] = [
  { key: 'capacityHours',   label: 'Kapazität (h)',       color: '#6366f1' },
  { key: 'remainingHours',  label: 'Remaining (h)',       color: '#f59e0b' },
  { key: 'averageBurndown', label: 'Avg. Burndown',       color: '#10b981', dashed: true },
  { key: 'completedTimePct',label: 'Abgeschl. Zeit (%)',  color: '#8b5cf6' },
  { key: 'completedItems',  label: 'Abgeschl. Items',     color: '#ec4899' },
  { key: 'velocity',        label: 'Velocity (SP)',       color: '#0ea5e9' },
]

export default function SprintsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { canWrite, isReadOnly } = usePagePermission('sprints')
  const sprints = useStore((s) => s.sprints)
  const addSprint = useStore((s) => s.addSprint)
  const updateSprint = useStore((s) => s.updateSprint)
  const deleteSprint = useStore((s) => s.deleteSprint)
  const setSprintStatus = useStore((s) => s.setSprintStatus)
  const sprintSettings = useStore((s) => s.sprintSettings)
  const updateSprintSettings = useStore((s) => s.updateSprintSettings)

  const [tab, setTab] = useState<MainTab>('Aktiv')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Sprint | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)
  const [form, setForm] = useState<SprintFormData>(defaultForm())
  const [errors, setErrors] = useState<Partial<SprintFormData>>({})
  const [saveError, setSaveError] = useState('')
  const [activeSeriesKeys, setActiveSeriesKeys] = useState<Set<string>>(
    new Set(CHART_SERIES_ALL.map((s) => s.key)),
  )
  // Set as soon as the user edits the name by hand – the suggestion then stops
  // overwriting it when the start date changes.
  const [nameTouched, setNameTouched] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState<SprintSettings>(sprintSettings)
  const [settingsError, setSettingsError] = useState('')
  const [range, setRange] = useState<DateRange>(defaultAnalysisRange)

  /** Pre-fills a new sprint with the next name and dates from the configuration. */
  function defaultForm(): SprintFormData {
    const next = suggestNextSprint(sprints, sprintSettings)
    return { name: next.name, goal: '', startDate: next.startDate, endDate: next.endDate, notes: '' }
  }

  /** Start date drives end date and – until edited – the suggested name. */
  function handleStartDateChange(startDate: string) {
    setForm((f) => ({
      ...f,
      startDate,
      endDate: !editTarget && startDate ? sprintEndDate(startDate, sprintSettings) : f.endDate,
      name: !editTarget && !nameTouched && startDate
        ? buildSprintName(startDate, sprintSettings, sprints.length + 1)
        : f.name,
    }))
  }

  const isAuswertung = tab === 'Auswertung'
  const filtered = isAuswertung
    ? []
    : tab === 'Alle'
    ? sprints
    : sprints.filter((s) => s.status === tab)
  const sorted = [...filtered].sort((a, b) => b.startDate.localeCompare(a.startDate))

  // Chart data: abgeschlossene Sprints chronologisch, gefiltert nach Zeitraum
  const completedSprints = [...sprints]
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const chartSprints = completedSprints.filter(
    (sp) => (!range.from || sp.startDate >= range.from) && (!range.to || sp.startDate <= range.to),
  )
  const hiddenByFilter = completedSprints.length - chartSprints.length

  const chartData = chartSprints.map((sp) => {
    const pct =
      sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined
        ? Math.round(((sp.capacityHours - sp.remainingHours) / sp.capacityHours) * 100)
        : undefined
    return {
      sprintName: sp.name,
      capacityHours:    sp.capacityHours,
      remainingHours:   sp.remainingHours,
      averageBurndown:  sp.averageBurndown,
      completedTimePct: pct,
      completedItems:   sp.completedItems,
      velocity:         sp.velocity,
    }
  })

  const activeSeries = CHART_SERIES_ALL.filter((s) => activeSeriesKeys.has(s.key))

  function toggleSeries(key: string) {
    setActiveSeriesKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  function openAdd() {
    setEditTarget(null)
    setNameTouched(false)
    setForm(defaultForm())
    setErrors({})
    setShowModal(true)
  }

  function openEdit(sp: Sprint) {
    setEditTarget(sp)
    setNameTouched(true)
    setForm({ name: sp.name, goal: sp.goal, startDate: sp.startDate, endDate: sp.endDate, notes: sp.notes })
    setErrors({})
    setShowModal(true)
  }

  function validate(): boolean {
    const e: Partial<SprintFormData> = {}
    if (!form.name.trim()) e.name = t('sprints.nameRequired')
    if (!form.goal.trim()) e.goal = t('sprints.goalRequired')
    if (!form.startDate) e.startDate = t('sprints.startDateRequired')
    if (!form.endDate) e.endDate = t('sprints.endDateRequired')
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      e.endDate = t('sprints.endDateAfterStart')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaveError('')
    try {
      if (editTarget) {
        await updateSprint(editTarget.id, form)
      } else {
        const id = await addSprint(form)
        navigate(`/sprints/${id}`)
      }
      setShowModal(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  function openSettings() {
    setSettingsForm(sprintSettings)
    setSettingsError('')
    setShowSettings(true)
  }

  async function handleSettingsSubmit() {
    if (!settingsForm.namePattern.trim()) {
      setSettingsError(t('sprints.patternRequired'))
      return
    }
    if (settingsForm.durationWeeks < 1 || settingsForm.durationWeeks > 12) {
      setSettingsError(t('sprints.durationInvalid'))
      return
    }
    try {
      await updateSprintSettings({ ...settingsForm, namePattern: settingsForm.namePattern.trim() })
      setShowSettings(false)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  // Live preview of the next sprint for the settings dialog
  const settingsPreview = suggestNextSprint(sprints, settingsForm)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sprints.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('sprints.count', { count: sprints.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="secondary" icon={<Settings className="w-4 h-4" />} onClick={openSettings}>
              {t('sprints.settings')}
            </Button>
          )}
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd} disabled={!canWrite}>
            {t('sprints.newSprint')}
          </Button>
        </div>
      </div>
      {isReadOnly && <ReadOnlyBanner />}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tabKey) => {
          const count = tabKey === 'Alle' ? sprints.length : sprints.filter((s) => s.status === tabKey).length
          const label = tabKey === 'Alle' ? t('common.all') : t(`sprintStatus.${tabKey}`)
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === tabKey
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === tabKey ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        {/* Auswertungs-Tab */}
        <button
          onClick={() => setTab('Auswertung')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'Auswertung'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          {t('sprints.analysis')}
        </button>
      </div>

      {/* ── Auswertungs-View ── */}
      {isAuswertung && (
        <div className="space-y-5">
          {/* Zeitraum-Filter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              {t('sprints.period')}
            </div>
            <div className="space-y-1 w-40">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">{t('sprints.periodFrom')}</label>
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="form-input"
              />
            </div>
            <div className="space-y-1 w-40">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">{t('sprints.periodTo')}</label>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="form-input"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-0.5">
              <RangePreset label={t('sprints.periodLast12Months')} onClick={() => setRange(defaultAnalysisRange())} />
              <RangePreset label={String(new Date().getFullYear())} onClick={() => setRange(calendarYearRange(new Date().getFullYear()))} />
              <RangePreset label={String(new Date().getFullYear() - 1)} onClick={() => setRange(calendarYearRange(new Date().getFullYear() - 1))} />
              <RangePreset label={t('common.all')} onClick={() => setRange({ from: '', to: '' })} />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto mb-2">
              {t('sprints.periodCount', { shown: chartSprints.length, total: completedSprints.length })}
            </p>
          </div>

          {chartSprints.length < 2 ? (
            <EmptyState
              icon={<BarChart2 className="w-12 h-12" />}
              title={t('sprints.analysisEmpty')}
              description={
                hiddenByFilter > 0
                  ? t('sprints.analysisFilterEmptySubtitle', { count: hiddenByFilter })
                  : t('sprints.analysisEmptySubtitle')
              }
            />
          ) : (
            <>
              {/* Series toggle */}
              <div className="flex flex-wrap gap-2">
                {CHART_SERIES_ALL.map((s) => {
                  const active = activeSeriesKeys.has(s.key)
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSeries(s.key)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900'
                      }`}
                      style={active ? { backgroundColor: s.color, borderColor: s.color } : {}}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? 'white' : s.color }}
                      />
                      {s.label}
                    </button>
                  )
                })}
              </div>

              {/* Chart */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <SprintLineChart
                  series={activeSeries}
                  data={chartData}
                  height={280}
                />
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableSprint')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCapacityH')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableRemainingH')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableAvgBurndown')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCompletedTimePct')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCompletedItems')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableVelocity')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableGoalMet')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartSprints.map((sp) => {
                      const pct =
                        sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined
                          ? Math.round(((sp.capacityHours - sp.remainingHours) / sp.capacityHours) * 100)
                          : null
                      return (
                        <tr key={sp.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{sp.name}</td>
                          <Num val={sp.capacityHours} />
                          <Num val={sp.remainingHours} />
                          <Num val={sp.averageBurndown} decimal />
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {pct !== null ? `${pct}%` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <Num val={sp.completedItems} />
                          <Num val={sp.velocity} />
                          <td className="px-4 py-3 text-right">
                            {sp.goalMet
                              ? <GoalMetBadge value={sp.goalMet} />
                              : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {chartSprints.length > 1 && (() => {
                    const avg = (key: (sp: typeof chartSprints[0]) => number | undefined) => {
                      const vals = chartSprints.map(key).filter((v): v is number => v !== undefined)
                      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
                    }
                    const avgPct = (() => {
                      const vals = chartSprints
                        .filter((sp) => sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined)
                        .map((sp) => Math.round(((sp.capacityHours! - sp.remainingHours!) / sp.capacityHours!) * 100))
                      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined
                    })()
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                          <td className="px-4 py-3 text-xs uppercase tracking-wide">{t('common.average')}</td>
                          <AvgNum val={avg((sp) => sp.capacityHours)} />
                          <AvgNum val={avg((sp) => sp.remainingHours)} />
                          <AvgNum val={avg((sp) => sp.averageBurndown)} decimal />
                          <td className="px-4 py-3 text-right text-xs">{avgPct !== undefined ? `${avgPct}%` : '—'}</td>
                          <AvgNum val={avg((sp) => sp.completedItems)} />
                          <AvgNum val={avg((sp) => sp.velocity)} />
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sprint list ── */}
      {!isAuswertung && (
        sorted.length === 0 ? (
          <EmptyState
            icon={<Zap className="w-12 h-12" />}
            title={t('sprints.noSprints')}
            description={t('sprints.noSprintsSubtitle')}
            action={canWrite ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>{t('sprints.newSprint')}</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((sp) => (
              <SprintCard
                key={sp.id}
                sprint={sp}
                canWrite={canWrite}
                onEdit={() => openEdit(sp)}
                onDelete={() => setDeleteTarget(sp)}
                onStatusChange={(status) => setSprintStatus(sp.id, status)}
                onClick={() => navigate(`/sprints/${sp.id}`)}
              />
            ))}
          </div>
        )
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? t('sprints.editSprint') : t('sprints.newSprint')}
        footer={
          <>
            {saveError && <p className="flex-1 text-sm text-red-600">{saveError}</p>}
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSubmit}>{editTarget ? t('common.save') : t('common.create')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('common.name')} error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setNameTouched(true); setForm((f) => ({ ...f, name: e.target.value })) }}
              className="form-input"
            />
          </FormField>
          <FormField label={t('sprints.sprintGoal')} error={errors.goal}>
            <textarea value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} rows={2} className="form-textarea" placeholder={t('sprints.sprintGoalPlaceholder')} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('sprints.startDate')} error={errors.startDate}>
              <input type="date" value={form.startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('sprints.endDate')} error={errors.endDate}>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="form-input" />
            </FormField>
          </div>
          <FormField label={t('sprints.notes')}>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="form-textarea" placeholder={t('sprints.notesPlaceholder')} />
          </FormField>
        </div>
      </Modal>

      {/* Sprint settings modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title={t('sprints.settings')}
        footer={
          <>
            {settingsError && <p className="flex-1 text-sm text-red-600">{settingsError}</p>}
            <Button variant="secondary" onClick={() => setShowSettings(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSettingsSubmit}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('sprints.settingsIntro')}</p>

          <FormField label={t('sprints.namePattern')}>
            <input
              type="text"
              value={settingsForm.namePattern}
              onChange={(e) => setSettingsForm((f) => ({ ...f, namePattern: e.target.value }))}
              className="form-input font-mono"
              placeholder="{YYYY}_{KW1}_{KW2}"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t('sprints.namePatternHelp')}{' '}
              {SPRINT_NAME_PLACEHOLDERS.map((ph) => (
                <code key={ph} className="mx-0.5 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{ph}</code>
              ))}
            </p>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label={t('sprints.durationWeeks')}>
              <input
                type="number"
                min={1}
                max={12}
                value={settingsForm.durationWeeks}
                onChange={(e) => setSettingsForm((f) => ({ ...f, durationWeeks: Number(e.target.value) }))}
                className="form-input"
              />
            </FormField>
            <FormField label={t('sprints.startWeekday')}>
              <select
                value={settingsForm.startWeekday}
                onChange={(e) => setSettingsForm((f) => ({ ...f, startWeekday: Number(e.target.value) }))}
                className="form-input"
              >
                {WEEKDAY_KEYS.map((key, i) => (
                  <option key={key} value={i + 1}>{t(`meetings.days.${key}`)}</option>
                ))}
              </select>
            </FormField>
            <FormField label={t('sprints.endWeekday')}>
              <select
                value={settingsForm.endWeekday}
                onChange={(e) => setSettingsForm((f) => ({ ...f, endWeekday: Number(e.target.value) }))}
                className="form-input"
              >
                {WEEKDAY_KEYS.map((key, i) => (
                  <option key={key} value={i + 1}>{t(`meetings.days.${key}`)}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t('sprints.settingsPreview')}
            </p>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              <span className="font-mono font-semibold">{settingsPreview.name || '—'}</span>
              {settingsPreview.startDate && (
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}· {formatDateShort(settingsPreview.startDate)} – {formatDateShort(settingsPreview.endDate)}
                </span>
              )}
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteSprint(deleteTarget.id) }}
        title={t('sprints.deleteSprint')}
        message={t('sprints.deleteConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

// ─── Analysis filter helpers ──────────────────────────────────────────────────

function RangePreset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      {label}
    </button>
  )
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function Num({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
      {val !== undefined && val !== null
        ? decimal ? val.toFixed(1) : val
        : <span className="text-slate-300 dark:text-slate-600">—</span>}
    </td>
  )
}

function AvgNum({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-3 text-right text-xs">
      {val !== undefined ? (decimal ? val.toFixed(1) : Math.round(val)) : '—'}
    </td>
  )
}

const GOAL_MET_BADGE: Record<SprintGoalMet, string> = {
  Ja:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Teilweise:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Nein:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function GoalMetBadge({ value }: { value: SprintGoalMet }) {
  const { t } = useTranslation()
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GOAL_MET_BADGE[value]}`}>
      {t(`sprintDetail.goalMet_${value}`)}
    </span>
  )
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

interface SprintCardProps {
  sprint: Sprint
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: SprintStatus) => void
  onClick: () => void
}

function SprintCard({ sprint, canWrite, onEdit, onDelete, onStatusChange, onClick }: SprintCardProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-start gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
      <button className="flex-1 text-left" onClick={onClick}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{sprint.name}</span>
            <Badge label={t(`sprintStatus.${sprint.status}`)} variant={STATUS_VARIANTS[sprint.status]} dot />
            {sprint.goalMet && <GoalMetBadge value={sprint.goalMet} />}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
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
          {sprint.plannedPoints > 0 && (
            <span className="flex items-center gap-0.5">
              <Target className="w-3 h-3" />{sprint.plannedPoints} SP
            </span>
          )}
          {sprint.velocity !== undefined && (
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />{sprint.velocity} SP
            </span>
          )}
        </div>
      </button>

      {canWrite && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {sprint.status === 'Geplant' && (
            <button onClick={() => onStatusChange('Aktiv')} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
              <Play className="w-4 h-4" />
            </button>
          )}
          {sprint.status === 'Aktiv' && (
            <button onClick={() => onStatusChange('Abgeschlossen')} className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {sprint.status === 'Aktiv' && (
            <button onClick={() => onStatusChange('Abgebrochen')} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
      )}
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
