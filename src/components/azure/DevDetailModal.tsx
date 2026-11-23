import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, BarChart3, CalendarCheck, FolderGit2, Gauge, History, Target, TrendingUp } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import Tabs from '@/components/ui/Tabs'
import SectionHeader from '@/components/ui/SectionHeader'
import Skeleton from '@/components/ui/Skeleton'
import type { DevHistorySnapshot, DevStats, PeriodValue } from './shared'
import {
  BREAKDOWN_DEFS, METRIC_GROUPS, PERIODS, apiFetch, avatarColor, avatarName, badgeIcon, badgeText, fmt, getNextLevelName,
  levelStyle, locale, metricPoints, progressPercent, weeksInPeriod,
} from './shared'
import { LevelBadge, LevelProgress } from './bits'

// ─── History line chart ───────────────────────────────────────────────────────

/** Measures the content width of an element (for crisp, readable SVG text at any modal width). */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

interface ChartEntry { date: Date; points: number; rank: number; kind: 'load' | 'month' }

function HistoryLineChart({ snapshots, initialPeriod }: { snapshots: DevHistorySnapshot[]; initialPeriod: PeriodValue }) {
  const { t } = useTranslation()
  const gradId = useId().replace(/:/g, '')
  const [activePeriod, setActivePeriod] = useState<PeriodValue>(initialPeriod)
  const [hover, setHover] = useState<number | null>(null)
  const [boxRef, boxWidth] = useElementWidth<HTMLDivElement>()
  const period = Number(activePeriod)

  const entries: ChartEntry[] = snapshots
    .filter((s) => s.periods[period] !== undefined)
    .map((s) => ({
      date:   new Date(s.loadedAt),
      points: s.periods[period]!.points,
      rank:   s.periods[period]!.rank,
      kind:   s.kind === 'month' ? 'month' : 'load',
    }))
  const hasMonth = entries.some((e) => e.kind === 'month')
  const hasLoad  = entries.some((e) => e.kind === 'load')

  const W = Math.max(280, boxWidth || 460), H = 184
  const pad = { top: 26, right: 14, bottom: 26, left: 40 }
  const cW  = W - pad.left - pad.right
  const cH  = H - pad.top - pad.bottom
  const maxV = Math.max(...entries.map((e) => e.points), 1)

  const xPos = (i: number) => (entries.length <= 1 ? cW / 2 : (i / (entries.length - 1)) * cW)
  const yPos = (v: number) => cH - (v / maxV) * cH

  const pts  = entries.map((e, i) => `${xPos(i)},${yPos(e.points)}`).join(' ')
  const area = entries.length > 1 ? `${xPos(0)},${cH} ${pts} ${xPos(entries.length - 1)},${cH}` : ''

  // Readability: value labels on every point only if there is room, otherwise on the last and the highest point.
  const spacing    = entries.length > 1 ? cW / (entries.length - 1) : cW
  const allValues  = spacing >= 44
  const maxIdx     = entries.reduce((m, e, i) => (e.points > entries[m].points ? i : m), 0)
  const showValue  = (i: number) => allValues || i === entries.length - 1 || i === maxIdx
  // Local dips get their label below the point so it doesn't collide with the line.
  const labelBelow = (i: number) =>
    i > 0 && i < entries.length - 1 && entries[i].points < entries[i - 1].points && entries[i].points < entries[i + 1].points
      && yPos(entries[i].points) + 18 < cH

  // Date labels: as many as fit (~54px each), always the last one, never overlapping it.
  const spanDays   = entries.length > 1 ? (entries[entries.length - 1].date.getTime() - entries[0].date.getTime()) / 864e5 : 0
  const dateOpts: Intl.DateTimeFormatOptions = spanDays > 300
    ? { day: '2-digit', month: '2-digit', year: '2-digit' }
    : { day: '2-digit', month: '2-digit' }
  // Month values are month ends in UTC (23:59:59Z) → format in UTC, otherwise they'd show as the 1st of the next month.
  const tz         = (e: ChartEntry) => (e.kind === 'month' ? { timeZone: 'UTC' } : {})
  const fmtDate    = (e: ChartEntry) => e.date.toLocaleDateString(locale(), { ...dateOpts, ...tz(e) })
  const fmtLong    = (e: ChartEntry) => e.kind === 'month'
    ? e.date.toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : e.date.toLocaleDateString(locale())
  const labelStep  = Math.max(1, Math.ceil(entries.length / Math.max(2, Math.floor(cW / 54))))
  const showDate   = (i: number) => {
    const last = entries.length - 1
    if (i === last) return true
    return i % labelStep === 0 && last - i >= labelStep * 0.75
  }

  const kindLabel = (k: ChartEntry['kind']) => (k === 'month' ? t('azureRanking.historyMonthValue') : t('azureRanking.historyLoadValue'))
  const hovered = hover !== null ? entries[hover] : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          variant="segmented"
          size="sm"
          value={activePeriod}
          onChange={(p) => { setActivePeriod(p); setHover(null) }}
          aria-label={t('azureRanking.period')}
          items={PERIODS.map((p) => ({ value: p, label: p === '365' ? t('azureRanking.oneYear') : `${p} ${t('azureRanking.daysLabel')}` }))}
        />
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
          {t('azureRanking.historyPoints', { count: entries.length })}
        </span>
      </div>

      <div ref={boxRef} className="relative">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('azureRanking.historyNoPeriodData')}</p>
        ) : (
          <>
            {entries.length === 1 && (
              <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">{t('azureRanking.historyOnlyOne')}</p>
            )}
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="block max-w-full select-none"
              role="img"
              aria-label={t('azureRanking.devHistory')}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <g transform={`translate(${pad.left},${pad.top})`}>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <line key={f} x1={0} y1={yPos(maxV * f)} x2={cW} y2={yPos(maxV * f)}
                    className="stroke-slate-200 dark:stroke-slate-700/70" strokeWidth={1} strokeDasharray={f === 0 ? undefined : '3 3'} />
                ))}
                {[0, 0.5, 1].map((f) => (
                  <text key={f} x={-8} y={yPos(maxV * f) + 4} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize={11}>
                    {fmt(Math.round(maxV * f))}
                  </text>
                ))}

                {area && <polygon points={area} fill={`url(#${gradId})`} />}
                {entries.length > 1 && (
                  <polyline points={pts} fill="none" className="stroke-indigo-500 dark:stroke-indigo-400" strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" />
                )}

                {hovered && hover !== null && (
                  <line x1={xPos(hover)} x2={xPos(hover)} y1={0} y2={cH} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1} />
                )}

                {entries.map((e, i) => {
                  const active = hover === i
                  const r = (active ? 1.5 : 0) + (entries.length > 24 ? 3 : 4)
                  return (
                    <g key={i}>
                      {e.kind === 'load' ? (
                        <circle cx={xPos(i)} cy={yPos(e.points)} r={r}
                          className="fill-indigo-500 stroke-white dark:fill-indigo-400 dark:stroke-slate-900" strokeWidth={1.5} />
                      ) : (
                        <circle cx={xPos(i)} cy={yPos(e.points)} r={r - 0.5}
                          className="fill-white stroke-indigo-500 dark:fill-slate-900 dark:stroke-indigo-400" strokeWidth={1.75} />
                      )}
                      {showValue(i) && !active && (
                        <text x={xPos(i)} y={labelBelow(i) ? yPos(e.points) + 18 : yPos(e.points) - 9} textAnchor="middle"
                          className="fill-slate-600 dark:fill-slate-300" fontSize={11} fontWeight={600}>
                          {fmt(e.points)}
                        </text>
                      )}
                      {showDate(i) && (
                        <text x={xPos(i)} y={cH + 18} textAnchor={entries.length > 1 && i === entries.length - 1 ? 'end' : i === 0 && entries.length > 1 ? 'start' : 'middle'}
                          className={active ? 'fill-slate-700 dark:fill-slate-200' : 'fill-slate-400 dark:fill-slate-500'} fontSize={11}>
                          {fmtDate(e)}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Hover targets: one column per data point */}
                {entries.map((e, i) => {
                  const x0 = i === 0 ? -pad.left : (xPos(i - 1) + xPos(i)) / 2
                  const x1 = i === entries.length - 1 ? cW + pad.right : (xPos(i) + xPos(i + 1)) / 2
                  return (
                    <rect key={`h${i}`} x={x0} y={-pad.top} width={Math.max(0, x1 - x0)} height={H} fill="transparent"
                      onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                      <title>{`${fmtLong(e)} · ${kindLabel(e.kind)}: ${fmt(e.points)} ${t('azureRanking.ptsLabel')} · #${e.rank}`}</title>
                    </rect>
                  )
                })}
              </g>
            </svg>

            {/* Tooltip */}
            {hovered && hover !== null && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-popover ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10"
                style={{
                  left: Math.min(Math.max(pad.left + xPos(hover), 70), W - 70),
                  top:  Math.max(0, pad.top + yPos(hovered.points) - 58),
                }}
              >
                <p className="whitespace-nowrap font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {fmt(hovered.points)} {t('azureRanking.ptsLabel')} <span className="font-normal text-slate-400">· #{hovered.rank}</span>
                </p>
                <p className="whitespace-nowrap text-2xs text-slate-500 dark:text-slate-400">
                  {fmtLong(hovered)} · {kindLabel(hovered.kind)}
                </p>
              </div>
            )}

            {/* Legend */}
            {hasMonth && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-500 dark:text-slate-400">
                {hasLoad && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400" aria-hidden />
                    {t('azureRanking.historyLoadValue')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border-[1.75px] border-indigo-500 bg-white dark:border-indigo-400 dark:bg-slate-900" aria-hidden />
                  {t('azureRanking.historyMonthValue')}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

interface DevDetailModalProps {
  dev: DevStats | null
  scoring: Record<string, number>
  /** Length of the current period in days (active-weeks bound, default chart period) */
  days: number
  onClose: () => void
}

export default function DevDetailModal({ dev, scoring, days, onClose }: DevDetailModalProps) {
  return (
    <Modal isOpen={!!dev} onClose={onClose} title={dev?.displayName ?? ''} description={dev?.uniqueName} size="lg">
      {dev && <DevDetailBody dev={dev} scoring={scoring} days={days} />}
    </Modal>
  )
}

function DevDetailBody({ dev, scoring, days }: { dev: DevStats; scoring: Record<string, number>; days: number }) {
  const { t } = useTranslation()
  const pct    = progressPercent(dev)
  const maxPts = Math.max(1, ...BREAKDOWN_DEFS.map((b) => metricPoints(dev, b, scoring)))
  const nextLevel = getNextLevelName(dev.level.name)
  const chartPeriod = (PERIODS as readonly string[]).includes(String(days)) ? (String(days) as PeriodValue) : '30'

  const [history, setHistory]         = useState<DevHistorySnapshot[] | null>(null)
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    setHistLoading(true)
    apiFetch<{ snapshots: DevHistorySnapshot[] }>(`/api/azure-ranking/dev-history?devId=${encodeURIComponent(dev.id)}`)
      .then((data) => setHistory(data.snapshots))
      .catch(() => setHistory(null))
      .finally(() => setHistLoading(false))
  }, [dev.id])

  const LevelIcon = levelStyle(dev.level.name).icon

  return (
    <div className="space-y-7">
      {/* Hero */}
      <div className="flex items-center gap-4">
        <Avatar name={avatarName(dev.displayName)} color={avatarColor(dev.displayName)} size="lg" />
        <div className="min-w-0 flex-1">
          <LevelBadge level={dev.level} />
          {dev.rank > 0 && (
            <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {t('azureRanking.overallRank', { rank: dev.rank })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">{fmt(dev.points)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('azureRanking.totalPoints')}</p>
        </div>
      </div>

      {/* Per active week */}
      {dev.activeWeeks > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3 dark:border-slate-800">
            <Gauge className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight tabular-nums text-slate-900 dark:text-slate-100">
                {fmt(dev.pointsPerWeek)} <span className="text-xs font-normal text-slate-400">{t('azureRanking.ptsLabel')}</span>
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('azureRanking.modePerWeek')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3 dark:border-slate-800">
            <CalendarCheck className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight tabular-nums text-slate-900 dark:text-slate-100">
                {dev.activeWeeks} <span className="text-xs font-normal text-slate-400">{t('azureRanking.ofWeeks', { count: weeksInPeriod(days) })}</span>
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={t('azureRanking.activeWeeksHint')}>
                {t('azureRanking.activeWeeks')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Level progress */}
      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/50">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
            <LevelIcon className="h-3.5 w-3.5 text-slate-400" />
            {dev.level.name}
            <span className="font-normal tabular-nums text-slate-400">({fmt(dev.level.min)} {t('azureRanking.ptsLabel')})</span>
          </span>
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{pct}%</span>
        </div>
        <LevelProgress levelName={dev.level.name} pct={pct} size="md" />
        <p className="mt-2 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {dev.level.next
            ? t('azureRanking.nextLevelAt', { points: fmt(dev.level.next), level: nextLevel })
            : t('azureRanking.maxLevelReached')}
        </p>
      </div>

      {/* Points breakdown */}
      <section>
        <SectionHeader title={t('azureRanking.pointsBreakdown')} icon={<Target />} />
        <div className="space-y-4">
          {METRIC_GROUPS.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t(`azureRanking.${g.tKey}`)}</p>
              <ul className="space-y-2.5">
                {BREAKDOWN_DEFS.filter((b) => b.group === g.key).map((b) => {
                  const count   = dev[b.field] || 0
                  const raw     = b.rawField ? dev[b.rawField] : undefined
                  const capped  = raw !== undefined && raw > count
                  const ptsEach = scoring[b.scoringKey] || 0
                  const total   = metricPoints(dev, b, scoring)
                  const barW    = maxPts > 0 ? Math.round((total / maxPts) * 100) : 0
                  const Icon    = b.icon
                  return (
                    <li
                      key={b.field}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[13rem_minmax(0,1fr)_5.5rem] ${count === 0 && !raw ? 'opacity-45' : ''}`}
                    >
                      <div className="flex min-w-0 items-start gap-2 text-slate-700 dark:text-slate-200">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: b.color }} />
                        <div className="min-w-0">
                          <p className="truncate" title={t(`azureRanking.${b.tKey}`)}>{t(`azureRanking.${b.tKey}`)}</p>
                          {raw !== undefined && raw > 0 && (
                            <p className={`text-2xs tabular-nums ${capped ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                              {t('azureRanking.countedOf', { counted: fmt(count), total: fmt(raw) })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-900 sm:order-3 dark:text-slate-100">
                        {fmt(total)} <span className="text-xs font-normal text-slate-400">{t('azureRanking.ptsLabel')}</span>
                      </span>
                      <div className="col-span-2 flex items-center gap-3 sm:order-2 sm:col-span-1">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${barW}%`, backgroundColor: b.color }} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {fmt(count)} × {ptsEach}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('azureRanking.totalPoints')}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {fmt(dev.points)} <span className="text-xs font-normal text-slate-400">{t('azureRanking.ptsLabel')}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Activity overview */}
      <section>
        <SectionHeader title={t('azureRanking.activityOverview')} icon={<BarChart3 />} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BREAKDOWN_DEFS.map((b) => {
            const Icon = b.icon
            return (
              <div key={b.field} className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <Icon className="h-4 w-4" style={{ color: b.color }} />
                <p className="mt-2 text-lg font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-100">
                  {fmt(dev[b.field] || 0)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400" title={t(`azureRanking.${b.tKey}`)}>
                  {t(`azureRanking.${b.tKey}`)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* History */}
      <section>
        <SectionHeader title={t('azureRanking.devHistory')} icon={<History />} />
        {histLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : history && history.length > 0 ? (
          <div className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
            <HistoryLineChart snapshots={history} initialPeriod={chartPeriod} />
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <TrendingUp className="h-4 w-4 shrink-0 text-slate-400" />
            {t('azureRanking.historyNoData')}
          </p>
        )}
      </section>

      {/* Achievements */}
      <section>
        <SectionHeader title={t('azureRanking.achievements')} icon={<Award />} count={dev.badges.length} />
        {dev.badges.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('azureRanking.noBadges')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {dev.badges.map((b) => {
              const Icon = badgeIcon(b.id)
              const { name, desc } = badgeText(b)
              return (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/15 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={desc}>{desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Repositories */}
      <section>
        <SectionHeader title={t('azureRanking.repositories')} icon={<FolderGit2 />} count={dev.repositories.length} />
        {dev.repositories.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('azureRanking.noRepos')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {dev.repositories.map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/10">
                <FolderGit2 className="h-3.5 w-3.5 text-slate-400" />
                {r}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
