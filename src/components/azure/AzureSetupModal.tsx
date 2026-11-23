import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, DatabaseZap, Eye, EyeOff, PlugZap, Settings } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Field from '@/components/ui/Field'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toast'
import { apiFetch } from './shared'

interface AzureSetupModalProps {
  isOpen: boolean
  onClose: () => void
  showCancel: boolean
  onSaved: (org: string, project: string) => void
  /** Prefill for an existing configuration (PAT is never prefilled). */
  initialOrg?: string
  initialProject?: string
  /**
   * Starts a full rebuild of the event store (refresh with ?full=1). Only passed for users with the refresh
   * permission and an existing configuration — the section is hidden otherwise.
   */
  onFullRebuild?: () => Promise<void>
  /** A data load is already running → rebuild not possible right now. */
  loadRunning?: boolean
}

export default function AzureSetupModal(props: AzureSetupModalProps) {
  // Remount the form on every open so fields start fresh / prefilled.
  return props.isOpen ? <SetupForm {...props} /> : null
}

function SetupForm({ isOpen, onClose, showCancel, onSaved, initialOrg = '', initialProject = '', onFullRebuild, loadRunning }: AzureSetupModalProps) {
  const { t } = useTranslation()
  const [org, setOrg]         = useState(initialOrg)
  const [project, setProject] = useState(initialProject)
  const [pat, setPat]         = useState('')
  const [showPat, setShowPat] = useState(false)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [confirmRebuild, setConfirmRebuild] = useState(false)

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    setError('')
    if (!org || !project || !pat) { setError(t('azureRanking.allFieldsRequired')); return }
    setSaving(true)
    try {
      await apiFetch('/api/azure-ranking/config', { method: 'POST', body: JSON.stringify({ organization: org, project, pat }) })
      toast.success(t('azureRanking.configSaved'))
      onSaved(org, project)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      dismissible={!saving}
      title={t('azureRanking.setupTitle')}
      description={t('azureRanking.setupSubtitle')}
      icon={<Settings />}
      size="sm"
      footer={
        <>
          {showCancel && (
            <Button variant="secondary" onClick={onClose} disabled={saving}>{t('azureRanking.cancel')}</Button>
          )}
          <Button variant="primary" type="submit" form="azure-setup-form" loading={saving} icon={<PlugZap />}>
            {saving ? t('azureRanking.saving') : t('azureRanking.connect')}
          </Button>
        </>
      }
    >
      <form id="azure-setup-form" onSubmit={handleSave} className="space-y-4" autoComplete="off">
        <Field label={t('azureRanking.orgLabel')} htmlFor="az-org" required>
          <input
            id="az-org"
            className="form-input"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder={t('azureRanking.orgPlaceholder')}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label={t('azureRanking.projectLabel')} htmlFor="az-project" required>
          <input
            id="az-project"
            className="form-input"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder={t('azureRanking.projectPlaceholder')}
            autoComplete="off"
          />
        </Field>
        <Field label={t('azureRanking.patLabel')} htmlFor="az-pat" required hint={t('azureRanking.patHint')}>
          <div className="relative">
            <input
              id="az-pat"
              type={showPat ? 'text' : 'password'}
              className="form-input pr-10 font-mono placeholder:font-sans"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder={t('azureRanking.patPlaceholder')}
              autoComplete="new-password"
              spellCheck={false}
            />
            <IconButton
              size="xs"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              icon={showPat ? <EyeOff /> : <Eye />}
              label={showPat ? t('azureRanking.hideToken') : t('azureRanking.showToken')}
              onClick={() => setShowPat((v) => !v)}
            />
          </div>
        </Field>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </form>

      {/* Maintenance: full rebuild (secondary, independent of the connection form) */}
      {onFullRebuild && (
        <section className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800" aria-labelledby="az-rebuild-title">
          <h3 className="section-label mb-2.5">{t('azureRanking.maintenance')}</h3>
          <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <DatabaseZap className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p id="az-rebuild-title" className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('azureRanking.rebuildTitle')}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('azureRanking.rebuildHint')}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  icon={<DatabaseZap />}
                  disabled={saving || loadRunning}
                  onClick={() => setConfirmRebuild(true)}
                >
                  {t('azureRanking.rebuildAction')}
                </Button>
                {loadRunning && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('azureRanking.rebuildBusy')}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {onFullRebuild && (
        <ConfirmDialog
          isOpen={confirmRebuild}
          onClose={() => setConfirmRebuild(false)}
          onConfirm={onFullRebuild}
          variant="warning"
          title={t('azureRanking.rebuildConfirmTitle')}
          message={
            <div className="space-y-2">
              <p>{t('azureRanking.rebuildConfirmText')}</p>
              <p className="text-slate-500 dark:text-slate-400">{t('azureRanking.rebuildConfirmNote')}</p>
            </div>
          }
          confirmLabel={t('azureRanking.rebuildConfirm')}
        />
      )}
    </Modal>
  )
}
