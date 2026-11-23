import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Globe, MoreHorizontal, Pencil, Trash2, ArrowUpRight, Link2, Check } from 'lucide-react'
import type { DashboardTile } from '@/types'
import { dashboardTilesApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Field from '@/components/ui/Field'
import SectionHeader from '@/components/ui/SectionHeader'
import Skeleton from '@/components/ui/Skeleton'

/** Tile accent colors (stored by key on the tile). */
export const TILE_COLORS: Record<string, { bg: string; ring: string }> = {
  indigo:  { bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',   ring: 'ring-indigo-500' },
  violet:  { bg: 'bg-gradient-to-br from-violet-500 to-violet-600',   ring: 'ring-violet-500' },
  sky:     { bg: 'bg-gradient-to-br from-sky-500 to-sky-600',         ring: 'ring-sky-500' },
  teal:    { bg: 'bg-gradient-to-br from-teal-500 to-teal-600',       ring: 'ring-teal-500' },
  emerald: { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', ring: 'ring-emerald-500' },
  amber:   { bg: 'bg-gradient-to-br from-amber-400 to-amber-500',     ring: 'ring-amber-500' },
  orange:  { bg: 'bg-gradient-to-br from-orange-500 to-orange-600',   ring: 'ring-orange-500' },
  rose:    { bg: 'bg-gradient-to-br from-rose-500 to-rose-600',       ring: 'ring-rose-500' },
  slate:   { bg: 'bg-gradient-to-br from-slate-500 to-slate-600',     ring: 'ring-slate-500' },
}

type TileForm = { title: string; url: string; description: string; color: string; isGlobal: boolean }
const EMPTY_FORM: TileForm = { title: '', url: '', description: '', color: 'indigo', isGlobal: false }

function hostOf(url: string): string {
  if (url.startsWith('#')) return url.replace(/^#\/?/, '/')
  try { return new URL(url).host.replace(/^www\./, '') } catch { return url }
}

function TileVisual({ tile, preview = false }: { tile: Pick<DashboardTile, 'title' | 'url' | 'description' | 'color' | 'isGlobal'>; preview?: boolean }) {
  const { t } = useTranslation()
  const colors = TILE_COLORS[tile.color] ?? TILE_COLORS.indigo
  const internal = tile.url.startsWith('#')
  const subtitle = tile.description || (tile.url ? hostOf(tile.url) : '')
  return (
    <>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white shadow-sm ring-1 ring-inset ring-white/15 ${colors.bg}`}>
        {(tile.title.trim().charAt(0) || '?').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span className="truncate">{tile.title || (preview ? t('dashboard.tileTitle') : '')}</span>
          {!internal && tile.url && (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-px group-hover:translate-x-px dark:text-slate-500" aria-hidden />
          )}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {tile.isGlobal && (
            <Globe className="h-3 w-3 shrink-0 text-indigo-500 dark:text-indigo-400" aria-label={t('dashboard.tileGlobal')} />
          )}
          <span className="truncate">{subtitle || ' '}</span>
        </p>
      </div>
    </>
  )
}

/** Personal / global link tiles with create, edit and delete. */
export default function QuickAccessTiles() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)

  const [tiles, setTiles] = useState<DashboardTile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; tile?: DashboardTile }>({ open: false })
  const [form, setForm] = useState<TileForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DashboardTile | null>(null)

  useEffect(() => {
    dashboardTilesApi.list().then(setTiles).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setModal({ open: true })
  }

  function openEdit(tile: DashboardTile) {
    setForm({ title: tile.title, url: tile.url, description: tile.description, color: tile.color, isGlobal: tile.isGlobal })
    setModal({ open: true, tile })
  }

  const valid = !!form.title.trim() && !!form.url.trim()

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      if (modal.tile) {
        const updated = await dashboardTilesApi.update(modal.tile.id, form)
        setTiles((prev) => prev.map((x) => (x.id === modal.tile!.id ? updated : x)))
        toast.success(t('common.saved'))
      } else {
        const created = await dashboardTilesApi.create(form)
        setTiles((prev) => [...prev, created])
        toast.success(t('common.created'))
      }
      setModal({ open: false })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await dashboardTilesApi.delete(deleteTarget.id)
      setTiles((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const canEdit = (tile: DashboardTile) => tile.userId === currentUser?.id || currentUser?.role === 'admin'

  return (
    <section aria-labelledby="quick-access-heading">
      <SectionHeader
        title={<span id="quick-access-heading">{t('dashboard.quickAccess')}</span>}
        count={loaded && tiles.length > 0 ? tiles.length : undefined}
      />

      {!loaded ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface flex items-center gap-3 p-3.5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <button
          type="button"
          onClick={openCreate}
          className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white/50 p-4 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-500/15 dark:group-hover:text-indigo-300">
            <Plus className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{t('dashboard.addTile')}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{t('dashboard.noTiles')}</span>
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => {
            const internal = tile.url.startsWith('#')
            const editable = canEdit(tile)
            return (
              <li key={tile.id} className="group relative">
                <a
                  href={tile.url}
                  {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  title={tile.description ? `${tile.title} – ${tile.description}` : tile.title}
                  className={`surface-interactive flex items-center gap-3 p-3.5 hover:-translate-y-px ${editable ? 'pr-11' : ''}`}
                >
                  <TileVisual tile={tile} />
                </a>
                {editable && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100">
                    <DropdownMenu
                      width="w-44"
                      trigger={(p) => (
                        <IconButton {...p} size="sm" icon={<MoreHorizontal />} label={t('common.moreActions')} />
                      )}
                      items={[
                        { label: t('common.edit'), icon: <Pencil />, onClick: () => openEdit(tile) },
                        { type: 'divider' },
                        { label: t('common.delete'), icon: <Trash2 />, danger: true, onClick: () => setDeleteTarget(tile) },
                      ]}
                    />
                  </div>
                )}
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={openCreate}
              className="flex h-full min-h-[68px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/5 dark:hover:text-indigo-300"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.addTile')}
            </button>
          </li>
        </ul>
      )}

      {/* Create / edit */}
      <Modal
        isOpen={modal.open}
        onClose={() => !saving && setModal({ open: false })}
        title={modal.tile ? t('dashboard.editTile') : t('dashboard.addTile')}
        description={t('dashboard.tileModalDescription')}
        icon={<Link2 />}
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false })} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="tile-form" variant="primary" loading={saving} disabled={!valid}>
              {modal.tile ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="tile-form" onSubmit={save} className="space-y-4">
          {/* Live preview */}
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <p className="section-label mb-2">{t('dashboard.tilePreview')}</p>
            <div className="surface flex items-center gap-3 p-3.5">
              <TileVisual tile={form} preview />
            </div>
          </div>

          <Field label={t('dashboard.tileTitle')} htmlFor="tile-title" required>
            <input
              id="tile-title"
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="form-input"
              placeholder="Jira"
              maxLength={60}
            />
          </Field>
          <Field label={t('dashboard.tileUrl')} htmlFor="tile-url" required hint={t('dashboard.tileUrlHint')}>
            <input
              id="tile-url"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              className="form-input"
              placeholder="https://jira.example.com"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label={t('dashboard.tileDescription')} htmlFor="tile-desc">
            <input
              id="tile-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="form-input"
              placeholder="Issue-Tracking"
            />
          </Field>
          <div>
            <p className="form-label" id="tile-color-label">{t('dashboard.tileColor')}</p>
            <div role="radiogroup" aria-labelledby="tile-color-label" className="flex flex-wrap gap-2">
              {Object.entries(TILE_COLORS).map(([key, c]) => {
                const selected = form.color === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t(`dashboard.tileColors.${key}`)}
                    title={t(`dashboard.tileColors.${key}`)}
                    onClick={() => setForm((p) => ({ ...p, color: key }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform ${c.bg} ${
                      selected ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${c.ring} scale-105` : 'hover:scale-105'
                    }`}
                  >
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={form.isGlobal}
              onChange={(e) => setForm((p) => ({ ...p, isGlobal: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <Globe className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                {t('dashboard.tileGlobal')}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('dashboard.tileGlobalHint')}</span>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('dashboard.deleteTile')}
        message={t('dashboard.deleteTileConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </section>
  )
}
