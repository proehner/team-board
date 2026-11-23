import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, CircleDot, CirclePause, Pin, CheckCircle2, ChevronDown } from 'lucide-react'
import DropdownMenu from '@/components/ui/DropdownMenu'
import type { MeetingTopicStatus } from '@/types'

export const TOPIC_STATUSES: MeetingTopicStatus[] = ['todo', 'in_progress', 'deferred', 'fixed', 'done']

type Icon = ComponentType<{ className?: string }>

export const TOPIC_STATUS_CFG: Record<MeetingTopicStatus, { Icon: Icon; icon: string; pill: string }> = {
  todo: {
    Icon: Circle,
    icon: 'text-slate-400 dark:text-slate-500',
    pill: 'bg-slate-100 text-slate-700 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/10',
  },
  in_progress: {
    Icon: CircleDot,
    icon: 'text-sky-500 dark:text-sky-400',
    pill: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  },
  deferred: {
    Icon: CirclePause,
    icon: 'text-amber-500 dark:text-amber-400',
    pill: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  },
  fixed: {
    Icon: Pin,
    icon: 'text-violet-500 dark:text-violet-400',
    pill: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  },
  done: {
    Icon: CheckCircle2,
    icon: 'text-emerald-500 dark:text-emerald-400',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  },
}

const pillBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:h-3.5 [&_svg]:w-3.5'

interface BadgeProps {
  status: MeetingTopicStatus
  compact?: boolean
  /** Stretch to the parent's width (equal-width pills in lists) */
  fill?: boolean
  className?: string
}

export function TopicStatusBadge({ status, compact = false, fill = false, className = '' }: BadgeProps) {
  const { t } = useTranslation()
  const { Icon, pill } = TOPIC_STATUS_CFG[status]
  return (
    <span className={`${pillBase} ${pill} ${compact ? 'py-1 sm:py-0.5' : ''} ${fill ? 'w-full' : ''} ${className}`} title={t(`meetings.status.${status}`)}>
      <Icon />
      <span className={`${compact ? 'hidden sm:inline' : ''} ${fill ? 'truncate' : ''}`}>{t(`meetings.status.${status}`)}</span>
    </span>
  )
}

interface TopicStatusMenuProps {
  status: MeetingTopicStatus
  onChange: (status: MeetingTopicStatus) => void
  disabled?: boolean
  align?: 'start' | 'end'
  /** Show only the icon below the `sm` breakpoint (dense lists on mobile) */
  compact?: boolean
  /** Stretch to the parent's width (equal-width pills in lists) */
  fill?: boolean
  className?: string
}

/** Status pill that opens a menu to change the status. Falls back to a static badge when disabled. */
export function TopicStatusMenu({ status, onChange, disabled, align = 'start', compact = false, fill = false, className = '' }: TopicStatusMenuProps) {
  const { t } = useTranslation()
  if (disabled) return <TopicStatusBadge status={status} compact={compact} fill={fill} className={className} />
  const { Icon, pill } = TOPIC_STATUS_CFG[status]
  return (
    <DropdownMenu
      align={align}
      width="w-52"
      className={`${fill ? 'w-full' : ''} ${className}`}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          title={t('meetings.changeStatus')}
          aria-label={`${t('meetings.changeStatus')}: ${t(`meetings.status.${status}`)}`}
          className={`${pillBase} ${pill} ${compact ? 'py-1 sm:py-0.5' : ''} ${fill ? 'w-full' : ''} pr-1.5 transition-[filter,box-shadow] hover:brightness-[0.97] hover:ring-2 dark:hover:brightness-125`}
        >
          <Icon />
          <span className={`${compact ? 'hidden sm:inline' : ''} ${fill ? 'min-w-0 flex-1 truncate text-left' : ''}`}>{t(`meetings.status.${status}`)}</span>
          <ChevronDown className={`!h-3 !w-3 opacity-60 ${fill ? 'ml-auto' : ''}`} />
        </button>
      )}
      items={[
        { type: 'label', label: t('meetings.changeStatus') },
        ...TOPIC_STATUSES.map((s) => {
          const cfg = TOPIC_STATUS_CFG[s]
          return {
            label: t(`meetings.status.${s}`),
            icon: <cfg.Icon className={cfg.icon} />,
            checked: s === status,
            onClick: () => { if (s !== status) onChange(s) },
          }
        }),
      ]}
    />
  )
}
