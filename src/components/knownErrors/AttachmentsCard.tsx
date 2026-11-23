import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Upload, Download, FileText, Trash2, UploadCloud } from 'lucide-react'
import { format } from 'date-fns'
import Panel from './Panel'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'
import { toast, errorMessage } from '@/store/toast'
import { formatFileSize, isImageMime } from './utils'

export interface AttachmentLike {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
}

interface AttachmentsCardProps<A extends AttachmentLike> {
  /** i18n namespace holding title/upload/empty/download/deleteTitle/deleteConfirm/uploaded/dropHint */
  ns: 'knownErrors.attachments' | 'meetings.attachments'
  load: () => Promise<A[]>
  upload: (file: File) => Promise<unknown>
  remove: (att: A) => Promise<unknown>
  fileUrl: (filename: string) => string
  canWrite: boolean
  /** Bump to reload the list (e.g. after an inline image upload from the markdown editor) */
  refreshKey?: number
  className?: string
}

const hoverActions =
  'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity'

/** Attachment list with upload button, drag & drop and delete confirmation. */
export default function AttachmentsCard<A extends AttachmentLike>({
  ns, load, upload, remove, fileUrl, canWrite, refreshKey = 0, className = '',
}: AttachmentsCardProps<A>) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems]       = useState<A[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<A | null>(null)

  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    try {
      setItems(await loadRef.current())
    } catch (err) {
      toast.error(t('common.loadError'), { description: errorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { reload() }, [reload, refreshKey])

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) await upload(file)
      toast.success(t(`${ns}.uploaded`, { count: files.length }))
    } catch (err) {
      toast.error(t(`${ns}.uploadError`), { description: errorMessage(err) })
    } finally {
      setUploading(false)
      reload()
    }
  }

  async function handleDelete(att: A) {
    try {
      await remove(att)
      setItems((prev) => prev.filter((a) => a.id !== att.id))
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const dropProps = canWrite
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) return
          e.preventDefault()
          setDragOver(true)
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        },
        onDrop: (e: React.DragEvent) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setDragOver(false)
          uploadFiles(Array.from(e.dataTransfer.files))
        },
      }
    : {}

  return (
    <div {...dropProps} className={`relative ${className}`}>
      <Panel
        icon={<Paperclip />}
        title={t(`${ns}.title`)}
        count={items.length}
        action={
          canWrite && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Upload />}
                loading={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {t(`${ns}.upload`)}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  uploadFiles(files)
                }}
              />
            </>
          )
        }
        bodyClassName=""
      >
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700/80">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t(`${ns}.empty`)}</p>
              {canWrite && (
                <p className="text-xs text-slate-400 dark:text-slate-500">{t(`${ns}.dropHint`)}</p>
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((att) => {
              const url = fileUrl(att.filename)
              const isImg = isImageMime(att.mimeType)
              return (
                <li key={att.id} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700/60"
                    tabIndex={-1}
                    aria-hidden
                  >
                    {isImg ? (
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <FileText className="h-[18px] w-[18px] text-slate-400" />
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={att.originalName}
                      className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                    >
                      {att.originalName}
                    </a>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatFileSize(att.size)} · {format(new Date(att.uploadedAt), 'dd.MM.yyyy')}
                    </p>
                  </div>
                  <div className={`flex shrink-0 items-center gap-0.5 ${hoverActions}`}>
                    <a
                      href={url}
                      download={att.originalName}
                      aria-label={t(`${ns}.download`)}
                      title={t(`${ns}.download`)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {canWrite && (
                      <IconButton
                        icon={<Trash2 />}
                        label={t('common.delete')}
                        variant="danger"
                        onClick={() => setConfirmDelete(att)}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-sm font-medium text-indigo-700 animate-fade-in dark:border-indigo-400/70 dark:bg-indigo-500/15 dark:text-indigo-200">
          <UploadCloud className="h-6 w-6" />
          {t(`${ns}.dropNow`)}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t(`${ns}.deleteTitle`)}
        message={t(`${ns}.deleteConfirm`, { name: confirmDelete?.originalName ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        variant="danger"
      />
    </div>
  )
}
