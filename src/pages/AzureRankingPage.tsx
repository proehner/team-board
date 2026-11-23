import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Trophy, RefreshCw, Download, Settings, FolderGit2, AlertTriangle, X, Users, Info, Sparkles,
  CalendarRange, Layers, ListOrdered, Medal, SearchX, Sigma, Gauge,
} from 'lucide-react'
import { usePagePermission } from '@/hooks/usePagePermission'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Chip from '@/components/ui/Chip'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'
import { toast } from '@/store/toast'
import type { CacheStatus, CategoryKey, ConfigStatus, DevStats, PeriodData, PeriodValue, RankMode } from '@/components/azure/shared'
import {
  BREAKDOWN_DEFS, CATEGORY_DEFS, METRIC_BY_FIELD, PERIODS, apiFetch, computeCustomScore, fmt, locale, normalizePeriodData,
  rankingValue, sortedDevs, sumField, supportsPerWeek,
} from '@/components/azure/shared'
import { Leaderboard, Podium } from '@/components/azure/Leaderboard'
import DevDetailModal from '@/components/azure/DevDetailModal'
import AzureSetupModal from '@/components/azure/AzureSetupModal'
import ScoringInfo from '@/components/azure/ScoringInfo'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AzureRankingPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly }  = usePagePermission('azure-ranking')
  const { isAllowed: canRefresh } = usePagePermission('azure-ranking-refresh')

  const [days, setDays]               = useState<number>(30)
  const [category, setCategory]       = useState<CategoryKey>('points')
  const [rankMode, setRankMode]       = useState<RankMode>('total')
  const [scoringOpen, setScoringOpen] = useState(false)
  const scoringRef                    = useRef<HTMLDetailsElement>(null)
  const [enabledMetrics, setEnabledMetrics] = useState<Set<string>>(() => new Set(BREAKDOWN_DEFS.map((b) => b.field)))
  const [data, setData]               = useState<PeriodData | null>(null)
  const [search, setSearch]           = useState('')
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [booting, setBooting]             = useState(true)
  const [showSetup, setShowSetup]         = useState(false)
  const [setupDismissed, setSetupDismissed] = useState(false)
  const [detailDev, setDetailDev]         = useState<DevStats | null>(null)
  const [loadError, setLoadError]         = useState<string | null>(null)
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null)
  // stable ref to always-current loadStats, so boot effect doesn't re-run on days change
  const loadStatsRef                  = useRef<(d?: number) => Promise<void>>(async () => {})

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const loadStats = useCallback(async (d?: number) => {
    const period = d ?? days
    setLoadError(null)
    try {
      const result = await apiFetch<PeriodData>(`/api/azure-ranking/stats?days=${period}`)
      setData(normalizePeriodData(result))
    } catch (e: unknown) {
      const err = e as { noCache?: boolean; message: string }
      if (!err.noCache) setLoadError(err.message)
    }
  }, [days])

  // Keep ref current on every render
  loadStatsRef.current = loadStats

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiFetch<CacheStatus>('/api/azure-ranking/cache/status')
        setCacheStatus(status)
        if (!status.loading) {
          stopPolling()
          if (status.error) {
            setLoadError(status.error)
          } else if (status.hasData) {
            await loadStatsRef.current()
            toast.success(t('azureRanking.refreshDone'))
          }
        }
      } catch { stopPolling() }
    }, 2500)
  }, [stopPolling, t])

  /** Normal refresh is incremental (seconds); `full` rebuilds the whole event store (~2 min). */
  const triggerLoad = useCallback(async (full = false) => {
    setLoadError(null)
    try {
      const res = await apiFetch<{ started: boolean }>(`/api/azure-ranking/cache/refresh${full ? '?full=1' : ''}`, { method: 'POST' })
      if (res.started) {
        setCacheStatus((s) => s ? { ...s, loading: true } : null)
        startPolling()
      }
      return res.started
    } catch (e: unknown) {
      setLoadError((e as Error).message)
      return false
    }
  }, [startPolling])

  const startFullRebuild = useCallback(async () => {
    const started = await triggerLoad(true)
    if (started) {
      toast.info(t('azureRanking.rebuildStarted'))
      setShowSetup(false)
    }
  }, [triggerLoad, t])

  // Boot — runs exactly once on mount, uses ref to access current loadStats
  useEffect(() => {
    ;(async () => {
      try {
        const [cfg, cache] = await Promise.all([
          apiFetch<ConfigStatus>('/api/azure-ranking/config/status'),
          apiFetch<CacheStatus>('/api/azure-ranking/cache/status'),
        ])
        setConfigStatus(cfg)
        setCacheStatus(cache)

        if (!cfg.configured) { if (canWrite) setShowSetup(true); else setSetupDismissed(true); return }
        if (cache.loading) { startPolling(); return }
        if (cache.hasData) await loadStatsRef.current()
      } catch (e: unknown) {
        setLoadError(t('azureRanking.serverUnreachable') + (e as Error).message)
      } finally {
        setBooting(false)
      }
    })()
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally only on mount

  // Reload when days tab changes (after initial data has loaded)
  useEffect(() => {
    if (data) loadStatsRef.current(days)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  // Per-week ranking needs weekly data (not available in legacy caches) and is pointless for 7 days.
  const weeklyAvailable = !!data && data.days > 7 && data.developers.some((d) => d.activeWeeks > 0)
  const perWeek  = rankMode === 'perWeek' && weeklyAvailable && supportsPerWeek(category)
  const mode: RankMode = perWeek ? 'perWeek' : 'total'
  const scoring  = data?.scoring ?? {}

  // Ranking over all developers (podium + ranks); the search only filters the list, ranks stay stable.
  const rankedDevs = data
    ? sortedDevs(data.developers, category, mode, scoring, enabledMetrics).map((d, i) => ({ ...d, catRank: i + 1 }))
    : []
  const q = search.trim().toLowerCase()
  const displayedDevs = q
    ? rankedDevs.filter((d) => d.displayName.toLowerCase().includes(q) || d.uniqueName.toLowerCase().includes(q))
    : rankedDevs

  const isCustom = category === 'custom'
  const catMeta  = CATEGORY_DEFS.find((c) => c.key === category) || CATEGORY_DEFS[0]
  const getCatVal = (dev: DevStats) => rankingValue(dev, category, mode, scoring, enabledMetrics)
  const getHint = (dev: DevStats): string | undefined => {
    if (perWeek) {
      const base = isCustom ? computeCustomScore(dev, scoring, enabledMetrics) : dev.points
      return t('azureRanking.perWeekHint', { points: fmt(base), count: Math.max(1, dev.activeWeeks) })
    }
    if (!isCustom && category !== 'points') return `${fmt(dev.points)} ${t('azureRanking.ptsTotal')}`
    return undefined
  }
  const valueLabel = isCustom
    ? (perWeek ? t('azureRanking.combinedPerWeek') : t('azureRanking.combinedScore'))
    : category === 'points'
      ? (perWeek ? t('azureRanking.pointsPerWeekShort') : t('azureRanking.points'))
      : t(`azureRanking.${catMeta.tKey}`)
  const podiumTitle = (isCustom
    ? `${t('azureRanking.combined')} ${t('azureRanking.top3Label')}`
    : category === 'points' ? t('azureRanking.topChampions') : `${t(`azureRanking.${catMeta.tKey}`)} ${t('azureRanking.top3Label')}`)
    + (perWeek ? ` · ${t('azureRanking.modePerWeek')}` : '')

  function openScoring() {
    setScoringOpen(true)
    requestAnimationFrame(() => scoringRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function changeCategory(c: CategoryKey) {
    setCategory(c)
    setSearch('')
  }

  // ── Status line (header subtitle) ─────────────────────────────────────────
  const status = (() => {
    if (!cacheStatus) return null
    if (cacheStatus.loading) {
      const msg = cacheStatus.progress?.message || t('azureRanking.loadingData')
      const rep = cacheStatus.progress?.repo ? ` (${cacheStatus.progress.repo})` : ''
      const pct = cacheStatus.progress?.total > 0 ? ` ${cacheStatus.progress.done}/${cacheStatus.progress.total}` : ''
      return { tone: 'loading', text: `${msg}${rep}${pct}` }
    }
    if (cacheStatus.error) return { tone: 'error', text: t('azureRanking.loadError') }
    if (cacheStatus.hasData && cacheStatus.lastLoaded) {
      const ts = new Date(cacheStatus.lastLoaded).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
      return { tone: 'ok', text: `${t('azureRanking.lastUpdated', { date: ts })} · ${cacheStatus.devCount} ${t('azureRanking.overviewDevs')}` }
    }
    return { tone: 'none', text: t('azureRanking.noData') }
  })()

  const dotCls: Record<string, string> = {
    ok:      'bg-emerald-500',
    loading: 'bg-amber-500 animate-pulse',
    error:   'bg-red-500',
    none:    'bg-slate-300 dark:bg-slate-600',
  }

  const isLoading = !!cacheStatus?.loading
  const periodItems = PERIODS.map((p) => ({
    value: p,
    label: p === '365' ? t('azureRanking.oneYear') : `${p} ${t('azureRanking.daysLabel')}`,
  }))

  const outdated  = !!(data?.outdated || cacheStatus?.outdated)
  const kpiDef    = METRIC_BY_FIELD

  return (
    <Page size="wide">
      {isReadOnly && <ReadOnlyBanner className="mb-5" />}

      <PageHeader
        icon={Trophy}
        title={t('azureRanking.title')}
        meta={configStatus?.organization ? (
          <Badge variant="indigo" icon={<FolderGit2 />} label={`${configStatus.organization} / ${configStatus.project}`} />
        ) : undefined}
        subtitle={status ? (
          <span className="inline-flex items-center gap-2" aria-live="polite">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls[status.tone]}`} aria-hidden />
            <span className="tabular-nums">{status.text}</span>
          </span>
        ) : booting ? <span className="inline-block h-4 w-64 animate-pulse rounded-md bg-slate-200/70 align-middle dark:bg-slate-800" /> : undefined}
        actions={
          <>
            <Tabs
              variant="segmented"
              items={periodItems}
              value={String(days) as PeriodValue}
              onChange={(v) => setDays(Number(v))}
              aria-label={t('azureRanking.period')}
            />
            {canWrite && canRefresh && (
              <Button
                variant={cacheStatus?.hasData ? 'secondary' : 'primary'}
                onClick={() => triggerLoad()}
                loading={isLoading}
                icon={cacheStatus?.hasData ? <RefreshCw /> : <Download />}
              >
                {isLoading ? t('azureRanking.loading') : (cacheStatus?.hasData ? t('azureRanking.refresh') : t('azureRanking.loadData'))}
              </Button>
            )}
            {canWrite && (
              <IconButton
                variant="secondary"
                size="md"
                icon={<Settings />}
                label={t('azureRanking.settings')}
                onClick={() => setShowSetup(true)}
              />
            )}
          </>
        }
      />

      {/* Setup Modal */}
      <AzureSetupModal
        isOpen={showSetup}
        showCancel={true}
        initialOrg={configStatus?.organization}
        initialProject={configStatus?.project}
        onClose={() => {
          setShowSetup(false)
          if (!configStatus?.configured) setSetupDismissed(true)
        }}
        onSaved={(org, project) => {
          setConfigStatus({ configured: true, organization: org, project })
          setSetupDismissed(false)
          setShowSetup(false)
          triggerLoad()
        }}
        onFullRebuild={canWrite && canRefresh && configStatus?.configured ? startFullRebuild : undefined}
        loadRunning={isLoading}
      />

      {/* Detail Modal */}
      <DevDetailModal dev={detailDev} scoring={scoring} days={data?.days ?? days} onClose={() => setDetailDev(null)} />

      <div className="space-y-8">
        {/* Error banner */}
        {loadError && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{loadError}</span>
            <IconButton size="xs" icon={<X />} label={t('common.close')} onClick={() => setLoadError(null)} />
          </div>
        )}

        {/* Legacy cache → new evaluation logic needs one refresh */}
        {outdated && !isLoading && (
          <div role="status" className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 sm:flex-row sm:items-center dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('azureRanking.outdatedHint')}</span>
            </div>
            {canWrite && canRefresh && (
              <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => triggerLoad()} className="self-start sm:self-auto">
                {t('azureRanking.refresh')}
              </Button>
            )}
          </div>
        )}

        {/* No-config banner */}
        {!configStatus?.configured && setupDismissed && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Settings className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('azureRanking.noConfigHint')}</span>
            </div>
            {canWrite && (
              <Button size="sm" variant="secondary" icon={<Settings />} onClick={() => setShowSetup(true)} className="self-start sm:self-auto">
                {t('azureRanking.configure')}
              </Button>
            )}
          </div>
        )}

        {/* Refresh in progress */}
        {isLoading && (
          <div className="surface flex items-center gap-4 p-4 sm:p-5" role="status">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
              <Spinner className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {cacheStatus?.progress?.message || t('azureRanking.loadingData')}
              </p>
              {cacheStatus?.progress?.repo && (
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {t('azureRanking.repoLabel')}: {cacheStatus.progress.repo}
                </p>
              )}
              {(cacheStatus?.progress?.total ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                      style={{ width: `${Math.round((cacheStatus!.progress.done / cacheStatus!.progress.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {cacheStatus!.progress.done}/{cacheStatus!.progress.total}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Initial loading skeleton */}
        {booting && !data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[7.25rem] rounded-xl" />)}
          </div>
        )}

        {/* Overview tiles */}
        {data && (
          <section>
            <SectionHeader
              title={t('azureRanking.overviewTitle')}
              icon={<CalendarRange />}
              action={
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {new Date(data.fromDate).toLocaleDateString(locale())} – {new Date(data.toDate).toLocaleDateString(locale())}
                  <span className="hidden sm:inline"> ({data.days} {t('azureRanking.days')})</span>
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard label={t('azureRanking.overviewDevs')}        value={fmt(data.developers.length)}  icon={Users} tone="slate" />
              <StatCard label={t('azureRanking.prsMerged')}           value={fmt(data.totals.prsCompleted)} icon={kpiDef.prsCompleted.icon} tone="violet"
                hint={t('azureRanking.kpiPrsCreated', { n: fmt(data.totals.prs) })} />
              <StatCard label={t('azureRanking.kpiReviews')}          value={fmt(data.totals.reviews)}      icon={kpiDef.prsReviewed.icon} tone="sky"
                hint={t('azureRanking.kpiReviewComments', { n: fmt(data.totals.comments) })} />
              <StatCard label={t('azureRanking.catApprovals')}        value={fmt(data.totals.approvals)}    icon={kpiDef.approvalsGiven.icon} tone="indigo" />
              <StatCard label={t('azureRanking.backlogItemsDone')}    value={fmt(sumField(data.developers, 'backlogItemsCompleted'))}
                icon={kpiDef.backlogItemsCompleted.icon} tone="emerald" />
              <StatCard label={t('azureRanking.tasksDone')}           value={fmt(sumField(data.developers, 'tasksCompleted'))}
                icon={kpiDef.tasksCompleted.icon} tone="emerald" />
              <StatCard label={t('azureRanking.ticketsCreated')}      value={fmt(data.totals.ticketsCreated)} icon={kpiDef.ticketsCreated.icon} tone="amber"
                hint={t('azureRanking.kpiTasksCreated', { n: fmt(data.totals.tasksCreated) })} />
              <StatCard label={t('azureRanking.overviewTicketComments')} value={fmt(data.totals.ticketComments)} icon={kpiDef.ticketComments.icon} tone="rose" />
            </div>
          </section>
        )}

        {/* Podium */}
        {data && rankedDevs.length > 0 && (
          <section>
            <SectionHeader title={podiumTitle} icon={<Medal />} />
            <Podium devs={rankedDevs} category={category} getValue={getCatVal} valueLabel={valueLabel} getHint={getHint} onSelect={setDetailDev} />
          </section>
        )}

        {/* Rankings */}
        {(data || (!isLoading && !booting)) && (
          <section>
            {data && (
              <div className="mb-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center justify-between gap-3 md:justify-start">
                    <h2 className="flex items-center gap-2 section-label [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <ListOrdered />
                      {t('azureRanking.leaderboard')}
                      <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {displayedDevs.length}
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={openScoring}
                      className="inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <Info className="h-3.5 w-3.5" />
                      {t('azureRanking.howCounted')}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {weeklyAvailable && (
                      <Tabs
                        variant="segmented"
                        size="sm"
                        fullWidth
                        className="sm:w-auto"
                        value={supportsPerWeek(category) ? rankMode : 'total'}
                        onChange={setRankMode}
                        aria-label={t('azureRanking.rankMode')}
                        items={[
                          { value: 'total' as RankMode,   label: t('azureRanking.modeTotal'),   icon: Sigma },
                          { value: 'perWeek' as RankMode, label: t('azureRanking.modePerWeek'), icon: Gauge, disabled: !supportsPerWeek(category) },
                        ]}
                      />
                    )}
                    <div className="flex items-center gap-2">
                    <Select
                      size="sm"
                      wrapperClassName="flex-1 sm:hidden"
                      value={category}
                      onChange={(e) => changeCategory(e.target.value as CategoryKey)}
                      aria-label={t('common.sortBy')}
                    >
                      {CATEGORY_DEFS.map((c) => (
                        <option key={c.key} value={c.key}>{t(`azureRanking.${c.tKey}`)}</option>
                      ))}
                      <option value="custom">{t('azureRanking.combined')}</option>
                    </Select>
                    <SearchInput
                      size="sm"
                      value={search}
                      onChange={setSearch}
                      placeholder={t('azureRanking.searchPlaceholder')}
                      className="flex-1 sm:w-56 sm:flex-none"
                    />
                    </div>
                  </div>
                </div>

                {/* Category pills (desktop) */}
                <div className="hidden sm:block">
                  <Tabs
                    variant="pills"
                    size="sm"
                    value={category}
                    onChange={changeCategory}
                    aria-label={t('common.sortBy')}
                    items={[
                      ...CATEGORY_DEFS.map((c) => ({ value: c.key as CategoryKey, label: t(`azureRanking.${c.tKey}`), icon: c.icon })),
                      { value: 'custom' as CategoryKey, label: t('azureRanking.combined'), icon: Layers },
                    ]}
                  />
                </div>

                {/* Explanation of the per-week mode */}
                {perWeek && (
                  <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Gauge className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {t('azureRanking.perWeekExplain')}
                  </p>
                )}
                {weeklyAvailable && rankMode === 'perWeek' && !supportsPerWeek(category) && (
                  <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {t('azureRanking.perWeekOnlyPoints')}
                  </p>
                )}

                {/* Metric toggles for combined score */}
                {isCustom && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="mb-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">{t('azureRanking.selectMetrics')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BREAKDOWN_DEFS.map((b) => (
                        <Chip
                          key={b.field}
                          active={enabledMetrics.has(b.field)}
                          dotColor={b.color}
                          onClick={() => setEnabledMetrics((prev) => {
                            const next = new Set(prev)
                            if (next.has(b.field)) next.delete(b.field)
                            else next.add(b.field)
                            return next
                          })}
                        >
                          {t(`azureRanking.${b.tKey}`)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!data && !isLoading && (
              <div className="surface">
                <EmptyState
                  icon={<Trophy />}
                  title={t('azureRanking.noData')}
                  description={t('azureRanking.noDataHint')}
                  action={canWrite && canRefresh && configStatus?.configured ? (
                    <Button variant="primary" icon={<Download />} onClick={() => triggerLoad()}>{t('azureRanking.loadData')}</Button>
                  ) : canWrite && !configStatus?.configured ? (
                    <Button variant="primary" icon={<Settings />} onClick={() => setShowSetup(true)}>{t('azureRanking.configure')}</Button>
                  ) : undefined}
                />
              </div>
            )}

            {data && displayedDevs.length === 0 && (
              <div className="surface">
                <EmptyState
                  compact
                  icon={<SearchX />}
                  title={t('azureRanking.noDevs')}
                  action={search ? <Button size="sm" onClick={() => setSearch('')}>{t('common.resetFilters')}</Button> : undefined}
                />
              </div>
            )}

            {data && displayedDevs.length > 0 && (
              <Leaderboard devs={displayedDevs} category={category} getValue={getCatVal} valueLabel={valueLabel} getHint={getHint} onSelect={setDetailDev} />
            )}
          </section>
        )}

        {/* How it's counted */}
        {data && <ScoringInfo ref={scoringRef} data={data} open={scoringOpen} onOpenChange={setScoringOpen} />}
      </div>
    </Page>
  )
}
