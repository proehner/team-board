import type { TicketStatus, TicketPriority } from '@/types'
import type { BadgeVariant } from '@/components/ui/Badge'

export const TICKET_STATUSES: TicketStatus[] = ['todo', 'in_progress', 'done']
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']

/** Status dot colors (Tailwind class + CSS color for inline use) */
export const TICKET_STATUS_META: Record<TicketStatus, { dotCls: string; dot: string }> = {
  todo:        { dotCls: 'bg-slate-400',   dot: '#94a3b8' },
  in_progress: { dotCls: 'bg-sky-500',     dot: '#0ea5e9' },
  done:        { dotCls: 'bg-emerald-500', dot: '#10b981' },
}

export const TICKET_PRIORITY_META: Record<TicketPriority, { badge: BadgeVariant; dot: string; flagCls: string }> = {
  low:    { badge: 'default', dot: '#94a3b8', flagCls: 'text-slate-400' },
  medium: { badge: 'warning', dot: '#f59e0b', flagCls: 'text-amber-500' },
  high:   { badge: 'danger',  dot: '#ef4444', flagCls: 'text-red-500' },
}
