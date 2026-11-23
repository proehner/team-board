interface SkeletonProps {
  className?: string
}

/** Shimmering placeholder block. Size it with Tailwind classes: <Skeleton className="h-4 w-32" /> */
export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-slate-800 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent dark:before:via-white/5 ${className}`}
    />
  )
}

/** A few stacked skeleton rows — handy as list placeholder. */
export function SkeletonList({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
