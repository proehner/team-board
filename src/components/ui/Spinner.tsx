import { Loader2 } from 'lucide-react'

/** Inline spinner. For full-area loading use <LoadingState/>. */
export default function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-indigo-500 ${className}`} aria-hidden />
}

export function LoadingState({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500 dark:text-slate-400 ${className}`}>
      <Spinner className="h-6 w-6" />
      {label && <span>{label}</span>}
    </div>
  )
}
