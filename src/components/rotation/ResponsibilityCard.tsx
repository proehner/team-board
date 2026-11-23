import { useTranslation } from 'react-i18next'
import { BookOpen, Plus, UserRound, Wand2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import { formatDateShort } from '@/utils/date'
import type { ResponsibilityAssignment, ResponsibilityTypeConfig } from '@/types'
import { TimingText, elapsedShare, type MemberLike } from './rotationUi'

interface ResponsibilityCardProps {
  rt: ResponsibilityTypeConfig
  current?: ResponsibilityAssignment
  next?: ResponsibilityAssignment
  suggestion?: MemberLike
  allMembers: MemberLike[]
  canWrite: boolean
  onEdit: (a: ResponsibilityAssignment) => void
  onPlanNext: () => void
  onDocs: () => void
}

/** Who's on duty now and who's next for one responsibility. */
export default function ResponsibilityCard({
  rt, current, next, suggestion, allMembers, canWrite, onEdit, onPlanNext, onDocs,
}: ResponsibilityCardProps) {
  const { t } = useTranslation()
  const currentMember = current && allMembers.find((m) => m.id === current.memberId)
  const nextMember = next && allMembers.find((m) => m.id === next.memberId)
  const progress = current ? elapsedShare(current) : 0

  return (
    <article className="surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 py-2.5 pl-4 pr-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: rt.color }} />
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" title={rt.name}>
          {rt.name}
        </h3>
        <IconButton
          size="xs"
          icon={<BookOpen />}
          label={rt.documentation ? t('rotation.documentation') : t('rotation.noDocumentationShort')}
          onClick={onDocs}
          className={rt.documentation ? '!text-indigo-500 hover:!text-indigo-600 dark:!text-indigo-400' : ''}
        />
      </div>

      {/* Now */}
      <div className="px-4 pb-4">
        {current && currentMember ? (
          <button
            type="button"
            onClick={() => onEdit(current)}
            disabled={!canWrite}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-slate-50 disabled:cursor-default dark:enabled:hover:bg-slate-800/60"
          >
            <Avatar name={currentMember.name} color={currentMember.avatarColor} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{currentMember.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                <span className="font-medium text-emerald-600 dark:text-emerald-400"><TimingText a={current} /></span>
                <span className="text-slate-400 dark:text-slate-500">· {t('rotation.untilDate', { date: formatDateShort(current.endDate) })}</span>
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${Math.max(progress * 100, 4)}%`, backgroundColor: rt.color }} />
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3 py-1.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50/60 text-amber-500 dark:border-amber-500/40 dark:bg-amber-500/5 dark:text-amber-400">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-500 dark:text-slate-400">{t('rotation.nobodyAssigned')}</p>
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                {next ? t('rotation.vacantUntil', { date: formatDateShort(next.startDate) }) : t('rotation.vacantHint')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Next */}
      <div className="mt-auto flex min-h-[2.75rem] items-center border-t border-slate-100 bg-slate-50/70 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/30">
        {next && nextMember ? (
          <button
            type="button"
            onClick={() => onEdit(next)}
            disabled={!canWrite}
            className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors enabled:hover:bg-slate-100 disabled:cursor-default dark:enabled:hover:bg-slate-800"
          >
            <span className="section-label shrink-0">{t('rotation.nextLabel')}</span>
            <Avatar name={nextMember.name} color={nextMember.avatarColor} size="2xs" />
            <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{nextMember.name}</span>
            <span className="ml-auto whitespace-nowrap tabular-nums text-slate-400 dark:text-slate-500">
              {t('rotation.fromDate', { date: formatDateShort(next.startDate) })}
            </span>
          </button>
        ) : canWrite ? (
          <div className="flex w-full min-w-0 items-center gap-2">
            <Button variant={current ? 'ghost' : 'subtle'} size="xs" icon={<Plus />} onClick={onPlanNext} className="-ml-1 shrink-0">
              {current ? t('rotation.planSuccessor') : t('rotation.assignNow')}
            </Button>
            {suggestion && (
              <span className="ml-auto flex min-w-0 items-center gap-1 text-xs text-slate-400 dark:text-slate-500" title={t('rotation.autoSuggestedHint')}>
                <Wand2 className="h-3 w-3 shrink-0 text-indigo-400" />
                <span className="truncate">{t('rotation.suggestionShortName', { name: suggestion.name })}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('rotation.noSuccessor')}</p>
        )}
      </div>
    </article>
  )
}
