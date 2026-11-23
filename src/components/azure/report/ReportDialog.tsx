import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Download, FileText, Lightbulb, Sparkles } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import { useStore } from '@/store'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast, errorMessage } from '@/store/toast'
import { apiFetch, fmt, locale as appLocale, type DevStats } from '../shared'
import { buildCompetencies, matchMember } from './competencies'
import { buildFindings } from './findings'
import type { ReportContext, ReportData, ReportPeriod } from './types'

interface ReportDialogProps {
  dev: DevStats | null
  /** "organisation / project" — data source line in the report */
  source: string
  onClose: () => void
}

const day = (iso: string, locale: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })

/** File name without characters that cause trouble in downloads ("Jahresbericht_Dean_Govedar_2025-11-01_2026-10-31.pdf"). */
function fileName(prefix: string, name: string, p: ReportPeriod) {
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${clean(prefix)}_${clean(name)}_${p.kind === 'year' && !p.partial ? p.year : `${p.fromDate}_${p.toDate}`}.pdf`
}

/** Options + preview of strengths/recommendations; renders the annual report PDF on demand. */
export default function ReportDialog({ dev, source, onClose }: ReportDialogProps) {
  const { t } = useTranslation()
  const locale = appLocale()
  const ids = useId()
  const members      = useStore((s) => s.members)
  const skills       = useStore((s) => s.skills)
  const memberSkills = useStore((s) => s.memberSkills)
  const skillAreas   = useStore((s) => s.skillAreas)
  const { isAllowed: canSeeCompetencies } = usePagePermission('kompetenzen')

  const [periods, setPeriods]   = useState<ReportPeriod[] | null>(null)
  const [periodKey, setPeriod]  = useState('')
  const [data, setData]         = useState<ReportData | null>(null)
  const [loading, setLoading]   = useState(false)
  const [loadError, setError]   = useState<string | null>(null)
  const [collaboration, setCollaboration] = useState(true)
  const [withFindings, setWithFindings]   = useState(true)
  const [withCompetencies, setWithComp]   = useState(true)
  const [memberId, setMemberId] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [notes, setNotes]       = useState('')
  const [creating, setCreating] = useState(false)

  // Reset when another developer is opened
  useEffect(() => {
    if (!dev) return
    setData(null); setError(null); setNotes(''); setExcluded(new Set())
    setMemberId(matchMember(members, dev.displayName, dev.uniqueName)?.id ?? '')
    apiFetch<{ periods: ReportPeriod[] }>('/api/azure-ranking/report/periods')
      .then((r) => { setPeriods(r.periods); setPeriod((p) => (r.periods.some((x) => x.key === p) ? p : r.periods[0]?.key ?? '')) })
      .catch((e) => { setPeriods([]); setError(errorMessage(e)) })
  }, [dev?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the report data for the selected period
  useEffect(() => {
    if (!dev || !periodKey) return
    let cancelled = false
    setLoading(true); setError(null); setExcluded(new Set())
    apiFetch<ReportData>(`/api/azure-ranking/report?devId=${encodeURIComponent(dev.id)}&period=${encodeURIComponent(periodKey)}`)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => { if (!cancelled) { setData(null); setError((e as { noActivity?: boolean }).noActivity ? t('azureReport.dialog.noData') : errorMessage(e)) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dev?.id, periodKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const member = members.find((m) => m.id === memberId)
  const competencies = useMemo(
    () => (canSeeCompetencies && member
      ? buildCompetencies(member, members, skills, memberSkills, skillAreas, t('azureReport.uncategorised'))
      : null),
    [canSeeCompetencies, member, members, skills, memberSkills, skillAreas, t],
  )
  const findings = useMemo(
    () => (data ? buildFindings(data, withCompetencies ? competencies : null, t, locale) : []),
    [data, competencies, withCompetencies, t, locale],
  )

  const periodLabel = (p: ReportPeriod) =>
    p.kind === 'last12' ? t('azureReport.dialog.periodLast12', { from: day(p.fromDate, locale), to: day(p.toDate, locale) })
      : p.partial ? t('azureReport.dialog.periodYearPartial', { year: p.year, to: day(p.toDate, locale) })
      : t('azureReport.dialog.periodYear', { year: p.year })

  async function create() {
    if (!dev || !data) return
    setCreating(true)
    try {
      const ctx: ReportContext = {
        data,
        competencies: withCompetencies ? competencies : null,
        findings: withFindings ? findings.filter((f) => !excluded.has(f.id)) : [],
        options: { collaboration, findings: withFindings, competencies: withCompetencies && !!competencies, notes },
        source,
        createdAt: new Date(),
      }
      const { renderAnnualReport } = await import('./pdf/render')
      const blob = await renderAnnualReport(ctx, t, locale)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName(t('azureReport.pdf.title'), dev.displayName, data.period)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast.success(t('azureReport.dialog.created'))
    } catch (e) {
      toast.error(t('azureReport.dialog.error'), { description: errorMessage(e) })
    } finally {
      setCreating(false)
    }
  }

  const toggleFinding = (id: string) =>
    setExcluded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const strengths = findings.filter((f) => f.kind === 'strength')
  const growth    = findings.filter((f) => f.kind === 'growth')
  const optionRow = 'flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200'

  return (
    <Modal
      isOpen={!!dev}
      onClose={onClose}
      title={t('azureReport.dialog.title')}
      description={dev ? `${dev.displayName} · ${t('azureReport.dialog.description')}` : undefined}
      icon={<FileText />}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button icon={<Download />} loading={creating} disabled={!data || loading} onClick={create}>
            {t('azureReport.dialog.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Period */}
        <Field label={t('azureReport.dialog.period')} htmlFor={`${ids}-period`}>
          {periods === null ? <Skeleton className="h-10 w-full rounded-lg" /> : (
            <Select id={`${ids}-period`} value={periodKey} onChange={(e) => setPeriod(e.target.value)} disabled={periods.length === 0}>
              {periods.map((p) => <option key={p.key} value={p.key}>{periodLabel(p)}</option>)}
            </Select>
          )}
          <div className="mt-2 min-h-5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {loading ? t('azureReport.dialog.loading')
              : loadError ? <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5" />{loadError}</span>
              : data ? t('azureReport.dialog.summary', { points: fmt(data.dev.points), rank: data.rank, total: data.rankedCount, weeks: data.dev.activeWeeks })
              : null}
          </div>
        </Field>

        {/* Contents */}
        <fieldset>
          <legend className="form-label">{t('azureReport.dialog.contents')}</legend>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700/80">
            <label className={optionRow}>
              <input type="checkbox" className="mt-0.5" checked={collaboration} onChange={(e) => setCollaboration(e.target.checked)} />
              {t('azureReport.dialog.collaboration')}
            </label>

            <div>
              <label className={`${optionRow} ${!canSeeCompetencies ? 'opacity-60' : ''}`}>
                <input type="checkbox" className="mt-0.5" checked={withCompetencies && canSeeCompetencies} disabled={!canSeeCompetencies}
                  onChange={(e) => setWithComp(e.target.checked)} />
                {t('azureReport.dialog.competencies')}
              </label>
              {!canSeeCompetencies ? (
                <p className="form-hint ml-6">{t('azureReport.dialog.noCompetencyAccess')}</p>
              ) : withCompetencies && (
                <div className="ml-6 mt-2 max-w-sm">
                  <Select size="sm" aria-label={t('azureReport.dialog.member')} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">{t('azureReport.dialog.memberNone')}</option>
                    {[...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <p className="form-hint">{memberId ? t('azureReport.dialog.memberHint') : t('azureReport.dialog.noMember')}</p>
                </div>
              )}
            </div>

            <div>
              <label className={optionRow}>
                <input type="checkbox" className="mt-0.5" checked={withFindings} onChange={(e) => setWithFindings(e.target.checked)} />
                {t('azureReport.dialog.findings')}
              </label>
              {withFindings && (
                <div className="ml-6 mt-2 space-y-3">
                  <p className="form-hint mt-0">{t('azureReport.dialog.findingsHint')}</p>
                  {loading ? (
                    <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div>
                  ) : (
                    <>
                      {[{ list: strengths, title: t('azureReport.dialog.strengths'), icon: <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> },
                        { list: growth, title: t('azureReport.dialog.recommendations'), icon: <Lightbulb className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> },
                      ].filter((g) => g.list.length > 0).map((g) => (
                        <div key={g.title}>
                          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{g.icon}{g.title}</p>
                          <ul className="space-y-1.5">
                            {g.list.map((f) => (
                              <li key={f.id}>
                                <label className={`flex items-start gap-2.5 text-[13px] leading-snug ${excluded.has(f.id) ? 'text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                  <input type="checkbox" className="mt-0.5 shrink-0" checked={!excluded.has(f.id)} onChange={() => toggleFinding(f.id)} />
                                  <span>{f.text}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <Field label={t('azureReport.dialog.notes')} htmlFor={`${ids}-notes`}>
          <textarea id={`${ids}-notes`} className="form-textarea" rows={3} value={notes} maxLength={4000}
            placeholder={t('azureReport.dialog.notesPlaceholder')} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
