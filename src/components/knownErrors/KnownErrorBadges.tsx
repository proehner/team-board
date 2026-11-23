import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Signal, SignalHigh, SignalMedium, SignalLow,
  CircleDot, Wrench, CheckCircle2,
} from 'lucide-react'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import type { KnownErrorSeverity, KnownErrorStatus } from '@/types'

export const SEVERITY_ORDER: KnownErrorSeverity[] = ['critical', 'high', 'medium', 'low']
export const STATUS_ORDER: KnownErrorStatus[] = ['open', 'workaround', 'resolved']

type Icon = ComponentType<{ className?: string }>

/** Severity → calm by default: only high/critical draw attention. */
export const SEVERITY_CFG: Record<KnownErrorSeverity, { variant: BadgeVariant; Icon: Icon }> = {
  critical: { variant: 'danger',  Icon: Signal },
  high:     { variant: 'warning', Icon: SignalHigh },
  medium:   { variant: 'default', Icon: SignalMedium },
  low:      { variant: 'outline', Icon: SignalLow },
}

export const STATUS_CFG: Record<KnownErrorStatus, { variant: BadgeVariant; Icon: Icon; tile: string }> = {
  open: {
    variant: 'danger',
    Icon: CircleDot,
    tile: 'bg-red-50 text-red-600 ring-red-600/10 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
  },
  workaround: {
    variant: 'warning',
    Icon: Wrench,
    tile: 'bg-amber-50 text-amber-600 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  },
  resolved: {
    variant: 'success',
    Icon: CheckCircle2,
    tile: 'bg-emerald-50 text-emerald-600 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  },
}

export function SeverityBadge({ severity, size = 'sm' }: { severity: KnownErrorSeverity; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  const { variant, Icon } = SEVERITY_CFG[severity]
  return <Badge variant={variant} size={size} icon={<Icon />} label={t(`knownErrors.severity.${severity}`)} />
}

export function StatusBadge({ status, size = 'sm' }: { status: KnownErrorStatus; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  return <Badge variant={STATUS_CFG[status].variant} size={size} dot label={t(`knownErrors.status.${status}`)} />
}

/** Square status icon tile used as leading visual in lists. */
export function StatusTile({ status, className = '' }: { status: KnownErrorStatus; className?: string }) {
  const { t } = useTranslation()
  const { Icon, tile } = STATUS_CFG[status]
  return (
    <span
      title={t(`knownErrors.status.${status}`)}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tile} ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}
