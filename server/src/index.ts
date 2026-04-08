import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { seedIfEmpty, seedResponsibilityTypesForAllTeams } from './seed'
import { requireAuth, requirePageAccess, requireTeam } from './middleware/auth'
import authRouter, { seedAdminUser } from './routes/auth'
import adminRouter from './routes/admin'
import teamsRouter from './routes/teams'
import membersRouter from './routes/members'
import skillsRouter from './routes/skills'
import sprintsRouter from './routes/sprints'
import assignmentsRouter from './routes/assignments'
import retrospectivesRouter from './routes/retrospectives'
import responsibilityTypesRouter from './routes/responsibilityTypes'
import pulseRouter from './routes/pulse'
import azureRankingRouter from './routes/azureRanking'
import softwareRouter from './routes/software'
import knownErrorsRouter from './routes/knownErrors'

const app = express()
const PORT: string | number = process.env.PORT ?? 3001

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Configure allowed origin via environment variable.
// Development: http://localhost:5173 (Vite dev server)
// Production:  CORS_ORIGIN=https://my-server.internal
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}))
app.use(express.json())

// ─── IIS sub-application prefix handling ──────────────────────────────────────
// When running under iisnode as an IIS Application (e.g. at /board/),
// req.url contains the full path including the application prefix.
// Express routes expect URLs without that prefix, so we strip it here.
const APP_BASE_PATH = (process.env.APP_BASE_PATH || '').replace(/\/$/, '')
if (APP_BASE_PATH) {
  app.use((req, _res, next) => {
    if (req.url.startsWith(APP_BASE_PATH)) {
      req.url = req.url.slice(APP_BASE_PATH.length) || '/'
    }
    if (req.originalUrl.startsWith(APP_BASE_PATH)) {
      req.originalUrl = req.originalUrl.slice(APP_BASE_PATH.length) || '/'
    }
    next()
  })
}

// ─── Public Routes (no token required) ───────────────────────────────────────
app.use('/api/auth', authRouter)

// Health check (public, does not expose any application data)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Protected API Routes ─────────────────────────────────────────────────────
// requireAuth       → valid JWT required
// requirePageAccess → page locks are also enforced at the API level
// requireTeam       → X-Team-ID header required (team-scoped routes only)
const guard      = [requireAuth, requirePageAccess]
const teamGuard  = [requireAuth, requirePageAccess, requireTeam]

app.use('/api/admin',                requireAuth,   adminRouter)   // page lock not relevant here
app.use('/api/teams',                requireAuth,   teamsRouter)   // team list is global, CRUD requires admin
app.use('/api/members',              ...teamGuard,  membersRouter)
app.use('/api/skills',               ...guard,      skillsRouter)
app.use('/api/sprints',              ...teamGuard,  sprintsRouter)
app.use('/api/assignments',          ...teamGuard,  assignmentsRouter)
app.use('/api/retrospectives',       ...teamGuard,  retrospectivesRouter)
app.use('/api/responsibility-types', ...teamGuard,  responsibilityTypesRouter)
app.use('/api/pulse',                ...teamGuard,  pulseRouter)
app.use('/api/azure-ranking',        ...guard,      azureRankingRouter)
app.use('/api/software',             ...guard,      softwareRouter)
app.use('/api/known-errors',         ...guard,      knownErrorsRouter)

// ─── Serve built frontend (production) ───────────────────────────────────────
const DIST = path.join(__dirname, '..', '..', 'dist')
app.use(express.static(DIST))
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

// ─── Seed & Start ─────────────────────────────────────────────────────────────
seedIfEmpty()
seedResponsibilityTypesForAllTeams()
seedAdminUser()

app.listen(PORT, () => {
  console.log(`Team Board Server running on http://localhost:${PORT}`)
  console.log(`API available at http://localhost:${PORT}/api`)
  console.log(`CORS allowed for: ${CORS_ORIGIN}`)
})
