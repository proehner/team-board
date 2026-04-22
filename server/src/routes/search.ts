import { Router } from 'express'
import { dbAll } from '../db'

const router = Router()

export interface SearchHit {
  type: string
  id: string
  title: string
  subtitle?: string
  url: string
  score: number
}

function scoreHit(title: string, others: (string | null | undefined)[], q: string): number {
  const ql = q.toLowerCase()
  const tl = title.toLowerCase()
  if (tl.startsWith(ql)) return 3
  if (tl.includes(ql)) return 2
  if (others.some((s) => s && s.toLowerCase().includes(ql))) return 1
  return 0
}

// GET /api/search?q=...
router.get('/', (req, res) => {
  const teamId = req.headers['x-team-id'] as string | undefined
  const q      = ((req.query.q as string) ?? '').trim()
  if (q.length < 2) return res.json([])

  const hits: SearchHit[] = []

  // ── Members (team-scoped) ─────────────────────────────────────────────────
  if (teamId) {
    const rows = dbAll<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM members WHERE teamId = ? AND isActive = 1`,
      [teamId],
    )
    for (const m of rows) {
      const s = scoreHit(m.name, [m.email], q)
      if (s > 0) hits.push({ type: 'member', id: m.id, title: m.name, subtitle: m.email || undefined, url: '/team', score: s })
    }
  }

  // ── Skills (global) ─────────────────────────────────────────────────────────
  const skillRows = dbAll<{ id: string; name: string; category: string; description: string }>(
    `SELECT id, name, category, description FROM skills`,
  )
  for (const sk of skillRows) {
    const s = scoreHit(sk.name, [sk.category, sk.description], q)
    if (s > 0) hits.push({ type: 'skill', id: sk.id, title: sk.name, subtitle: sk.category || undefined, url: '/kompetenzen', score: s })
  }

  // ── Known Errors (global) ─────────────────────────────────────────────────
  const keRows = dbAll<{ id: string; title: string; description: string; ticketNumber: string; tags: string }>(
    `SELECT id, title, description, ticketNumber, tags FROM known_errors`,
  )
  for (const ke of keRows) {
    const tags = JSON.parse(ke.tags ?? '[]').join(' ')
    const s    = scoreHit(ke.title, [ke.description, ke.ticketNumber, tags], q)
    if (s > 0) hits.push({ type: 'knownError', id: ke.id, title: ke.title, subtitle: ke.ticketNumber || undefined, url: `/known-errors/${ke.id}`, score: s })
  }

  // ── Software (global) ─────────────────────────────────────────────────────
  const swRows = dbAll<{ id: string; name: string; description: string }>(
    `SELECT id, name, description FROM software`,
  )
  for (const sw of swRows) {
    const s = scoreHit(sw.name, [sw.description], q)
    if (s > 0) hits.push({ type: 'software', id: sw.id, title: sw.name, subtitle: sw.description?.slice(0, 80) || undefined, url: '/known-errors', score: s })
  }

  // ── Meetings (team-scoped or global) ──────────────────────────────────────
  const meetingRows = teamId
    ? dbAll<{ id: string; title: string; description: string }>(
        `SELECT id, title, description FROM meetings WHERE (teamId = ? OR isGlobal = 1)`,
        [teamId],
      )
    : dbAll<{ id: string; title: string; description: string }>(
        `SELECT id, title, description FROM meetings WHERE isGlobal = 1`,
      )

  const meetingMap = new Map(meetingRows.map((m) => [m.id, m]))

  for (const m of meetingRows) {
    const s = scoreHit(m.title, [m.description], q)
    if (s > 0) hits.push({ type: 'meeting', id: m.id, title: m.title, url: `/meetings/${m.id}`, score: s })
  }

  // ── Meeting Topics ────────────────────────────────────────────────────────
  if (meetingMap.size > 0) {
    const ids = [...meetingMap.keys()]
    const ph  = ids.map(() => '?').join(',')
    const topics = dbAll<{ id: string; title: string; description: string; meetingId: string }>(
      `SELECT id, title, description, meetingId FROM meeting_topics WHERE meetingId IN (${ph}) AND status = 'open'`,
      ids,
    )
    for (const t of topics) {
      const s = scoreHit(t.title, [t.description], q)
      if (s > 0) {
        const mtg = meetingMap.get(t.meetingId)
        hits.push({ type: 'topic', id: t.id, title: t.title, subtitle: mtg?.title, url: `/meetings/${t.meetingId}/topics/${t.id}`, score: s })
      }
    }
  }

  // ── Roadmap Features (global) ─────────────────────────────────────────────
  const featureRows = dbAll<{ id: string; title: string; description: string; status: string }>(
    `SELECT id, title, description, status FROM roadmap_features`,
  )
  const featureMap = new Map(featureRows.map((f) => [f.id, f]))

  for (const f of featureRows) {
    const s = scoreHit(f.title, [f.description], q)
    if (s > 0) hits.push({ type: 'roadmapFeature', id: f.id, title: f.title, subtitle: f.status || undefined, url: `/roadmap/features/${f.id}`, score: s })
  }

  // ── Roadmap Tickets (global) ──────────────────────────────────────────────
  const ticketRows = dbAll<{ id: string; title: string; description: string; featureId: string }>(
    `SELECT id, title, description, featureId FROM roadmap_tickets`,
  )
  for (const t of ticketRows) {
    const s = scoreHit(t.title, [t.description], q)
    if (s > 0) hits.push({ type: 'roadmapTicket', id: t.id, title: t.title, url: `/roadmap/features/${t.featureId}`, score: s })
  }

  // ── Roadmap Endpoints (global) ────────────────────────────────────────────
  const endpointRows = dbAll<{ id: string; title: string; path: string; description: string; featureId: string }>(
    `SELECT id, title, path, description, featureId FROM roadmap_endpoints`,
  )
  for (const e of endpointRows) {
    const label = e.title || e.path
    if (!label) continue
    const feature = featureMap.get(e.featureId)
    const s = scoreHit(label, [e.path, e.description], q)
    if (s > 0) hits.push({ type: 'roadmapEndpoint', id: e.id, title: label, subtitle: feature?.title, url: `/roadmap/features/${e.featureId}`, score: s })
  }

  // ── Roadmap Screens (global) ──────────────────────────────────────────────
  const screenRows = dbAll<{ id: string; title: string; route: string; description: string; featureId: string }>(
    `SELECT id, title, route, description, featureId FROM roadmap_screens`,
  )
  for (const sc of screenRows) {
    const label = sc.title || sc.route
    if (!label) continue
    const feature = featureMap.get(sc.featureId)
    const s = scoreHit(label, [sc.route, sc.description], q)
    if (s > 0) hits.push({ type: 'roadmapScreen', id: sc.id, title: label, subtitle: feature?.title, url: `/roadmap/features/${sc.featureId}`, score: s })
  }

  // ── Sprints (team-scoped) ─────────────────────────────────────────────────
  if (teamId) {
    const sprintRows = dbAll<{ id: string; name: string; goal: string; notes: string }>(
      `SELECT id, name, goal, notes FROM sprints WHERE teamId = ?`,
      [teamId],
    )
    for (const sp of sprintRows) {
      const s = scoreHit(sp.name, [sp.goal, sp.notes], q)
      if (s > 0) hits.push({ type: 'sprint', id: sp.id, title: sp.name, subtitle: sp.goal?.slice(0, 80) || undefined, url: `/sprints/${sp.id}`, score: s })
    }
  }

  // ── Retrospectives (team-scoped) ──────────────────────────────────────────
  if (teamId) {
    const retroRows = dbAll<{ id: string; title: string; date: string }>(
      `SELECT id, title, date FROM retrospectives WHERE teamId = ?`,
      [teamId],
    )
    const retroMap = new Map(retroRows.map((r) => [r.id, r]))

    for (const r of retroRows) {
      const s = scoreHit(r.title, [r.date], q)
      if (s > 0) hits.push({ type: 'retro', id: r.id, title: r.title, subtitle: r.date.slice(0, 10), url: `/retro/${r.id}`, score: s })
    }

    // ── Retro Items ───────────────────────────────────────────────────────
    if (retroMap.size > 0) {
      const ids = [...retroMap.keys()]
      const ph  = ids.map(() => '?').join(',')
      const itemRows = dbAll<{ id: string; text: string; type: string; retroId: string }>(
        `SELECT id, text, type, retroId FROM retro_items WHERE retroId IN (${ph})`,
        ids,
      )
      for (const item of itemRows) {
        const s = scoreHit(item.text, [], q)
        if (s > 0) {
          const retro = retroMap.get(item.retroId)
          hits.push({ type: 'retroItem', id: item.id, title: item.text.slice(0, 100), subtitle: retro?.title, url: `/retro/${item.retroId}`, score: s })
        }
      }
    }
  }

  // ── Pulse Checks (team-scoped) ────────────────────────────────────────────
  if (teamId) {
    const pulseRows = dbAll<{ id: string; title: string; questions: string }>(
      `SELECT id, title, questions FROM pulse_checks WHERE teamId = ?`,
      [teamId],
    )
    for (const pc of pulseRows) {
      const questions = JSON.parse(pc.questions ?? '[]').join(' ')
      const s = scoreHit(pc.title, [questions], q)
      if (s > 0) hits.push({ type: 'pulseCheck', id: pc.id, title: pc.title, url: '/pulse', score: s })
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  res.json(hits.slice(0, 40))
})

export default router
