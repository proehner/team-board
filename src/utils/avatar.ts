export const AVATAR_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#0ea5e9', '#a855f7', '#e11d48',
]

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const pickAvatarColor = (index: number): string =>
  AVATAR_COLORS[index % AVATAR_COLORS.length]
