import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Badge   { id: string; name: string; icon: string; desc: string }
interface Level   { name: string; icon: string; color: string; min: number; next: number | null }
interface LevelDef { name: string; icon: string; color: string; min: number; max: number | null }

interface DevStats {
  id:                 string
  displayName:        string
  uniqueName:         string
  repositories:       string[]
  prsCreated:         number
  prsCompleted:       number
  commentsGiven:      number
  approvalsGiven:     number
  rejectionsGiven:    number
  commits:            number
  workItemsCompleted: number
  ticketsCreated:     number
  ticketComments:     number
  points:             number
  badges:             Badge[]
  level:              Level
  rank:               number
}

interface PeriodData {
  developers:  DevStats[]
  totals: { prs: number; commits: number; workItems: number; comments: number; ticketsCreated: number; ticketComments: number }
  fromDate: string
  toDate:   string
  days:     number
  scoring:  Record<string, number>
  levels:   LevelDef[]
}

interface CacheStatus {
  loading:    boolean
  lastLoaded: string | null
  hasData:    boolean
  error:      string | null
  devCount:   number
  progress:   { step: string; message: string; repo: string; done: number; total: number }
}

interface ConfigStatus { configured: boolean; organization: string; project: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const BREAKDOWN_DEFS = [
  { field: 'prsCreated',         label: '🔀 PRs erstellt',          scoringKey: 'prCreated',        color: '#58a6ff' },
  { field: 'prsCompleted',       label: '✅ PRs gemergt',           scoringKey: 'prCompleted',       color: '#3fb950' },
  { field: 'commentsGiven',      label: '💬 PR-Review-Kommentare',  scoringKey: 'prComment',         color: '#bc8cff' },
  { field: 'approvalsGiven',     label: '👍 PR-Approvals',          scoringKey: 'prApproved',        color: '#a5d6ff' },
  { field: 'rejectionsGiven',    label: '⛔ PR-Ablehnungen',        scoringKey: 'prRejected',        color: '#f0883e' },
  { field: 'commits',            label: '💻 Commits',               scoringKey: 'commit',            color: '#56d364' },
  { field: 'workItemsCompleted', label: '📋 Tickets abgeschlossen', scoringKey: 'workItemCompleted', color: '#e3b341' },
  { field: 'ticketsCreated',     label: '📝 Tickets erstellt',      scoringKey: 'ticketCreated',     color: '#ffa657' },
  { field: 'ticketComments',     label: '🗒️ Ticket-Kommentare',     scoringKey: 'ticketComment',     color: '#d2a8ff' },
] as const

const CATEGORIES = [
  { key: 'points',             label: '🏆 Gesamt',             field: 'points'             },
  { key: 'prsCreated',         label: '🔀 PRs erstellt',       field: 'prsCreated'         },
  { key: 'prsCompleted',       label: '✅ PRs gemergt',        field: 'prsCompleted'       },
  { key: 'commentsGiven',      label: '💬 PR-Reviews',         field: 'commentsGiven'      },
  { key: 'approvalsGiven',     label: '👍 Approvals',          field: 'approvalsGiven'     },
  { key: 'commits',            label: '💻 Commits',            field: 'commits'            },
  { key: 'workItemsCompleted', label: '📋 Tickets erledigt',   field: 'workItemsCompleted' },
  { key: 'ticketsCreated',     label: '📝 Tickets erstellt',   field: 'ticketsCreated'     },
  { key: 'ticketComments',     label: '🗒️ Ticket-Kommentare', field: 'ticketComments'     },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

const AVATAR_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#98D8C8','#BB8FCE','#82E0AA','#F39C12',
  '#3498DB','#9B59B6','#E74C3C','#1ABC9C','#E67E22',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(/[\s._@]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function fmt(n: number) { return Number(n).toLocaleString('de-DE') }

function levelStyle(level: Level): React.CSSProperties {
  const bg: Record<string, string> = {
    Bronze: 'rgba(205,127,50,.2)', Silber: 'rgba(192,192,192,.2)',
    Gold: 'rgba(255,215,0,.2)', Platin: 'rgba(229,228,226,.2)', Diamond: 'rgba(0,191,255,.2)',
  }
  return {
    background: bg[level.name] || '',
    color: level.color,
    border: `1px solid ${level.color}40`,
  }
}

function progressPercent(dev: DevStats) {
  const { level } = dev
  if (!level.next) return 100
  return Math.min(100, Math.round(((dev.points - level.min) / (level.next - level.min)) * 100))
}

function sortedDevs(devs: DevStats[], category: CategoryKey): DevStats[] {
  const cat = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0]
  return [...devs].sort((a, b) => (b[cat.field as keyof DevStats] as number) - (a[cat.field as keyof DevStats] as number))
}

function getNextLevelName(currentName: string) {
  const order = ['Bronze', 'Silber', 'Gold', 'Platin', 'Diamond']
  const icons: Record<string, string> = { Bronze: '🥉', Silber: '🥈', Gold: '🥇', Platin: '🏆', Diamond: '💎' }
  const idx  = order.indexOf(currentName)
  const next = order[idx + 1]
  return next ? `${icons[next]} ${next}` : ''
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('teamlead_token')
  const res   = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...opts,
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error || `HTTP ${res.status}`), json)
  return json as T
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DevAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div style={{
      background: avatarColor(name), color: '#fff',
      width: size, height: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name) || '?'}
    </div>
  )
}

function LevelBadge({ level, style }: { level: Level; style?: React.CSSProperties }) {
  return (
    <span style={{
      ...levelStyle(level),
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '.72rem', padding: '.15rem .5rem',
      borderRadius: 20, fontWeight: 600,
      ...style,
    }}>
      {level.icon} {level.name}
    </span>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DevModal({ dev, scoring, onClose }: { dev: DevStats; scoring: Record<string, number>; onClose: () => void }) {
  const pct    = progressPercent(dev)
  const maxPts = Math.max(1, ...BREAKDOWN_DEFS.map((b) => ((dev[b.field as keyof DevStats] as number) || 0) * (scoring[b.scoringKey] || 0)))

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 14,
        width: '100%', maxWidth: 760, position: 'relative', padding: '2rem',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'var(--az-surface2)', border: '1px solid var(--az-border)',
          color: '#8b949e', borderRadius: 6, width: 32, height: 32,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--az-border)' }}>
          <DevAvatar name={dev.displayName} size={72} />
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--az-text)', marginBottom: '.2rem' }}>{dev.displayName}</div>
            <div style={{ fontSize: '.82rem', color: '#8b949e', marginBottom: '.4rem' }}>{dev.uniqueName}</div>
            <LevelBadge level={dev.level} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, background: 'linear-gradient(135deg,#58a6ff,#bc8cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fmt(dev.points)}</div>
            <div style={{ fontSize: '.75rem', color: '#8b949e', marginTop: '.1rem' }}>Punkte gesamt</div>
          </div>
        </div>

        {/* Level Progress */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#8b949e', marginBottom: '.4rem' }}>
            <span>{dev.level.icon} {dev.level.name} ({fmt(dev.level.min)} Pkt.)</span>
            <span>{pct}%</span>
            <span>{dev.level.next ? `${fmt(dev.level.next)} Pkt. → ${getNextLevelName(dev.level.name)}` : '🏆 Maximales Level erreicht!'}</span>
          </div>
          <div style={{ height: 8, background: 'var(--az-surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: dev.level.color, borderRadius: 4, transition: 'width .6s ease' }} />
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8b949e', marginBottom: '.9rem' }}>🎯 Punkte-Aufschlüsselung</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
            {BREAKDOWN_DEFS.map((b) => {
              const count   = (dev[b.field as keyof DevStats] as number) || 0
              const ptsEach = scoring[b.scoringKey] || 0
              const total   = Math.round(count * ptsEach)
              const barW    = maxPts > 0 ? Math.round((total / maxPts) * 100) : 0
              return (
                <div key={b.field} style={{ display: 'grid', gridTemplateColumns: '180px auto 1fr auto', alignItems: 'center', gap: '.75rem', fontSize: '.85rem', opacity: count === 0 ? .35 : 1 }}>
                  <span style={{ color: 'var(--az-text)' }}>{b.label}</span>
                  <span style={{ color: '#8b949e', fontSize: '.78rem', whiteSpace: 'nowrap', minWidth: 110, textAlign: 'right' }}>{fmt(count)} × {ptsEach} {count > 0 ? `= ${fmt(total)}` : ''}</span>
                  <div style={{ height: 8, background: 'var(--az-surface2)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width .5s ease' }} />
                  </div>
                  <span style={{ fontWeight: 700, color: b.color, textAlign: 'right', whiteSpace: 'nowrap', minWidth: 60 }}>{fmt(total)} Pkt.</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stat Grid */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8b949e', marginBottom: '.9rem' }}>📊 Aktivitäts-Übersicht</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '.6rem' }}>
            {[
              { icon: '🔀', val: dev.prsCreated,        label: 'PRs erstellt' },
              { icon: '✅', val: dev.prsCompleted,       label: 'PRs gemergt' },
              { icon: '💬', val: dev.commentsGiven,      label: 'PR-Kommentare' },
              { icon: '👍', val: dev.approvalsGiven,     label: 'Approvals' },
              { icon: '⛔', val: dev.rejectionsGiven,    label: 'Ablehnungen' },
              { icon: '💻', val: dev.commits,            label: 'Commits' },
              { icon: '📋', val: dev.workItemsCompleted, label: 'Tickets erledigt' },
              { icon: '📝', val: dev.ticketsCreated,     label: 'Tickets erstellt' },
              { icon: '🗒️', val: dev.ticketComments,     label: 'Ticket-Komm.' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 10, padding: '.85rem .75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '.3rem' }}>{s.icon}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--az-accent)' }}>{fmt(s.val)}</div>
                <div style={{ fontSize: '.72rem', color: '#8b949e', marginTop: '.15rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Badges */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8b949e', marginBottom: '.9rem' }}>🏅 Errungenschaften</div>
          {dev.badges.length === 0
            ? <p style={{ color: '#484f58', fontSize: '.85rem', fontStyle: 'italic' }}>Noch keine Errungenschaften in diesem Zeitraum.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem' }}>
                {dev.badges.map((b) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 8, padding: '.5rem .85rem', fontSize: '.82rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{b.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--az-text)' }}>{b.name}</div>
                      <div style={{ color: '#8b949e', fontSize: '.72rem' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Repos */}
        <div>
          <div style={{ fontSize: '.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8b949e', marginBottom: '.9rem' }}>📁 Repositories</div>
          {dev.repositories.length === 0
            ? <p style={{ color: '#484f58', fontSize: '.85rem', fontStyle: 'italic' }}>Keine Repository-Daten verfügbar.</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                {dev.repositories.map((r) => (
                  <span key={r} style={{ background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 20, padding: '.25rem .75rem', fontSize: '.82rem', color: '#8b949e' }}>📁 {r}</span>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Setup Modal ──────────────────────────────────────────────────────────────

function SetupModal({ onClose, showCancel, onSaved }: { onClose: () => void; showCancel: boolean; onSaved: (org: string, project: string) => void }) {
  const [org, setOrg]         = useState('')
  const [project, setProject] = useState('')
  const [pat, setPat]         = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setError('')
    if (!org || !project || !pat) { setError('Alle Felder müssen ausgefüllt werden.'); return }
    setSaving(true)
    try {
      await apiFetch('/api/azure-ranking/config', { method: 'POST', body: JSON.stringify({ organization: org, project, pat }) })
      onSaved(org, project)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
        <h2 style={{ color: 'var(--az-text)', marginBottom: '.25rem', fontSize: '1.4rem' }}>⚙️ Azure DevOps Konfiguration</h2>
        <p style={{ color: '#8b949e', marginBottom: '1.5rem', fontSize: '.9rem' }}>Verbinde dich mit deiner Azure DevOps Organisation</p>

        {[
          { label: 'Organisation', value: org, onChange: setOrg, placeholder: 'z.B. mycompany', type: 'text' },
          { label: 'Projekt',      value: project, onChange: setProject, placeholder: 'z.B. MyProject', type: 'text' },
          { label: 'Personal Access Token (PAT)', value: pat, onChange: setPat, placeholder: 'PAT mit Code (Read) + Work Items (Read)', type: 'password' },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, color: '#8b949e', marginBottom: '.35rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label}</label>
            <input
              type={f.type}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              autoComplete="off"
              style={{ width: '100%', background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 6, color: 'var(--az-text)', fontSize: '.95rem', padding: '.6rem .8rem' }}
            />
          </div>
        ))}

        {error && <div style={{ background: 'rgba(248,81,73,.15)', border: '1px solid rgba(248,81,73,.4)', color: '#f85149', padding: '.75rem 1rem', borderRadius: 6, fontSize: '.9rem', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--az-accent)', color: 'var(--az-accent-on)', border: 'none', borderRadius: 6, padding: '.65rem 1.4rem', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Speichere…' : 'Verbinden'}
          </button>
          {showCancel && <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--az-border)', color: '#8b949e', borderRadius: 6, padding: '.65rem 1.4rem', fontSize: '.95rem', cursor: 'pointer' }}>Abbrechen</button>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AzureRankingPage() {
  const [days, setDays]               = useState<number>(30)
  const [category, setCategory]       = useState<CategoryKey>('points')
  const [data, setData]               = useState<PeriodData | null>(null)
  const [search, setSearch]           = useState('')
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [showSetup, setShowSetup]     = useState(false)
  const [detailDev, setDetailDev]     = useState<DevStats | null>(null)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null)
  // stable ref to always-current loadStats, so boot effect doesn't re-run on days change
  const loadStatsRef                  = useRef<(d?: number) => Promise<void>>(async () => {})

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const loadStats = useCallback(async (d?: number) => {
    const period = d ?? days
    setLoadError(null)
    try {
      const result = await apiFetch<PeriodData>(`/api/azure-ranking/stats?days=${period}`)
      setData(result)
    } catch (e: unknown) {
      const err = e as { noCache?: boolean; message: string }
      if (!err.noCache) setLoadError(err.message)
    }
  }, [days])

  // Keep ref current on every render
  loadStatsRef.current = loadStats

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiFetch<CacheStatus>('/api/azure-ranking/cache/status')
        setCacheStatus(status)
        if (!status.loading) {
          stopPolling()
          if (status.hasData && !status.error) await loadStatsRef.current()
        }
      } catch { stopPolling() }
    }, 2500)
  }, [stopPolling])

  const triggerLoad = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await apiFetch<{ started: boolean }>('/api/azure-ranking/cache/refresh', { method: 'POST' })
      if (res.started) {
        setCacheStatus((s) => s ? { ...s, loading: true } : null)
        startPolling()
      }
    } catch (e: unknown) { setLoadError((e as Error).message) }
  }, [startPolling])

  // Boot — runs exactly once on mount, uses ref to access current loadStats
  useEffect(() => {
    ;(async () => {
      try {
        const [cfg, cache] = await Promise.all([
          apiFetch<ConfigStatus>('/api/azure-ranking/config/status'),
          apiFetch<CacheStatus>('/api/azure-ranking/cache/status'),
        ])
        setConfigStatus(cfg)
        setCacheStatus(cache)

        if (!cfg.configured) { setShowSetup(true); return }
        if (cache.loading) { startPolling(); return }
        if (cache.hasData) await loadStatsRef.current()
      } catch (e: unknown) { setLoadError('Server nicht erreichbar: ' + (e as Error).message) }
    })()
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally only on mount

  // Reload when days tab changes (after initial data has loaded)
  useEffect(() => {
    if (data) loadStatsRef.current(days)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const displayedDevs = (() => {
    if (!data) return []
    let devs = sortedDevs(data.developers, category)
    const q  = search.trim().toLowerCase()
    if (q) devs = devs.filter((d) => d.displayName.toLowerCase().includes(q) || d.uniqueName.toLowerCase().includes(q))
    return devs.map((d, i) => ({ ...d, catRank: i + 1 }))
  })()

  const medals = ['🥇', '🥈', '🥉']
  const catMeta = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0]

  // Status bar text
  const statusBarContent = (() => {
    if (!cacheStatus) return null
    if (cacheStatus.loading) {
      const msg = cacheStatus.progress?.message || 'Lädt…'
      const rep = cacheStatus.progress?.repo ? ` (${cacheStatus.progress.repo})` : ''
      const pct = cacheStatus.progress?.total > 0 ? ` ${cacheStatus.progress.done}/${cacheStatus.progress.total}` : ''
      return { dot: 'loading', text: `${msg}${rep}${pct}` }
    }
    if (cacheStatus.error) return { dot: 'error', text: 'Fehler beim Laden' }
    if (cacheStatus.hasData && cacheStatus.lastLoaded) {
      const ts = new Date(cacheStatus.lastLoaded).toLocaleString('de-DE')
      return { dot: 'ok', text: `Stand: ${ts} · ${cacheStatus.devCount} Entwickler` }
    }
    return { dot: 'none', text: 'Kein Cache – bitte Daten laden' }
  })()

  const dotColor: Record<string, string> = { ok: '#3fb950', loading: '#d29922', error: '#f85149', none: '#484f58' }

  return (
    <div style={{ background: 'var(--az-bg)', minHeight: '100vh', color: 'var(--az-text)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* Setup Modal */}
      {showSetup && (
        <SetupModal
          showCancel={!!data}
          onClose={() => setShowSetup(false)}
          onSaved={(org, project) => {
            setConfigStatus({ configured: true, organization: org, project })
            setShowSetup(false)
            triggerLoad()
          }}
        />
      )}

      {/* Detail Modal */}
      {detailDev && (
        <DevModal dev={detailDev} scoring={data?.scoring || {}} onClose={() => setDetailDev(null)} />
      )}

      {/* Header */}
      <header style={{ background: 'var(--az-surface)', borderBottom: '1px solid var(--az-border)', padding: '.9rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
          <span style={{ fontSize: '2rem' }}>🏆</span>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>DevOps Champions</div>
            {configStatus?.organization && (
              <span style={{ fontSize: '.75rem', background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 20, padding: '.15rem .6rem', color: 'var(--az-accent)', display: 'inline-block', marginTop: '.15rem' }}>
                {configStatus.organization} / {configStatus.project}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
          {/* Status bar */}
          {statusBarContent && (
            <div style={{ fontSize: '.8rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '.4rem', maxWidth: 420 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: dotColor[statusBarContent.dot] || '#484f58',
                animation: statusBarContent.dot === 'loading' ? 'az-pulse .9s ease-in-out infinite' : undefined,
              }} />
              <span>{statusBarContent.text}</span>
            </div>
          )}

          {/* Time tabs */}
          <div style={{ display: 'flex', gap: '.25rem', background: 'var(--az-surface2)', borderRadius: 8, padding: 3, border: '1px solid var(--az-border)' }}>
            {[7, 30, 90, 365].map((d) => (
              <button key={d} onClick={() => setDays(d)} style={{
                background: days === d ? 'var(--az-accent)' : 'none',
                border: 'none', color: days === d ? 'var(--az-accent-on)' : '#8b949e',
                padding: '.35rem .7rem', borderRadius: 6, cursor: 'pointer',
                fontSize: '.82rem', fontWeight: days === d ? 600 : 400, whiteSpace: 'nowrap',
              }}>
                {d === 365 ? '1 Jahr' : `${d} Tage`}
              </button>
            ))}
          </div>

          {/* Load button */}
          <button onClick={triggerLoad} disabled={cacheStatus?.loading} style={{
            background: 'var(--az-green)', color: 'var(--az-green-on)', border: 'none', borderRadius: 8,
            padding: '.4rem .9rem', fontSize: '.88rem', fontWeight: 600, cursor: cacheStatus?.loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '.35rem', opacity: cacheStatus?.loading ? .5 : 1, whiteSpace: 'nowrap',
          }}>
            {cacheStatus?.loading ? '⏳ Lädt…' : (cacheStatus?.hasData ? '🔄 Aktualisieren' : '⬇️ Daten laden')}
          </button>

          {/* Settings */}
          <button onClick={() => setShowSetup(true)} title="Einstellungen" style={{ background: 'var(--az-surface2)', border: '1px solid var(--az-border)', borderRadius: 8, width: 38, height: 38, fontSize: '1rem', cursor: 'pointer', color: 'var(--az-text)' }}>⚙️</button>
        </div>
      </header>

      {/* Error Banner */}
      {loadError && (
        <div style={{ background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.35)', borderRadius: 10, color: '#f85149', padding: '.75rem 1rem', margin: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{loadError}</span>
          <button onClick={() => setLoadError(null)} style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {/* Overview Tiles */}
      {data && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', padding: '1.5rem' }}>
          {[
            { icon: '🔀', val: data.totals.prs,            label: 'Pull Requests' },
            { icon: '💻', val: data.totals.commits,         label: 'Commits' },
            { icon: '✅', val: data.totals.workItems,       label: 'Tickets erledigt' },
            { icon: '📝', val: data.totals.ticketsCreated,  label: 'Tickets erstellt' },
            { icon: '💬', val: data.totals.comments,        label: 'PR-Kommentare' },
            { icon: '🗒️', val: data.totals.ticketComments,  label: 'Ticket-Kommentare' },
            { icon: '👥', val: data.developers.length,      label: 'Entwickler' },
          ].map((t) => (
            <div key={t.label} style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 10, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '.4rem' }}>{t.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--az-accent)' }}>{fmt(t.val)}</div>
              <div style={{ fontSize: '.8rem', color: '#8b949e', marginTop: '.2rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t.label}</div>
            </div>
          ))}
        </section>
      )}

      {/* Podium */}
      {data && displayedDevs.length > 0 && (
        <section style={{ padding: '0 1.5rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {category === 'points' ? '🥇 Top Champions' : `${catMeta.label} – Top 3`}
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
            {displayedDevs.slice(0, 3).map((dev, idx) => {
              const isFirst = idx === 0
              const borderColors = ['#FFD700', '#C0C0C0', '#CD7F32']
              return (
                <div key={dev.id} onClick={() => setDetailDev(dev)} style={{
                  background: 'var(--az-surface)',
                  border: `1px solid ${borderColors[idx]}`,
                  borderRadius: 10, padding: isFirst ? '2rem 1.25rem 1.5rem' : '1.5rem 1.25rem',
                  textAlign: 'center', flex: 1, maxWidth: isFirst ? 340 : 320, cursor: 'pointer',
                  boxShadow: isFirst ? `0 0 24px rgba(255,215,0,.2)` : undefined,
                  order: idx === 0 ? 2 : idx === 1 ? 1 : 3,
                }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '.5rem' }}>{medals[idx]}</span>
                  <div style={{ width: isFirst ? 80 : 64, height: isFirst ? 80 : 64, borderRadius: '50%', background: avatarColor(dev.displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isFirst ? '1.8rem' : '1.5rem', fontWeight: 700, margin: '0 auto .75rem', border: `3px solid ${borderColors[idx]}`, color: '#fff' }}>
                    {initials(dev.displayName) || '?'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: isFirst ? '1.15rem' : '1rem', marginBottom: '.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--az-text)' }}>{dev.displayName}</div>
                  <LevelBadge level={dev.level} style={{ marginBottom: '.75rem' }} />
                  <div style={{ fontSize: isFirst ? '2rem' : '1.6rem', fontWeight: 700, color: borderColors[idx] }}>{fmt(dev[catMeta.field as keyof DevStats] as number)}</div>
                  <div style={{ fontSize: '.75rem', color: '#8b949e' }}>{category === 'points' ? 'Punkte' : catMeta.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '.9rem', paddingTop: '.75rem', borderTop: '1px solid var(--az-border)', fontSize: '.8rem', color: '#8b949e' }}>
                    {[['PRs', dev.prsCreated], ['Commits', dev.commits], ['Erledigt', dev.workItemsCompleted], ['Erstellt', dev.ticketsCreated]].map(([lbl, val]) => (
                      <div key={String(lbl)} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: 'var(--az-text)', fontSize: '.95rem' }}>{fmt(Number(val))}</div>
                        <div style={{ fontSize: '.7rem' }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  {dev.badges.length > 0 && (
                    <div style={{ marginTop: '.75rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '.25rem' }}>
                      {dev.badges.slice(0, 6).map((b) => (
                        <span key={b.id} title={`${b.name}: ${b.desc}`} style={{ fontSize: '.9rem', cursor: 'default' }}>{b.icon}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Rankings */}
      <section style={{ padding: '0 1.5rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.08em' }}>📊 Ranking</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Entwickler suchen…"
            style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 8, color: 'var(--az-text)', fontSize: '.9rem', padding: '.5rem .9rem', width: 220 }}
          />
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '1rem' }}>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => { setCategory(c.key); setSearch('') }} style={{
              background: category === c.key ? 'var(--az-accent)' : 'var(--az-surface2)',
              border: `1px solid ${category === c.key ? 'var(--az-accent)' : 'var(--az-border)'}`,
              color: category === c.key ? 'var(--az-accent-on)' : '#8b949e',
              borderRadius: 20, padding: '.3rem .75rem', fontSize: '.8rem',
              cursor: 'pointer', fontWeight: category === c.key ? 600 : 400, whiteSpace: 'nowrap',
            }}>
              {c.label}
            </button>
          ))}
        </div>

        {!data && !cacheStatus?.loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8b949e' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
            <p style={{ fontSize: '1rem', marginBottom: '.5rem' }}>Keine Daten vorhanden</p>
            <p style={{ fontSize: '.85rem' }}>Konfiguriere Azure DevOps und lade die Daten.</p>
          </div>
        )}

        {cacheStatus?.loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#8b949e' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.75rem', animation: 'az-spin .8s linear infinite', display: 'inline-block' }}>⏳</div>
            <p>{cacheStatus.progress?.message || 'Daten werden geladen…'}</p>
            {cacheStatus.progress?.repo && <p style={{ fontSize: '.85rem', marginTop: '.25rem' }}>Repo: {cacheStatus.progress.repo}</p>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {displayedDevs.map((dev, idx) => {
            const displayRank = idx + 1
            const pct         = progressPercent(dev)
            const catVal      = dev[catMeta.field as keyof DevStats] as number
            const borderLeft  = displayRank <= 3 ? `3px solid ${['#FFD700','#C0C0C0','#CD7F32'][displayRank - 1]}` : undefined

            return (
              <div key={dev.id} onClick={() => setDetailDev(dev)} style={{
                background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 10,
                padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '52px 1fr auto',
                gap: '1rem', alignItems: 'center', cursor: 'pointer', borderLeft,
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', color: '#8b949e', minWidth: 44 }}>
                  {displayRank <= 3 ? medals[displayRank - 1] : displayRank}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem', minWidth: 0 }}>
                  <DevAvatar name={dev.displayName} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--az-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dev.displayName}</div>
                    <div style={{ fontSize: '.75rem', color: '#8b949e' }}>{dev.uniqueName}</div>
                    <LevelBadge level={dev.level} style={{ marginTop: '.25rem' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.5rem', minWidth: 200 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--az-accent)' }}>{fmt(catVal)}</div>
                    <div style={{ fontSize: '.7rem', color: '#8b949e' }}>{category === 'points' ? 'Punkte' : catMeta.label}</div>
                    {category !== 'points' && <div style={{ fontSize: '.7rem', color: '#8b949e' }}>{fmt(dev.points)} Pkt. gesamt</div>}
                  </div>

                  <div style={{ width: '100%', height: 5, background: 'var(--az-surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: dev.level.color, borderRadius: 3, transition: 'width .5s ease' }} />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '.78rem', color: '#8b949e' }}>
                    {[
                      { key: 'prsCreated',        label: 'PRs',        val: dev.prsCreated },
                      { key: 'prsCompleted',       label: 'Merged',     val: dev.prsCompleted },
                      { key: 'commits',            label: 'Commits',    val: dev.commits },
                      { key: 'workItemsCompleted', label: 'Erledigt',   val: dev.workItemsCompleted },
                      { key: 'ticketsCreated',     label: 'Erstellt',   val: dev.ticketsCreated },
                      { key: 'commentsGiven',      label: 'PR-Reviews', val: dev.commentsGiven },
                    ].map((stat) => (
                      <div key={stat.key} style={{ textAlign: 'center', color: stat.key === category ? 'var(--az-accent)' : undefined, fontWeight: stat.key === category ? 700 : undefined }}>
                        <div style={{ fontWeight: stat.key === category ? 700 : 600, color: stat.key === category ? 'var(--az-accent)' : 'var(--az-text)', fontSize: '.9rem' }}>{fmt(stat.val)}</div>
                        <div>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {dev.badges.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', justifyContent: 'flex-end', maxWidth: 200 }}>
                      {dev.badges.map((b) => (
                        <span key={b.id} title={`${b.name}: ${b.desc}`} style={{ fontSize: '.9rem', cursor: 'default' }}>{b.icon}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {data && displayedDevs.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: '#8b949e' }}>Keine Entwickler gefunden.</p>}
        </div>
      </section>

      {/* Scoring Info */}
      {data && (
        <section style={{ padding: '0 1.5rem 2rem' }}>
          <details>
            <summary style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 10, padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none', fontSize: '1.1rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.08em', listStyle: 'none' }}>
              🎮 Punkte-System &amp; Level
            </summary>
            <div style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderTop: 'none', borderRadius: '0 0 10px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.5rem', padding: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '.85rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Punkte pro Aktion</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', fontSize: '.75rem', color: '#8b949e', textTransform: 'uppercase', paddingBottom: '.5rem', borderBottom: '1px solid var(--az-border)' }}>Aktion</th>
                    <th style={{ textAlign: 'left', fontSize: '.75rem', color: '#8b949e', textTransform: 'uppercase', paddingBottom: '.5rem', borderBottom: '1px solid var(--az-border)' }}>Punkte</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ['🔀 PR erstellt', data.scoring.prCreated],
                      ['✅ PR gemergt', data.scoring.prCompleted],
                      ['💬 Review-Kommentar (PR)', data.scoring.prComment],
                      ['👍 PR genehmigt', data.scoring.prApproved],
                      ['⛔ PR abgelehnt', data.scoring.prRejected],
                      ['💻 Commit', data.scoring.commit],
                      ['📋 Ticket abgeschlossen', data.scoring.workItemCompleted],
                      ['📝 Ticket erstellt', data.scoring.ticketCreated],
                      ['🗒️ Ticket-Kommentar', data.scoring.ticketComment],
                    ].map(([label, pts]) => (
                      <tr key={String(label)}>
                        <td style={{ padding: '.45rem 0', borderBottom: '1px solid var(--az-border)', color: 'var(--az-text)' }}>{label}</td>
                        <td style={{ padding: '.45rem 0', borderBottom: '1px solid var(--az-border)', fontWeight: 700, color: '#3fb950' }}>+{pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 style={{ fontSize: '.85rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Level-Schwellen</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {data.levels.map((l) => (
                    <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', background: 'var(--az-surface2)', borderRadius: 6, padding: '.6rem .9rem', fontSize: '.9rem' }}>
                      <span>{l.icon}</span>
                      <strong style={{ color: l.color }}>{l.name}</strong>
                      <span style={{ marginLeft: 'auto', color: '#8b949e', fontSize: '.85rem' }}>
                        {fmt(l.min)}{l.max !== null ? ` – ${fmt(l.max)}` : '+'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </section>
      )}

      {/* Footer */}
      {data && (
        <footer style={{ textAlign: 'center', padding: '1.25rem', color: '#484f58', fontSize: '.8rem', borderTop: '1px solid var(--az-border)' }}>
          Zeitraum: {new Date(data.fromDate).toLocaleDateString('de-DE')} – {new Date(data.toDate).toLocaleDateString('de-DE')} ({data.days} Tage)
        </footer>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes az-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes az-spin   { to { transform: rotate(360deg) } }
        details summary::-webkit-details-marker { display: none; }
      `}</style>

    </div>
  )
}
