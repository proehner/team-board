import { useRef, useCallback, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold, Italic, List, ListOrdered, Code, Heading2,
  Minus, Quote, ImagePlus, Link, Loader2, Eye, Pencil,
} from 'lucide-react'
import IconButton from './IconButton'
import MarkdownRenderer from './MarkdownRenderer'
import { toast, errorMessage } from '@/store/toast'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  /** Called with a File; should upload it and return the stored filename (not full URL). */
  onImageUpload?: (file: File) => Promise<string>
  /** id for the textarea (to bind a <label htmlFor>) */
  id?: string
  autoFocus?: boolean
  /** Ctrl/Cmd+Enter handler — e.g. save an inline editor */
  onSubmitShortcut?: () => void
}

type FormatResult = { prefix: string; suffix: string; block?: boolean; placeholder?: string }

interface ToolbarAction {
  key: string
  icon: ReactNode
  shortcut?: string
  action: (selected: string, t: (k: string) => string) => FormatResult
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

const TOOLBAR_ACTIONS: (ToolbarAction | 'sep')[] = [
  { key: 'heading', icon: <Heading2 />, action: (_, t) => ({ prefix: '## ', suffix: '', block: true, placeholder: t('markdownEditor.ph.heading') }) },
  { key: 'bold', icon: <Bold />, shortcut: `${mod}B`, action: (_, t) => ({ prefix: '**', suffix: '**', placeholder: t('markdownEditor.ph.bold') }) },
  { key: 'italic', icon: <Italic />, shortcut: `${mod}I`, action: (_, t) => ({ prefix: '_', suffix: '_', placeholder: t('markdownEditor.ph.italic') }) },
  {
    key: 'code',
    icon: <Code />,
    action: (selected) =>
      selected.includes('\n')
        ? { prefix: '```\n', suffix: '\n```', placeholder: 'code' }
        : { prefix: '`', suffix: '`', placeholder: 'code' },
  },
  { key: 'link', icon: <Link />, action: (selected, t) => ({ prefix: '[', suffix: '](https://)', placeholder: selected || t('markdownEditor.ph.link') }) },
  'sep',
  { key: 'bulletList', icon: <List />, action: (_, t) => ({ prefix: '- ', suffix: '', block: true, placeholder: t('markdownEditor.ph.listItem') }) },
  { key: 'numberedList', icon: <ListOrdered />, action: (_, t) => ({ prefix: '1. ', suffix: '', block: true, placeholder: t('markdownEditor.ph.listItem') }) },
  { key: 'quote', icon: <Quote />, action: (_, t) => ({ prefix: '> ', suffix: '', block: true, placeholder: t('markdownEditor.ph.quote') }) },
  { key: 'divider', icon: <Minus />, action: () => ({ prefix: '\n---\n', suffix: '', block: false, placeholder: '' }) },
]

const BOLD   = TOOLBAR_ACTIONS.find((a) => a !== 'sep' && a.key === 'bold') as ToolbarAction
const ITALIC = TOOLBAR_ACTIONS.find((a) => a !== 'sep' && a.key === 'italic') as ToolbarAction

export default function MarkdownEditor({
  value, onChange, placeholder, rows = 8, className = '', onImageUpload, id, autoFocus, onSubmitShortcut,
}: MarkdownEditorProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [dragOver, setDragOver] = useState(false)

  // Latest value for async callbacks (image upload finishes after the user kept typing)
  const valueRef = useRef(value)
  valueRef.current = value

  const minHeight = `${Math.max(rows, 2) * 1.6 + 1.25}rem`

  const applyFormat = useCallback((action: ToolbarAction) => {
    const el = ref.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    const { prefix, suffix, block, placeholder: ph = '' } = action.action(selected, t)
    const insertion = selected || ph

    let newText: string
    let newCursorStart: number
    let newCursorEnd: number

    if (block && !selected) {
      const before = value.slice(0, start)
      const after = value.slice(end)
      const needsNewline = before.length > 0 && !before.endsWith('\n')
      const newPrefix = needsNewline ? '\n' + prefix : prefix
      newText = before + newPrefix + insertion + suffix + after
      newCursorStart = start + newPrefix.length
      newCursorEnd = newCursorStart + insertion.length
    } else {
      newText = value.slice(0, start) + prefix + insertion + suffix + value.slice(end)
      newCursorStart = start + prefix.length
      newCursorEnd = newCursorStart + insertion.length
    }

    onChange(newText)

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursorStart, newCursorEnd)
    })
  }, [value, onChange, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const el = ref.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const newText = value.slice(0, start) + '  ' + value.slice(end)
      onChange(newText)
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 2, start + 2)
      })
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      applyFormat(BOLD)
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      applyFormat(ITALIC)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmitShortcut) {
      e.preventDefault()
      onSubmitShortcut()
    }
  }, [value, onChange, applyFormat, onSubmitShortcut])

  const insertImageMarkdown = useCallback((filename: string, altText: string) => {
    const el = ref.current
    const current = valueRef.current
    const pos = el && document.activeElement === el ? el.selectionStart : current.length
    const md = `![${altText}](upload://${filename})`
    const before = current.slice(0, pos)
    const after = current.slice(pos)
    const needsNewline = before.length > 0 && !before.endsWith('\n')
    const newText = before + (needsNewline ? '\n' : '') + md + after
    onChange(newText)
    valueRef.current = newText
    requestAnimationFrame(() => {
      el?.focus()
    })
  }, [onChange])

  const uploadImages = useCallback(async (files: File[]) => {
    if (!onImageUpload) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setMode('write')
    setUploading(true)
    try {
      for (const file of images) {
        const filename = await onImageUpload(file)
        insertImageMarkdown(filename, file.name.replace(/\.[^.]+$/, '') || 'image')
      }
    } catch (err) {
      toast.error(t('markdownEditor.uploadError'), { description: errorMessage(err) })
    } finally {
      setUploading(false)
    }
  }, [onImageUpload, insertImageMarkdown, t])

  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // reset so same file can be re-selected
    uploadImages(files)
  }, [uploadImages])

  const dropProps = onImageUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        },
        onDrop: (e: React.DragEvent) => {
          setDragOver(false)
          const files = Array.from(e.dataTransfer.files)
          if (!files.some((f) => f.type.startsWith('image/'))) return
          e.preventDefault()
          e.stopPropagation()
          uploadImages(files)
        },
      }
    : {}

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5 ${
      active
        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-700 dark:text-white dark:ring-white/5'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
    }`

  return (
    <div
      {...dropProps}
      className={`relative overflow-hidden rounded-lg border bg-white shadow-sm transition-[border-color,box-shadow] duration-150 dark:bg-slate-900 ${
        dragOver
          ? 'border-indigo-500 ring-4 ring-indigo-500/15 dark:border-indigo-400 dark:ring-indigo-400/20'
          : 'border-slate-300 hover:border-slate-400 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 focus-within:hover:border-indigo-500 dark:border-slate-700 dark:hover:border-slate-600 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-400/20'
      } ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-slate-200 bg-slate-50/80 px-1.5 py-1 dark:border-slate-800 dark:bg-slate-800/40">
        <div role="tablist" aria-label={t('markdownEditor.mode')} className="inline-flex items-center gap-0.5 rounded-lg bg-slate-200/60 p-0.5 dark:bg-slate-800">
          <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')} className={tabCls(mode === 'write')}>
            <Pencil />
            {t('markdownEditor.write')}
          </button>
          <button type="button" role="tab" aria-selected={mode === 'preview'} onClick={() => setMode('preview')} className={tabCls(mode === 'preview')}>
            <Eye />
            {t('markdownEditor.preview')}
          </button>
        </div>

        {mode === 'write' && (
          <div role="toolbar" aria-label={t('markdownEditor.toolbar')} className="flex flex-wrap items-center gap-0.5 sm:ml-1">
            {TOOLBAR_ACTIONS.map((action, i) =>
              action === 'sep' ? (
                <span key={`sep-${i}`} className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
              ) : (
                <IconButton
                  key={action.key}
                  size="sm"
                  icon={action.icon}
                  label={`${t(`markdownEditor.${action.key}`)}${action.shortcut ? ` (${action.shortcut})` : ''}`}
                  className="!h-7 !w-7 text-slate-500 dark:text-slate-400"
                  // Keep the textarea selection on mouse use; onClick also serves keyboard users.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFormat(action)}
                />
              ),
            )}

            {/* Image / GIF upload button (only shown when onImageUpload is provided) */}
            {onImageUpload && (
              <>
                <span className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
                <IconButton
                  size="sm"
                  icon={uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  label={t('markdownEditor.image')}
                  disabled={uploading}
                  className="!h-7 !w-7 text-slate-500 dark:text-slate-400"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.gif"
                  multiple
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {mode === 'write' ? (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            if (!onImageUpload) return
            const files = Array.from(e.clipboardData.files)
            if (files.some((f) => f.type.startsWith('image/'))) {
              e.preventDefault()
              uploadImages(files)
            }
          }}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          className="block w-full resize-y border-0 bg-transparent px-3.5 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-slate-100 dark:placeholder:text-slate-500"
          style={{ minHeight }}
        />
      ) : (
        <div className="overflow-auto px-3.5 py-3" style={{ minHeight }}>
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm italic text-slate-400 dark:text-slate-500">{t('markdownEditor.nothingToPreview')}</p>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-3.5 py-1.5 text-2xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {uploading ? (
          <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('markdownEditor.uploading')}
          </span>
        ) : (
          <span className="truncate">
            <svg viewBox="0 0 208 128" className="mr-1.5 inline-block h-2.5 w-auto -translate-y-px fill-current" aria-hidden>
              <path d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39zm125 0-30-33h20V30h20v35h20z" />
              <rect x="5" y="5" width="198" height="118" rx="15" fill="none" stroke="currentColor" strokeWidth="10" />
            </svg>
            {t('markdownEditor.supported')}
            {onImageUpload && <span className="hidden sm:inline"> · {t('markdownEditor.imageHint')}</span>}
          </span>
        )}
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-indigo-50/80 text-sm font-medium text-indigo-700 animate-fade-in dark:bg-indigo-500/10 dark:text-indigo-200">
          <ImagePlus className="mr-2 h-4 w-4" />
          {t('markdownEditor.dropImage')}
        </div>
      )}
    </div>
  )
}
