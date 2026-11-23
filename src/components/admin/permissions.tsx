import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlock, UserCheck, Eye, Lock } from 'lucide-react'
import type { PagePermission } from '@/types'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'

// ─── Page keys + labels (same order as sidebar) ───────────────────────────────
export const ALL_PAGES: { key: string; labelKey: string; hasWriteOwn?: boolean; isSubReadOnly?: boolean }[] = [
  { key: 'dashboard',          labelKey: 'nav.dashboard' },
  { key: 'team',               labelKey: 'nav.team' },
  { key: 'kompetenzen',        labelKey: 'nav.competencies' },
  { key: 'kompetenzen-matrix',        labelKey: 'admin.groups.matrixPermLabel',  hasWriteOwn: true },
  { key: 'kompetenzen-matrix-footer', labelKey: 'admin.groups.footerPermLabel',  isSubReadOnly: true },
  { key: 'sprints',            labelKey: 'nav.sprints' },
  { key: 'rotation',      labelKey: 'nav.rotation' },
  { key: 'retro',         labelKey: 'nav.retrospectives' },
  { key: 'health',        labelKey: 'nav.teamHealth' },
  { key: 'pulse',         labelKey: 'nav.pulseCheck' },
  { key: 'stakeholder',   labelKey: 'nav.stakeholder' },
  { key: 'azure-ranking',         labelKey: 'nav.azureRankings' },
  { key: 'azure-ranking-refresh', labelKey: 'admin.groups.azureRankingRefreshLabel', isSubReadOnly: true },
  { key: 'known-errors',  labelKey: 'nav.knownErrors' },
  { key: 'meetings',      labelKey: 'nav.meetings' },
  { key: 'tickets',       labelKey: 'nav.tickets' },
  { key: 'roadmap',       labelKey: 'nav.roadmap' },
]

// ─── Permission options ───────────────────────────────────────────────────────
export const PERM_OPTIONS: { value: PagePermission; icon: ReactNode; variant: BadgeVariant; active: string }[] = [
  {
    value: 'write', icon: <Unlock />, variant: 'success',
    active: 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
  },
  {
    value: 'write-own', icon: <UserCheck />, variant: 'info',
    active: 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30',
  },
  {
    value: 'read', icon: <Eye />, variant: 'warning',
    active: 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
  },
  {
    value: 'none', icon: <Lock />, variant: 'danger',
    active: 'bg-white text-red-700 shadow-sm ring-1 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  },
]
// Standard options without write-own (used for all pages except kompetenzen-matrix)
export const PERM_OPTIONS_STANDARD = PERM_OPTIONS.filter((o) => o.value !== 'write-own')
// Matrix options: write-own included, but 'none' excluded (use parent page 'none' to block entirely)
export const PERM_OPTIONS_MATRIX = PERM_OPTIONS.filter((o) => o.value !== 'none')
// Sub-read-only options: only read/none (visibility toggle, no write semantics)
export const PERM_OPTIONS_READONLY = PERM_OPTIONS.filter((o) => o.value === 'read' || o.value === 'none')

/** Returns the default PagePermission for a page entry (used when the group has no explicit value). */
export function defaultPermFor(page: { isSubReadOnly?: boolean }): PagePermission {
  return page.isSubReadOnly ? 'read' : 'write'
}

export function optionsFor(page: { hasWriteOwn?: boolean; isSubReadOnly?: boolean }) {
  if (page.hasWriteOwn) return PERM_OPTIONS_MATRIX
  if (page.isSubReadOnly) return PERM_OPTIONS_READONLY
  return PERM_OPTIONS_STANDARD
}

/** Read-only pill for a permission value. */
export function PermBadge({ perm }: { perm: PagePermission }) {
  const { t } = useTranslation()
  const opt = PERM_OPTIONS.find((o) => o.value === perm)
  if (!opt) return null
  return <Badge variant={opt.variant} icon={opt.icon} label={t(`admin.groups.perm.${perm}`)} />
}

/** Segmented radio control to pick a permission. */
export function PermSegment({
  value, options, onChange, label,
}: {
  value: PagePermission
  options: typeof PERM_OPTIONS
  onChange: (v: PagePermission) => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-800/70 dark:ring-slate-700/50"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(`admin.groups.perm.${o.value}Hint`)}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:h-3 [&_svg]:w-3 ${
              active ? o.active : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {o.icon}
            {t(`admin.groups.perm.${o.value}`)}
          </button>
        )
      })}
    </div>
  )
}
