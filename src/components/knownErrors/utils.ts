/** Shared helpers for the knowledge pages (Known Error DB, meeting topics). */

/** Turns markdown into a compact single-line plain-text preview. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')                 // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // links → link text
    .replace(/`([^`]*)`/g, '$1')                      // inline code
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
    .replace(/^\s*\[[ xX]\]\s+/gm, '')                // task list boxes
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')            // bold / strike
    .replace(/(^|[^\w*])\*(\S(?:.*?\S)?)\*/g, '$1$2') // *italic*
    .replace(/(^|\W)_(\S(?:.*?\S)?)_(?=\W|$)/g, '$1$2') // _italic_
    .replace(/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/gm, ' ') // horizontal rules
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImageMime(mimeType: string) {
  return mimeType.startsWith('image/')
}
