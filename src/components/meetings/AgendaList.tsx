import { forwardRef, useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent, type Modifier, type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, GripVertical, MoreHorizontal, Ticket as TicketIcon, Trash2,
} from 'lucide-react'
import type { MeetingTopic, MeetingTopicStatus, Team, TeamMember } from '@/types'
import IconButton from '@/components/ui/IconButton'
import Avatar from '@/components/ui/Avatar'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu'
import { getMemberDisplayNames } from '@/utils/members'
import { stripMarkdown } from '@/components/knownErrors/utils'
import { TopicStatusMenu } from './TopicStatus'

// ─── Agenda list ──────────────────────────────────────────────────────────────
//
// Open topics can be reordered by drag & drop (grip handle; mouse, touch and keyboard:
// Space/Enter to pick up, arrow keys to move, Space/Enter to drop, Esc to cancel) or via
// the row menu. Every row is a stretched link; interactive controls sit above the link
// overlay (z-10) and are raised further while their menu is open, so menus overlap the
// following rows.

interface AgendaListProps {
  topics: MeetingTopic[]
  /** Position (1-based) of each open topic in the full agenda — shown also while filtering */
  positions?: Map<string, number>
  /** Drag & drop and move actions available (open tab, no filter, write access) */
  sortable: boolean
  canWrite: boolean
  members: TeamMember[]
  teams: Team[]
  topicHref: (topic: MeetingTopic) => string
  onReorder: (orderedIds: string[]) => void
  onStatusChange: (topic: MeetingTopic, status: MeetingTopicStatus) => void
  onDelete: (topic: MeetingTopic) => void
}

/** Drag only vertically */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export default function AgendaList({
  topics, positions, sortable, canWrite, members, teams, topicHref, onReorder, onStatusChange, onDelete,
}: AgendaListProps) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const ids = useMemo(() => topics.map((tp) => tp.id), [topics])
  const showPosition = !!positions
  const activeTopic = activeId ? topics.find((tp) => tp.id === activeId) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const titleOf = (id: UniqueIdentifier) => topics.find((tp) => tp.id === id)?.title ?? ''
  const posOf = (id: UniqueIdentifier | undefined) => (id === undefined ? 0 : ids.indexOf(String(id)) + 1)
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('meetings.dnd.start', { title: titleOf(active.id), pos: posOf(active.id), total: ids.length }),
    onDragOver: ({ active, over }) => (over ? t('meetings.dnd.over', { title: titleOf(active.id), pos: posOf(over.id), total: ids.length }) : undefined),
    onDragEnd: ({ active, over }) => (over ? t('meetings.dnd.end', { title: titleOf(active.id), pos: posOf(over.id), total: ids.length }) : undefined),
    onDragCancel: ({ active }) => t('meetings.dnd.cancel', { title: titleOf(active.id), pos: posOf(active.id) }),
  }

  const move = (topic: MeetingTopic, to: number) => {
    const from = ids.indexOf(topic.id)
    const target = Math.max(0, Math.min(ids.length - 1, to))
    if (from === -1 || from === target) return
    onReorder(arrayMove(ids, from, target))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const rows = topics.map((topic, index) => {
    const rowProps: RowProps = {
      topic, index, total: topics.length, sortable, canWrite, showPosition,
      position: positions?.get(topic.id),
      members, teams, href: topicHref(topic),
      onStatusChange: (s) => onStatusChange(topic, s),
      onDelete: () => onDelete(topic),
      onMove: (to) => move(topic, to),
    }
    return sortable ? <SortableRow key={topic.id} {...rowProps} /> : <TopicRow key={topic.id} {...rowProps} />
  })

  const list = <ul className="surface divide-y divide-slate-100 dark:divide-slate-800">{rows}</ul>
  if (!sortable) return list

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('meetings.dnd.instructions') } }}
      onDragStart={({ active }: DragStartEvent) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{list}</SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTopic ? (
          <ul>
            <TopicRow
              overlay
              topic={activeTopic}
              index={ids.indexOf(activeTopic.id)}
              total={topics.length}
              sortable
              canWrite={canWrite}
              showPosition={showPosition}
              position={positions?.get(activeTopic.id)}
              members={members}
              teams={teams}
              href={topicHref(activeTopic)}
              onStatusChange={() => {}}
              onDelete={() => {}}
              onMove={() => {}}
            />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

interface RowProps {
  topic: MeetingTopic
  index: number
  total: number
  sortable: boolean
  canWrite: boolean
  showPosition: boolean
  position?: number
  members: TeamMember[]
  teams: Team[]
  href: string
  onStatusChange: (status: MeetingTopicStatus) => void
  onDelete: () => void
  onMove: (toIndex: number) => void
  /** Rendered inside the drag overlay */
  overlay?: boolean
}

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.topic.id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  return (
    <TopicRow
      {...props}
      ref={setNodeRef}
      style={style}
      dragging={isDragging}
      handle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }}
    />
  )
}

interface TopicRowExtra {
  style?: CSSProperties
  dragging?: boolean
  handle?: { ref: (el: HTMLElement | null) => void; props: HTMLAttributes<HTMLElement> }
}

/** Raises a control above the row's link overlay — and above later rows while its menu is open. */
const controlCls = 'relative z-10 has-[[aria-expanded=true]]:z-30'

const TopicRow = forwardRef<HTMLLIElement, RowProps & TopicRowExtra>(function TopicRow(
  { topic, index, total, sortable, canWrite, showPosition, position, members, teams, href, onStatusChange, onDelete, onMove, overlay, style, dragging, handle },
  ref,
) {
  const { t } = useTranslation()
  const isDone      = topic.status === 'done'
  const assignees   = members.filter((m) => topic.assigneeIds?.includes(m.id))
  const displayNames = getMemberDisplayNames(assignees, teams)
  const preview     = topic.description ? stripMarkdown(topic.description) : ''
  const ticketCount = topic.ticketIds?.length ?? 0
  const pos         = position ?? index + 1

  const menuItems: DropdownItem[] = [
    ...(sortable
      ? [
          { label: t('meetings.moveToTop'), icon: <ArrowUpToLine />, disabled: index === 0, onClick: () => onMove(0) },
          { label: t('meetings.moveUp'), icon: <ChevronUp />, disabled: index === 0, onClick: () => onMove(index - 1) },
          { label: t('meetings.moveDown'), icon: <ChevronDown />, disabled: index === total - 1, onClick: () => onMove(index + 1) },
          { label: t('meetings.moveToBottom'), icon: <ArrowDownToLine />, disabled: index === total - 1, onClick: () => onMove(total - 1) },
          { type: 'divider' as const },
        ]
      : []),
    { label: t('meetings.deleteTopicTitle'), icon: <Trash2 />, danger: true, onClick: onDelete },
  ]

  return (
    <li
      ref={ref}
      style={style}
      className={`group relative flex items-center gap-2 py-2.5 pl-2 pr-2 transition-colors first:rounded-t-xl last:rounded-b-xl sm:gap-3 sm:pr-3 ${
        overlay
          ? 'cursor-grabbing rounded-xl bg-white shadow-popover ring-1 ring-indigo-500/30 dark:bg-slate-900 dark:ring-indigo-400/30'
          : dragging
            ? 'z-0 bg-slate-50 opacity-40 dark:bg-slate-800/40'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`}
    >
      {/* Position / drag handle */}
      {showPosition && (
        sortable && handle ? (
          <button
            type="button"
            ref={handle.ref}
            {...handle.props}
            aria-label={t('meetings.dragHandle', { pos })}
            title={t('meetings.dragHandleHint')}
            className={`${controlCls} flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:bg-slate-700/70 dark:hover:text-slate-300`}
          >
            <span className="text-xs font-medium tabular-nums group-hover:hidden group-focus-within:hidden [@media(hover:none)]:hidden">{pos}</span>
            <GripVertical className="hidden h-4 w-4 group-hover:block group-focus-within:block [@media(hover:none)]:block" />
          </button>
        ) : overlay ? (
          <span className="flex h-8 w-7 shrink-0 items-center justify-center text-slate-500"><GripVertical className="h-4 w-4" /></span>
        ) : (
          <span className="flex h-8 w-7 shrink-0 items-center justify-center text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">{pos}</span>
        )
      )}

      {/* Status — fixed width so all titles start at the same position */}
      <div className={`${controlCls} shrink-0 sm:w-[8.75rem] ${showPosition ? '' : 'pl-1'}`}>
        <TopicStatusMenu status={topic.status} compact fill disabled={!canWrite || overlay} onChange={onStatusChange} />
      </div>

      {/* Title (stretched link: the whole row opens the topic) */}
      <Link
        to={href}
        tabIndex={overlay ? -1 : undefined}
        className="min-w-0 flex-1 py-0.5 outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-indigo-500/70"
      >
        <span className={`block truncate text-sm font-medium ${
          isDone ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400'
        }`}>
          {topic.title}
        </span>
        {(preview || (isDone && topic.closedAt)) && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {isDone && topic.closedAt ? t('meetings.closedAt', { date: format(new Date(topic.closedAt), 'dd.MM.yyyy') }) : preview}
          </span>
        )}
      </Link>

      {/* Meta (part of the clickable row) */}
      {(ticketCount > 0 || assignees.length > 0) && (
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {ticketCount > 0 && (
            <Meta title={t('meetings.linkedTicketsCount', { count: ticketCount })}>
              <TicketIcon className="h-3 w-3 text-slate-400" />
              {ticketCount}
            </Meta>
          )}
          {assignees.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {assignees.slice(0, 3).map((m) => (
                <Avatar key={m.id} name={displayNames.get(m.id) ?? m.name} color={m.avatarColor} size="xs" ring />
              ))}
              {assignees.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row actions */}
      {canWrite && (
        <div className={`${controlCls} shrink-0`}>
          {overlay ? <span className="block h-8 w-8" /> : (
            <DropdownMenu
              trigger={(p) => (
                <IconButton
                  {...p}
                  icon={<MoreHorizontal />}
                  label={t('common.moreActions')}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                />
              )}
              items={menuItems}
            />
          )}
        </div>
      )}
    </li>
  )
})

function Meta({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      title={title}
    >
      {children}
    </span>
  )
}
