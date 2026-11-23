import Avatar from '@/components/ui/Avatar'

interface AvatarStackProps {
  people: { id: string; name: string; avatarColor: string }[]
  max?: number
  size?: '2xs' | 'xs' | 'sm'
  className?: string
}

/** Overlapping avatar group with a "+N" overflow bubble. */
export default function AvatarStack({ people, max = 6, size = 'xs', className = '' }: AvatarStackProps) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  const bubble = size === 'sm' ? 'h-8 min-w-[2rem] text-xs' : size === 'xs' ? 'h-6 min-w-[1.5rem] text-[10px]' : 'h-5 min-w-[1.25rem] text-[9px]'
  return (
    <div className={`flex items-center -space-x-1.5 ${className}`}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.avatarColor} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-slate-100 px-1 font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900 ${bubble}`}
          title={people.slice(max).map((p) => p.name).join(', ')}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
