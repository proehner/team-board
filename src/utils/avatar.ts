export const AVATAR_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#0ea5e9', '#a855f7', '#e11d48',
]

export const getInitials = (name: string): string => {
  // Only consider word parts that start with a letter (drops "(kendox)", "-", emojis …)
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => !p.startsWith('('))
    .map((p) => p.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter((p) => /^[\p{L}\p{N}]/u.test(p))
  if (parts.length === 0) return name.trim().substring(0, 2).toUpperCase() || '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const pickAvatarColor = (index: number): string =>
  AVATAR_COLORS[index % AVATAR_COLORS.length]
