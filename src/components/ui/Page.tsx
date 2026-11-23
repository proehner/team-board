import type { ReactNode } from 'react'

type PageSize = 'narrow' | 'default' | 'wide' | 'full'

const sizeCls: Record<PageSize, string> = {
  narrow:  'max-w-3xl',
  default: 'max-w-5xl',
  wide:    'max-w-7xl',
  full:    'max-w-none',
}

interface PageProps {
  children: ReactNode
  /** narrow = forms/detail (768px) · default = lists (1024px) · wide = dashboards/grids (1280px) · full = boards/matrices */
  size?: PageSize
  className?: string
}

/** Standard page wrapper: consistent max-width, paddings and entry animation. */
export default function Page({ children, size = 'default', className = '' }: PageProps) {
  return (
    <div className={`mx-auto w-full ${sizeCls[size]} px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in ${className}`}>
      {children}
    </div>
  )
}
