import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { seedIfEmpty, seedResponsibilityTypes } from './seed'
import { requireAuth, requirePageAccess } from './middleware/auth'
import authRouter, { seedAdminUser } from './routes/auth'
import adminRouter from './routes/admin'
import membersRouter from './routes/members'
import skillsRouter from './routes/skills'
import sprintsRouter from './routes/sprints'
import assignmentsRouter from './routes/assignments'
import retrospectivesRouter from './routes/retrospectives'
import responsibilityTypesRouter from './routes/responsibilityTypes'
import pulseRouter from './routes/pulse'
import azureRankingRouter from './routes/azureRanking'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

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

// ─── Public Routes (no token required) ───────────────────────────────────────
app.use('/api/auth', authRouter)

// Health check (public, does not expose any application data)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Protected API Routes ─────────────────────────────────────────────────────
// requireAuth    → valid JWT required
// requirePageAccess → page locks are also enforced at the API level
const guard = [requireAuth, requirePageAccess]

app.use('/api/admin',                requireAuth,   adminRouter)   // page lock not relevant here
app.use('/api/members',              ...guard,       membersRouter)
app.use('/api/skills',               ...guard,       skillsRouter)
app.use('/api/sprints',              ...guard,       sprintsRouter)
app.use('/api/assignments',          ...guard,       assignmentsRouter)
app.use('/api/retrospectives',       ...guard,       retrospectivesRouter)
app.use('/api/responsibility-types', ...guard,       responsibilityTypesRouter)
app.use('/api/pulse',                ...guard,       pulseRouter)
app.use('/api/azure-ranking',        ...guard,       azureRankingRouter)

// ─── Serve built frontend (production) ───────────────────────────────────────
const DIST = path.join(__dirname, '..', '..', 'dist')
app.use(express.static(DIST))
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

// ─── Seed & Start ─────────────────────────────────────────────────────────────
seedIfEmpty()
seedResponsibilityTypes()
seedAdminUser()

app.listen(PORT, () => {
  console.log(`Team Board Server running on http://localhost:${PORT}`)
  console.log(`API available at http://localhost:${PORT}/api`)
  console.log(`CORS allowed for: ${CORS_ORIGIN}`)
})
