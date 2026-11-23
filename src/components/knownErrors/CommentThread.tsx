import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import Panel from './Panel'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'
import MentionInput, { renderWithMentions } from '@/components/ui/MentionInput'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'

export interface CommentLike {
  id: string
  content: string
  authorName: string
  createdAt: string
}

interface CommentThreadProps<C extends CommentLike> {
  comments: C[]
  loading?: boolean
  canWrite: boolean
  onSend: (content: string) => Promise<void>
  onDelete: (comment: C) => Promise<void>
  labels: {
    title: string
    empty: string
    placeholder: string
    anonymous: string
    deleteTitle: string
    deleteConfirm: string
  }
  className?: string
}

const FALLBACK_COLOR = '#6366f1'

/** Comment list + composer with @mentions. Used by Known Errors and meeting topics. */
export default function CommentThread<C extends CommentLike>({
  comments, loading = false, canWrite, onSend, onDelete, labels, className = '',
}: CommentThreadProps<C>) {
  const { t, i18n } = useTranslation()
  const members    = useStore((s) => s.members)
  const allMembers = useStore((s) => s.allMembers)
  const user       = useAuthStore((s) => s.user)

  const [draft, setDraft]       = useState('')
  const [sending, setSending]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<C | null>(null)

  const locale = i18n.language?.startsWith('de') ? de : enUS
  const colorFor = (name: string) =>
    members.find((m) => m.name === name)?.avatarColor ??
    allMembers.find((m) => m.name === name)?.avatarColor ??
    FALLBACK_COLOR

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await onSend(content)
      setDraft('')
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(c: C) {
    try {
      await onDelete(c)
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  return (
    <Panel
      className={className}
      icon={<MessageSquare />}
      title={labels.title}
      count={comments.length}
    >
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-500 dark:text-slate-400">{labels.empty}</p>
      ) : (
        <ol className="space-y-5">
          {comments.map((c) => {
            const name = c.authorName || labels.anonymous
            const date = new Date(c.createdAt)
            return (
              <li key={c.id} className="group flex gap-3">
                <Avatar name={name} color={colorFor(c.authorName)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                    <time
                      dateTime={c.createdAt}
                      title={format(date, 'dd.MM.yyyy HH:mm')}
                      className="shrink-0 text-xs text-slate-400 dark:text-slate-500"
                    >
                      {formatDistanceToNow(date, { addSuffix: true, locale })}
                    </time>
                  </div>
                  <div className="mt-0.5 text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">
                    {renderWithMentions(c.content, allMembers)}
                  </div>
                </div>
                {canWrite && (
                  <IconButton
                    icon={<Trash2 />}
                    label={labels.deleteTitle}
                    variant="danger"
                    size="xs"
                    className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={() => setConfirmDelete(c)}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}

      {canWrite && (
        <div className={`flex gap-3 ${comments.length > 0 || loading ? 'mt-6 border-t border-slate-100 pt-5 dark:border-slate-800' : 'mt-4'}`}>
          <Avatar
            name={user?.displayName || '?'}
            color={user?.displayName ? colorFor(user.displayName) : FALLBACK_COLOR}
            size="sm"
            className="hidden sm:inline-flex"
          />
          <div className="min-w-0 flex-1">
            <MentionInput
              value={draft}
              onChange={setDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              members={allMembers}
              rows={2}
              placeholder={labels.placeholder}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="hidden text-xs text-slate-400 dark:text-slate-500 sm:block">
                <kbd className="kbd">Enter</kbd> {t('commentThread.toSend')} · <kbd className="kbd">Shift</kbd>+<kbd className="kbd">Enter</kbd> {t('commentThread.newLine')} · <kbd className="kbd">@</kbd> {t('commentThread.mention')}
              </p>
              <Button
                size="sm"
                variant="primary"
                icon={<Send />}
                loading={sending}
                disabled={!draft.trim()}
                onClick={handleSend}
                className="ml-auto"
              >
                {t('commentThread.send')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={labels.deleteTitle}
        message={labels.deleteConfirm}
        confirmLabel={t('common.delete')}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        variant="danger"
      />
    </Panel>
  )
}
