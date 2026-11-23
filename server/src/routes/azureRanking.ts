import { Router } from 'express'
import { rankingService } from '../azureRanking/service'

// Azure DevOps ranking — evaluation logic lives in ../azureRanking/
//   collect.ts  – read-only data collection (work item revision stream, PRs, threads)
//   scoring.ts  – scoring model, caps, levels, badges (pure, reproducible)
//   service.ts  – incremental loading, cache, month-end history (computed from the events)

const router = Router()
const VALID_PERIODS = [7, 30, 90, 365]

router.get('/config/status', (_req, res) => {
  const { organization, project } = rankingService.config
  res.json({ configured: rankingService.configured, organization, project })
})

router.post('/config', (req, res) => {
  const { organization, project, pat } = req.body ?? {}
  if (!organization || !project || !pat)
    return res.status(400).json({ error: 'All fields are required.' })
  rankingService.saveConfig({ organization, project, pat })
  res.json({ success: true })
})

router.get('/cache/status', (_req, res) => {
  res.json({
    loading:    rankingService.loading,
    lastLoaded: rankingService.lastLoaded,
    hasData:    rankingService.hasData,
    outdated:   rankingService.outdated,
    error:      rankingService.error,
    devCount:   rankingService.devCount(),
    progress:   rankingService.progress,
  })
})

router.post('/cache/refresh', (req, res) => {
  // Check azure-ranking-refresh sub-permission for every user, including admins.
  // requirePageAccess bypasses admins, so we enforce this sub-permission here explicitly.
  const refreshPerm = req.user?.pagePermissions?.['azure-ranking-refresh'] ?? 'write'
  if (refreshPerm === 'none') {
    return res.status(403).json({ error: 'No permission to refresh data.' })
  }
  if (!rankingService.configured)
    return res.status(400).json({ error: 'Not configured.' })
  if (rankingService.loading)
    return res.json({ started: false, message: 'Load already in progress.' })

  const full = req.query.full === '1' || req.body?.full === true
  rankingService.refresh({ full }) // fire and forget
  res.json({ started: true, message: 'Data load started.' })
})

router.get('/dev-history', (req, res) => {
  const devId = String(req.query.devId || '')
  if (!devId) return res.status(400).json({ error: 'devId is required' })
  res.json({ months: rankingService.devHistory(devId) })
})

router.get('/stats', (req, res) => {
  if (!rankingService.hasData) {
    return res.status(404).json({
      noCache: true,
      loading: rankingService.loading,
      error:   rankingService.error,
      message: rankingService.loading
        ? 'Data is currently being loaded…'
        : 'No cache available. Please load data from Azure.',
    })
  }
  const days   = parseInt(String(req.query.days)) || 365
  const period = VALID_PERIODS.includes(days) ? days : 365
  const data   = rankingService.stats(period)
  if (!data) return res.status(400).json({ error: `Period ${days} not in cache.` })
  res.json(data)
})

export default router
