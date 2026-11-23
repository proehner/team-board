import type { IdentityInfo } from './types'

/** Azure identity as returned by the Git REST API */
export interface AzureIdentity {
  uniqueName?:  string
  id?:          string
  displayName?: string
  isContainer?: boolean
}

const BOT_NAME = /(build service|project collection|microsoft\.visualstudio|azure pipelines|azure devops|github copilot|copilot|dependabot|renovate|\[bot\]|\bbot\b|service account|tfs service)/i
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBotIdentity(name: string, unique: string, isContainer = false): boolean {
  if (isContainer) return true
  if (BOT_NAME.test(name)) return true
  // Real users always have an e-mail style unique name in Azure DevOps Services
  if (!unique.includes('@')) return true
  if (GUID.test(unique.split('@')[0])) return true
  return false
}

/** Parses the identity string of the reporting API: "Display Name <mail@domain>" */
export function parseIdentityString(s: unknown): { name: string; unique: string } | null {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(.*?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || m[2], unique: m[2].trim() }
  return { name: s.trim(), unique: s.trim() }
}

/** Registry that maps every Azure identity to a stable, lower-case key. */
export class IdentityRegistry {
  constructor(public readonly map: Record<string, IdentityInfo>) {}

  register(name: string | undefined, unique: string | undefined, isContainer = false): string | null {
    const u = (unique || '').trim()
    if (!u) return null
    const key = u.toLowerCase()
    const display = (name || u).trim()
    const bot = isBotIdentity(display, u, isContainer)
    const prev = this.map[key]
    this.map[key] = { n: display || prev?.n || key, e: key, ...(bot || prev?.bot ? { bot: true } : {}) }
    return key
  }

  fromAzure(identity?: AzureIdentity | null): string | null {
    if (!identity) return null
    return this.register(identity.displayName, identity.uniqueName || identity.id, !!identity.isContainer)
  }

  fromString(s: unknown): string | null {
    const p = parseIdentityString(s)
    return p ? this.register(p.name, p.unique) : null
  }
}

const normName = (n: string) => n.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Human accounts with exactly the same display name are treated as one person
 * (e.g. the same developer with a second e-mail domain). Returns alias → canonical key.
 */
export function buildAliasMap(identities: Record<string, IdentityInfo>, activity: Map<string, number>): Map<string, string> {
  const byName = new Map<string, string[]>()
  for (const [key, info] of Object.entries(identities)) {
    if (info.bot) continue
    const n = normName(info.n)
    if (!n) continue
    byName.set(n, [...(byName.get(n) || []), key])
  }
  const alias = new Map<string, string>()
  for (const keys of byName.values()) {
    if (keys.length < 2) continue
    const canonical = [...keys].sort((a, b) => (activity.get(b) || 0) - (activity.get(a) || 0) || a.localeCompare(b))[0]
    for (const k of keys) if (k !== canonical) alias.set(k, canonical)
  }
  return alias
}
