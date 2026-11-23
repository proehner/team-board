import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Map, Search, Flag, Layers, ArrowUpDown, X,
  LayoutList, CalendarDays, Users, GanttChartSquare,
} from 'lucide-react'
import { useStore } from '@/store'
import type { RoadmapFeature, RoadmapStatus, RoadmapPriority } from '@/types'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Chip from '@/components/ui/Chip'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import SearchInput from '@/components/ui/SearchInput'
import SectionHeader from '@/components/ui/SectionHeader'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { usePagePermission } from '@/hooks/usePagePermission'
import FeatureCard from '@/components/roadmap/FeatureCard'
import CreateFeatureModal from '@/components/roadmap/CreateFeatureModal'
import RoadmapTimelineView from '@/components/roadmap/RoadmapTimelineView'
import RoadmapGanttView from '@/components/roadmap/RoadmapGanttView'
import RoadmapWorkloadView from '@/components/roadmap/RoadmapWorkloadView'
import {
  ROADMAP_STATUSES, ROADMAP_PRIORITIES, STATUS_META, PRIORITY_META, planningScore,
} from '@/components/roadmap/roadmapConfig'

type ViewMode = 'list' | 'timeline' | 'gantt' | 'workload'
type SortMode = 'default' | 'priority' | 'completeness' | 'updated'

const VIEW_MODES: ViewMode[] = ['list', 'timeline', 'gantt', 'workload']
const GRID_CLS = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

export default function RoadmapPage() {
  const { t, i18n } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('roadmap')
  const navigate = useNavigate()
  const features = useStore((s) => s.roadmapFeatures)
  const storeLoading = useStore((s) => s.loading)

  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view') as ViewMode | null
  const view: ViewMode = rawView && VIEW_MODES.includes(rawView) ? rawView : 'list'
  function setView(v: ViewMode) {
    setSearchParams((p) => { p.set('view', v); return p }, { replace: true })
  }
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState<RoadmapStatus | 'all'>('all')
  const [priorityFilter,  setPriorityFilter]  = useState<RoadmapPriority | 'all'>('all')
  const [categoryFilter,  setCategoryFilter]  = useState<string | 'all'>('all')
  const [sortBy,          setSortBy]          = useState<SortMode>('default')
  const [showCreate,      setShowCreate]      = useState(false)

  // Keyboard shortcut: N to create new feature
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (
        canWrite &&
        e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !(el instanceof HTMLInputElement) &&
        !(el instanceof HTMLTextAreaElement) &&
        !(el instanceof HTMLSelectElement) &&
        !el?.isContentEditable &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault()
        setShowCreate(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canWrite])

  // Computed categories from all features
  const categories = useMemo(() => {
    const cats = new Set(features.map((f) => f.category).filter(Boolean) as string[])
    return [...cats].sort()
  }, [features])

  // Filtered + sorted features
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = features.filter((f) => {
      const matchSearch = !q ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.category ?? '').toLowerCase().includes(q) ||
        f.tags.some((tag) => tag.toLowerCase().includes(q))
      const matchStatus   = statusFilter   === 'all' || f.status   === statusFilter
      const matchPriority = priorityFilter === 'all' || f.priority === priorityFilter
      const matchCategory = categoryFilter === 'all' || (f.category ?? '') === categoryFilter
      return matchSearch && matchStatus && matchPriority && matchCategory
    })

    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order)
    } else if (sortBy === 'completeness') {
      result = [...result].sort((a, b) => planningScore(b).filled - planningScore(a).filled)
    } else if (sortBy === 'updated') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
  }, [features, search, statusFilter, priorityFilter, categoryFilter, sortBy])

  const grouped = ROADMAP_STATUSES.reduce<Record<RoadmapStatus, RoadmapFeature[]>>((acc, s) => {
    acc[s] = filtered.filter((f) => f.status === s)
    return acc
  }, {} as Record<RoadmapStatus, RoadmapFeature[]>)

  const totalByStatus = ROADMAP_STATUSES.map((s) => ({
    status: s,
    count: features.filter((f) => f.status === s).length,
  }))

  const completenessStats = useMemo(() => {
    if (features.length === 0) return null
    const scores = features.map((f) => planningScore(f).filled)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const ready = scores.filter((s) => s === 6).length
    return { avg: Math.round(avg * 10) / 10, ready, total: features.length }
  }, [features])

  const activeFilterCount = [
    statusFilter !== 'all',
    priorityFilter !== 'all',
    categoryFilter !== 'all',
    search.trim() !== '',
  ].filter(Boolean).length

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setCategoryFilter('all')
    setSortBy('default')
  }

  const openFeature = (id: string) => navigate(`/roadmap/${id}`)
  const numberFmt = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })

  const subtitle = completenessStats
    ? t('roadmap.summary', {
        count: completenessStats.total,
        avg: numberFmt.format(completenessStats.avg),
        ready: completenessStats.ready,
      })
    : t('roadmap.subtitle')

  const showFilters = view !== 'workload'
  const loadingInitial = storeLoading && features.length === 0

  return (
    <Page size="full">
      <PageHeader
        icon={Map}
        title={t('roadmap.title')}
        subtitle={subtitle}
        actions={canWrite && (
          <Button variant="primary" icon={<Plus />} onClick={() => setShowCreate(true)} title={`${t('roadmap.newFeature')} (N)`}>
            {t('roadmap.newFeature')}
          </Button>
        )}
      >
        <div className="space-y-3">
          {/* Row 1: view switcher + filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs
              variant="segmented"
              size="sm"
              aria-label={t('roadmap.viewSwitcher')}
              value={view}
              onChange={setView}
              className="self-start"
              items={[
                { value: 'list',     icon: LayoutList,       label: t('roadmap.viewList') },
                { value: 'timeline', icon: CalendarDays,     label: t('roadmap.viewTimeline') },
                { value: 'gantt',    icon: GanttChartSquare, label: t('roadmap.viewGantt') },
                { value: 'workload', icon: Users,            label: t('roadmap.viewWorkload') },
              ]}
            />
            {showFilters && (
              <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
                <SearchInput
                  size="sm"
                  value={search}
                  onChange={setSearch}
                  placeholder={t('roadmap.searchPlaceholder')}
                  className="w-full sm:w-56"
                  aria-label={t('common.search')}
                />
                <Select
                  size="sm"
                  icon={<Flag />}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as RoadmapPriority | 'all')}
                  aria-label={t('roadmap.priority')}
                  wrapperClassName="min-w-[9rem] flex-1 sm:flex-none sm:w-44"
                >
                  <option value="all">{t('roadmap.allPriorities')}</option>
                  {[...ROADMAP_PRIORITIES].reverse().map((p) => (
                    <option key={p} value={p}>{t(`roadmap.priorityLabels.${p}`)}</option>
                  ))}
                </Select>
                {categories.length > 0 && (
                  <Select
                    size="sm"
                    icon={<Layers />}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label={t('roadmap.category')}
                    wrapperClassName="min-w-[9rem] flex-1 sm:flex-none sm:w-44"
                  >
                    <option value="all">{t('roadmap.allCategories')}</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </Select>
                )}
                {view === 'list' && (
                  <Select
                    size="sm"
                    icon={<ArrowUpDown />}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortMode)}
                    aria-label={t('roadmap.sortBy')}
                    wrapperClassName="min-w-[9rem] flex-1 sm:flex-none sm:w-48"
                  >
                    <option value="default">{t('roadmap.sortDefault')}</option>
                    <option value="priority">{t('roadmap.sortPriority')}</option>
                    <option value="completeness">{t('roadmap.sortCompleteness')}</option>
                    <option value="updated">{t('roadmap.sortUpdated')}</option>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Row 2: status chips + result count */}
          {showFilters && features.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {totalByStatus.map(({ status, count }) => {
                if (count === 0) return null
                return (
                  <Chip
                    key={status}
                    active={statusFilter === status}
                    dotColor={STATUS_META[status].dot}
                    count={count}
                    onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  >
                    {t(`roadmap.statusLabels.${status}`)}
                  </Chip>
                )
              })}
              {activeFilterCount > 0 && (
                <Button size="xs" variant="ghost" icon={<X />} onClick={clearFilters}>
                  {t('roadmap.clearFilters')}
                </Button>
              )}
              <span className="ml-auto text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {t('roadmap.resultCount', { shown: filtered.length, total: features.length })}
              </span>
            </div>
          )}
        </div>
      </PageHeader>

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      {loadingInitial ? (
        <div className={GRID_CLS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : features.length === 0 && view !== 'workload' ? (
        <div className="surface">
          <EmptyState
            icon={<Map />}
            title={t('roadmap.noFeatures')}
            description={t('roadmap.noFeaturesHint')}
            action={canWrite && (
              <Button variant="primary" icon={<Plus />} onClick={() => setShowCreate(true)}>
                {t('roadmap.newFeature')}
              </Button>
            )}
          />
        </div>
      ) : (
        <>
          {/* ── List View ── */}
          {view === 'list' && (
            filtered.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={<Search />}
                  title={t('roadmap.noFeaturesFiltered')}
                  action={<Button variant="secondary" icon={<X />} onClick={clearFilters}>{t('roadmap.clearFilters')}</Button>}
                />
              </div>
            ) : statusFilter === 'all' && sortBy === 'default' ? (
              <div className="space-y-8">
                {ROADMAP_STATUSES.map((status) => {
                  const items = grouped[status]
                  if (items.length === 0) return null
                  const sm = STATUS_META[status]
                  const Icon = sm.icon
                  return (
                    <section key={status}>
                      <SectionHeader
                        title={t(`roadmap.statusLabels.${status}`)}
                        count={items.length}
                        icon={<Icon className={sm.text} />}
                      />
                      <div className={GRID_CLS}>
                        {items.map((f) => <FeatureCard key={f.id} feature={f} showStatus={false} />)}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className={GRID_CLS}>
                {filtered.map((f) => <FeatureCard key={f.id} feature={f} />)}
              </div>
            )
          )}

          {/* ── Timeline View ── */}
          {view === 'timeline' && (
            <RoadmapTimelineView features={filtered} onFeatureClick={openFeature} canWrite={canWrite} />
          )}

          {/* ── Gantt View ── */}
          {view === 'gantt' && (
            <RoadmapGanttView features={filtered} onFeatureClick={openFeature} canWrite={canWrite} />
          )}

          {/* ── Workload View ── */}
          {view === 'workload' && <RoadmapWorkloadView />}
        </>
      )}

      {canWrite && (
        <CreateFeatureModal
          isOpen={showCreate}
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`/roadmap/${id}`) }}
        />
      )}
    </Page>
  )
}
