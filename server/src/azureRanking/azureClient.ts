import axios, { type AxiosError } from 'axios'
import type { AzureConfig } from './types'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Minimal Azure DevOps REST client.
 * IMPORTANT: read-only by design — it only exposes GET. The ranking never sends
 * data-changing requests to Azure DevOps.
 */
export class AzureClient {
  private http = axios.create({ timeout: 60_000 })
  requests = 0

  constructor(private readonly cfg: AzureConfig) {}

  get base(): string {
    return `https://dev.azure.com/${encodeURIComponent(this.cfg.organization)}/${encodeURIComponent(this.cfg.project)}`
  }

  private get auth(): string {
    return `Basic ${Buffer.from(`:${this.cfg.pat}`).toString('base64')}`
  }

  async get<T = unknown>(url: string): Promise<T> {
    const maxAttempts = 6
    for (let attempt = 1; ; attempt++) {
      try {
        this.requests++
        const res = await this.http.get<T>(url, { headers: { Authorization: this.auth, Accept: 'application/json' } })
        // An invalid/expired PAT yields "203 Non-Authoritative" with an HTML sign-in page instead of JSON
        if (res.status === 203 || typeof res.data === 'string') {
          throw Object.assign(new Error('Authentication failed. Please check the PAT token.'), { response: { status: 401 } })
        }
        return res.data
      } catch (err) {
        const e = err as AxiosError
        const status = e.response?.status
        if (status === 401) throw err
        const retryable = !status || status === 429 || status >= 500
        if (!retryable || attempt >= maxAttempts) throw err
        const retryAfter = Number(e.response?.headers?.['retry-after'])
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30_000, 500 * 2 ** attempt)
        await sleep(wait)
      }
    }
  }
}

/** Runs `fn` for all items with at most `limit` promises in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
