// ─── Shared types of the Azure DevOps ranking ─────────────────────────────────

export interface AzureConfig {
  organization: string
  project:      string
  pat:          string
}

/**
 * Normalised activity events. Everything the ranking shows is derived from these,
 * which makes the evaluation reproducible for any point in time (history!).
 */
export type EventKind =
  | 'prCreated'    // PR opened                        (u = author,   ref = PR id)
  | 'prCompleted'  // PR merged / completed            (u = author,   ref = PR id)
  | 'prReviewed'   // first review activity on a PR    (u = reviewer, ref = PR id)
  | 'prApproved'   // first approval (vote 10 or 5)    (u = reviewer, ref = PR id)
  | 'prComment'    // review comment on someone else's PR (u = reviewer, ref = PR id, x = 's'|'r' + text length:
                   //   s = starts a new thread (finding), r = reply in a thread — e.g. "s302")
  | 'prPorted'     // derived, never stored: completed backport of an earlier PR (u = author, ref = PR id)
  | 'wiCompleted'  // work item moved into a "Completed" state (u = assignee at that time, ref = WI id, x = type)
  | 'wiCreated'    // work item created                (u = creator,  ref = WI id, x = type)
  | 'wiComment'    // discussion comment on a work item (u = author,  ref = WI id)

/** Compact on-disk representation: [kind, userKey, timestampMs, ref, extra?] */
export type StoredEvent = [EventKind, string, number, string, string?]

export interface Ev {
  k:   EventKind
  u:   string
  t:   number
  ref: string
  x?:  string
}

export interface IdentityInfo {
  /** Display name as last seen in Azure DevOps */
  n: string
  /** Lower-case e-mail / unique name */
  e: string
  /** Service account, bot or group — excluded from the ranking */
  bot?: boolean
}

export interface PrRecord {
  /** status: active | completed | abandoned */
  s: string
  /** closed date (ISO) */
  c?: string
  /** threads fetched at (ms) — 0 = never */
  f: number
  repo: string
  /** short hash of the normalised PR title (backport detection) */
  t?: string
  /** target branch without refs/heads/ */
  b?: string
  e: StoredEvent[]
}

export interface EventStore {
  version:   number
  /** Earliest point in time covered by the stored events (ISO) */
  storeStart: string
  /** Continuation token of the work item revision stream (incremental loading) */
  revisionsToken: string | null
  lastRunAt: string | null
  identities: Record<string, IdentityInfo>
  /** Set when the store was migrated from an older format: data is complete only after the next refresh */
  needsRefresh?: boolean
  /** Work item events keyed by a stable event id (dedupe) */
  wi: Record<string, StoredEvent>
  /** Pull requests keyed by PR id */
  prs: Record<string, PrRecord>
}

export interface Badge { id: string; name: string; icon: string; desc: string }
export interface Level { name: string; icon: string; color: string; min: number; next: number | null }

export interface DevStats {
  id:           string
  displayName:  string
  uniqueName:   string
  repositories: string[]
  // Pull requests
  prsCreated:      number
  prsCompleted:    number
  prsReviewed:     number
  approvalsGiven:  number
  /** Backports: completed PRs that repeat an earlier PR of the same author in another branch */
  prsPorted:       number
  /** New review threads (findings) counted for points (min. length, max. N per PR) */
  commentsGiven:   number
  commentsGivenRaw: number
  /** Replies in review discussions counted for points (min. length, max. N per PR) */
  commentReplies:    number
  commentRepliesRaw: number
  // Work items
  workItemsCompleted:    number
  backlogItemsCompleted: number
  tasksCompleted:        number
  /** Tickets created that count (max. N per day) */
  ticketsCreated:     number
  ticketsCreatedRaw:  number
  tasksCreated:       number
  tasksCreatedRaw:    number
  /** Ticket discussion: counted once per ticket and day */
  ticketComments:     number
  ticketCommentsRaw:  number
  // Result
  points:          number
  pointsByMetric:  Record<string, number>
  /** Weeks with counted activity (the period is split into round(days / 7) weeks) */
  activeWeeks:     number
  pointsPerWeek:   number
  badges: Badge[]
  level:  Level
  rank:   number
}

export interface PeriodData {
  developers: DevStats[]
  totals: {
    prs:            number
    prsCompleted:   number
    ports:          number
    reviews:        number
    approvals:      number
    workItems:      number
    /** all review comments incl. replies and uncounted ones */
    comments:       number
    ticketsCreated: number
    tasksCreated:   number
    ticketComments: number
  }
  fromDate: string
  toDate:   string
  days:     number
  scoring:  Record<string, number>
  limits:   Record<string, number>
  scoringVersion: number
  levels:   Array<{ name: string; icon: string; color: string; min: number; max: number | null }>
}

export interface Progress {
  step:    string
  message: string
  repo:    string
  done:    number
  total:   number
}
