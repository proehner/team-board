import { Document, Page, Svg, Rect, Line, G, Text as SvgText, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { TFunction } from 'i18next'
import type { ReportArea, ReportContext, ReportData, MetricStat } from '../types'
import { REPORT_AREAS } from '../types'
import { formatDuration, formatNumber } from '../findings'

// ─── Annual report (PDF) ──────────────────────────────────────────────────────
// Pure document component: all texts via `t`, no app imports — renders in the browser
// (render.ts) and in Node (for tests).

const C = {
  ink: '#0f172a', text: '#334155', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', fill: '#f8fafc',
  accent: '#4f46e5', accentSoft: '#eef2ff', green: '#059669',
}
export const AREA_COLORS: Record<ReportArea, string> = { code: '#6366f1', review: '#0ea5e9', work: '#10b981', tickets: '#f59e0b' }

const FIELDS: { field: string; tKey: string; area: ReportArea }[] = [
  { field: 'prsCreated',            tKey: 'prsCreated',        area: 'code' },
  { field: 'prsCompleted',          tKey: 'prsMerged',         area: 'code' },
  { field: 'prsPorted',             tKey: 'prsPorted',         area: 'code' },
  { field: 'prsReviewed',           tKey: 'prsReviewed',       area: 'review' },
  { field: 'approvalsGiven',        tKey: 'prApprovals',       area: 'review' },
  { field: 'commentsGiven',         tKey: 'reviewComments',    area: 'review' },
  { field: 'commentReplies',        tKey: 'reviewReplies',     area: 'review' },
  { field: 'backlogItemsCompleted', tKey: 'backlogItemsDone',  area: 'work' },
  { field: 'tasksCompleted',        tKey: 'tasksDone',         area: 'work' },
  { field: 'ticketsCreated',        tKey: 'ticketsCreated',    area: 'tickets' },
  { field: 'tasksCreated',          tKey: 'tasksCreatedFull',  area: 'tickets' },
  { field: 'ticketComments',        tKey: 'ticketDiscussions', area: 'tickets' },
]

function makeStyles(font: string[]) {
  return StyleSheet.create({
    // No lineHeight on the page: react-pdf then drops fixed elements (footer) — set it per text style instead
    page:      { fontFamily: font, fontSize: 9, color: C.text, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 42 },
    para:      { fontSize: 9, lineHeight: 1.4 },
    eyebrow:   { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, color: C.accent, textTransform: 'uppercase' },
    name:      { fontSize: 21, fontWeight: 700, color: C.ink, marginTop: 5, lineHeight: 1.2 },
    sub:       { fontSize: 9, color: C.muted, marginTop: 4 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line },
    meta:      { fontSize: 7.5, color: C.muted, textAlign: 'right' },
    h2:        { fontSize: 11, fontWeight: 600, color: C.ink, marginTop: 20, marginBottom: 8, lineHeight: 1.3 },
    h3:        { fontSize: 8, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 4 },
    small:     { fontSize: 7.5, color: C.muted, lineHeight: 1.4 },
    row:       { flexDirection: 'row' },
    tile:      { flex: 1, backgroundColor: C.fill, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 0.6, borderColor: C.line },
    tileValue: { fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.2 },
    tileLabel: { fontSize: 7.5, color: C.muted, marginTop: 2 },
    tileSub:   { fontSize: 7, color: C.faint, marginTop: 3 },
    th:        { fontSize: 7, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    tr:        { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.6, borderBottomColor: C.line, alignItems: 'center' },
    groupRow:  { flexDirection: 'row', paddingTop: 7, paddingBottom: 2 },
    groupText: { fontSize: 7.5, fontWeight: 600, color: C.ink },
    num:       { textAlign: 'right', fontVariant: ['tabular-nums'] as never },
    bullet:    { flexDirection: 'row', marginBottom: 5 },
    dot:       { width: 5, height: 5, borderRadius: 2.5, marginTop: 4, marginRight: 7 },
    footer:    { position: 'absolute', bottom: 26, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 6, fontSize: 7, color: C.faint },
    box:       { backgroundColor: C.fill, borderRadius: 5, padding: 10, borderWidth: 0.6, borderColor: C.line },
  })
}
type Styles = ReturnType<typeof makeStyles>

/** `font`: family plus fallbacks, e.g. ['Inter', 'InterExt'] for names with ć, ş, ł … */
interface Props { ctx: ReportContext; t: TFunction; locale: string; font: string[] }

export default function AnnualReportPdf({ ctx, t, locale, font }: Props) {
  const s = makeStyles(font)
  const { data: r, options } = ctx
  const n = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '–' : formatNumber(v, locale, digits))
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const periodText = `${day(r.period.fromDate)} – ${day(r.period.toDate)}`
  const title = r.period.kind === 'year' ? t('azureReport.pdf.titleYear', { year: r.period.year }) : t('azureReport.pdf.title')
  const strengths = ctx.findings.filter((f) => f.kind === 'strength')
  const growth    = ctx.findings.filter((f) => f.kind === 'growth')

  return (
    <Document title={`${title} – ${r.dev.displayName}`} author="Team Board" creator="Team Board" producer="Team Board" language={locale}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.eyebrow}>{title}</Text>
            <Text style={s.name}>{r.dev.displayName}</Text>
            <Text style={s.sub}>{r.dev.uniqueName}  ·  {t('azureReport.pdf.period')}: {periodText}</Text>
          </View>
          <View>
            <Text style={s.meta}>{t('azureReport.pdf.dataAsOf', { date: day(r.dataAsOf) })}</Text>
            <Text style={s.meta}>{t('azureReport.pdf.createdAt', { date: ctx.createdAt.toLocaleDateString(locale) })}</Text>
          </View>
        </View>

        <Overview r={r} s={s} t={t} n={n} />
        <Areas r={r} s={s} t={t} locale={locale} />
        <MonthlyChart r={r} s={s} t={t} locale={locale} font={font[0]} />
        <DetailTable r={r} s={s} t={t} n={n} />
        <WorkStyle r={r} s={s} t={t} n={n} locale={locale} />
        {options.collaboration && <Collaboration r={r} s={s} t={t} n={n} />}

        {options.findings && (strengths.length > 0 || growth.length > 0) && (
          <View>
            {strengths.length > 0 && (
              <View wrap={false}>
                <Text style={s.h2} minPresenceAhead={60}>{t('azureReport.pdf.strengths')}</Text>
                {strengths.map((f) => <Bullet key={f.id} s={s} color={C.green} text={f.text} />)}
              </View>
            )}
            {growth.length > 0 && (
              <View wrap={false}>
                <Text style={s.h2} minPresenceAhead={60}>{t('azureReport.pdf.recommendations')}</Text>
                {growth.map((f) => <Bullet key={f.id} s={s} color={C.accent} text={f.text} />)}
              </View>
            )}
          </View>
        )}

        {options.competencies && ctx.competencies && <Competencies ctx={ctx} s={s} t={t} n={n} locale={locale} />}

        {options.notes.trim() ? (
          <View wrap={false}>
            <Text style={s.h2}>{t('azureReport.pdf.notes')}</Text>
            <View style={s.box}><Text style={s.para}>{options.notes.trim()}</Text></View>
          </View>
        ) : null}

        {/* Data basis */}
        <View wrap={false}>
          <Text style={s.h2}>{t('azureReport.pdf.basisTitle')}</Text>
          <Text style={[s.small, { marginBottom: 3 }]}>{t('azureReport.pdf.basisSource', { source: ctx.source })}</Text>
          <Text style={[s.small, { marginBottom: 3 }]}>{t('azureReport.pdf.basisGroup', { count: r.groupSize })}</Text>
          <Text style={[s.small, { marginBottom: 3 }]}>{t('azureReport.pdf.basisScope')}</Text>
          {options.competencies && ctx.competencies && (
            <Text style={s.small}>{t('azureReport.pdf.basisCompetencies')}</Text>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>{r.dev.displayName}  ·  {title}  ·  {periodText}</Text>
          <Text render={({ pageNumber, totalPages }) => t('azureReport.pdf.page', { page: pageNumber, total: totalPages })} />
        </View>
      </Page>
    </Document>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

type N = (v: number | null | undefined, digits?: number) => string

function Bullet({ s, color, text }: { s: Styles; color: string; text: string }) {
  return (
    <View style={s.bullet} wrap={false}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.para, { flex: 1 }]}>{text}</Text>
    </View>
  )
}

function Tile({ s, value, label, sub }: { s: Styles; value: string; label: string; sub?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </View>
  )
}

function Overview({ r, s, t, n }: { r: ReportData; s: Styles; t: TFunction; n: N }) {
  const d = r.dev
  const gap = <View style={{ width: 8 }} />
  return (
    <View wrap={false}>
      <Text style={s.h2}>{t('azureReport.pdf.overview')}</Text>
      <View style={s.row}>
        <Tile s={s} value={n(d.points)} label={t('azureReport.pdf.kpiPoints')} sub={t('azureReport.pdf.kpiRank', { rank: r.rank, total: r.rankedCount })} />
        {gap}
        <Tile s={s} value={n(d.pointsPerWeek)} label={t('azureReport.pdf.kpiPerWeek')} sub={t('azureReport.pdf.groupMedian', { value: n(r.metrics.pointsPerWeek?.median) })} />
        {gap}
        <Tile s={s} value={t('azureReport.pdf.weeksOf', { active: d.activeWeeks, weeks: r.period.weeks })} label={t('azureReport.pdf.kpiActiveWeeks')} />
      </View>
      <View style={[s.row, { marginTop: 8 }]}>
        <Tile s={s} value={n(d.prsCompleted)} label={t('azureReport.pdf.kpiMerged')}
          sub={d.prsPorted > 0 ? t('azureReport.pdf.kpiPorts', { n: n(d.prsPorted) }) : t('azureReport.pdf.kpiCreated', { n: n(d.prsCreated) })} />
        {gap}
        <Tile s={s} value={n(d.prsReviewed)} label={t('azureReport.pdf.kpiReviewed')} sub={t('azureReport.pdf.kpiFindings', { n: n(d.commentsGiven) })} />
        {gap}
        <Tile s={s} value={n(d.workItemsCompleted)} label={t('azureReport.pdf.kpiWorkItems')}
          sub={t('azureReport.pdf.kpiWorkItemsSplit', { backlog: n(d.backlogItemsCompleted), tasks: n(d.tasksCompleted) })} />
      </View>
    </View>
  )
}

function StackedBar({ shares, s }: { shares: Record<ReportArea, number>; s: Styles }) {
  const total = REPORT_AREAS.reduce((sum, a) => sum + shares[a], 0) || 1
  return (
    <View style={[s.row, { flex: 1, height: 15, borderRadius: 3, overflow: 'hidden', backgroundColor: C.line }]}>
      {REPORT_AREAS.map((a) => {
        const pct = (shares[a] / total) * 100
        if (pct <= 0) return null
        return (
          <View key={a} style={{ width: `${pct}%`, backgroundColor: AREA_COLORS[a], justifyContent: 'center', alignItems: 'center' }}>
            {pct >= 7 ? <Text style={{ fontSize: 6.5, color: '#ffffff', fontWeight: 600 }}>{Math.round(pct)} %</Text> : null}
          </View>
        )
      })}
    </View>
  )
}

function Areas({ r, s, t, locale }: { r: ReportData; s: Styles; t: TFunction; locale: string }) {
  const own   = Object.fromEntries(REPORT_AREAS.map((a) => [a, r.areas[a].share])) as Record<ReportArea, number>
  const group = Object.fromEntries(REPORT_AREAS.map((a) => [a, r.areas[a].groupMedianShare])) as Record<ReportArea, number>
  return (
    <View wrap={false}>
      <Text style={s.h2}>{t('azureReport.pdf.areasTitle')}</Text>
      <View style={[s.row, { alignItems: 'center', marginBottom: 5 }]}>
        <Text style={{ width: 118, fontSize: 8 }}>{t('azureReport.pdf.areasOwn')}</Text>
        <StackedBar shares={own} s={s} />
      </View>
      <View style={[s.row, { alignItems: 'center' }]}>
        <Text style={{ width: 118, fontSize: 8, color: C.muted }}>{t('azureReport.pdf.areasGroup')}</Text>
        <StackedBar shares={group} s={s} />
      </View>
      <View style={[s.row, { marginTop: 7, marginLeft: 118, flexWrap: 'wrap' }]}>
        {REPORT_AREAS.map((a) => (
          <View key={a} style={[s.row, { alignItems: 'center', marginRight: 14 }]}>
            <View style={{ width: 7, height: 7, borderRadius: 1.5, backgroundColor: AREA_COLORS[a], marginRight: 4 }} />
            <Text style={{ fontSize: 7.5, color: C.muted }}>
              {t(`azureReport.area.${a}`)} · {formatNumber(r.areas[a].points, locale)} {t('azureReport.pdf.pts')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function MonthlyChart({ r, s, t, locale, font }: { r: ReportData; s: Styles; t: TFunction; locale: string; font: string }) {
  const W = 511, H = 150
  const pad = { top: 14, right: 4, bottom: 26, left: 30 }
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom
  const months = r.months
  const maxV = Math.max(1, ...months.map((m) => Math.max(m.points, m.groupMedian)))
  const step = cW / Math.max(1, months.length)
  const barW = Math.min(26, step * 0.62)
  const y = (v: number) => pad.top + cH - (v / maxV) * cH
  const label = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString(locale, { month: 'short' })
  const ticks = [0, 0.5, 1].map((f) => Math.round(maxV * f))
  return (
    <View wrap={false}>
      <Text style={s.h2}>{t('azureReport.pdf.monthlyTitle')}</Text>
      <Svg width={W} height={H}>
        {ticks.map((v) => (
          <G key={v}>
            <Line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth={0.6} />
            <SvgText x={pad.left - 4} y={y(v) + 2.5} textAnchor="end" style={{ fontSize: 6.5, fontFamily: font }} fill={C.faint}>
              {formatNumber(v, locale)}
            </SvgText>
          </G>
        ))}
        {months.map((m, i) => {
          const cx = pad.left + step * i + step / 2
          let acc = 0
          return (
            <G key={m.month}>
              {REPORT_AREAS.map((a) => {
                const v = m.areas[a]
                if (v <= 0) return null
                const y0 = y(acc), y1 = y(acc + v)
                acc += v
                return <Rect key={a} x={cx - barW / 2} y={y1} width={barW} height={Math.max(0.5, y0 - y1)} fill={AREA_COLORS[a]} />
              })}
              <Line x1={cx - barW / 2 - 3} x2={cx + barW / 2 + 3} y1={y(m.groupMedian)} y2={y(m.groupMedian)} stroke={C.ink} strokeWidth={1.1} strokeDasharray="2.5 1.5" />
              {m.points > 0 && (
                <SvgText x={cx} y={y(Math.max(m.points, m.groupMedian)) - 4} textAnchor="middle" style={{ fontSize: 6.5, fontFamily: font, fontWeight: 600 }} fill={C.text}>
                  {formatNumber(m.points, locale)}
                </SvgText>
              )}
              <SvgText x={cx} y={H - pad.bottom + 11} textAnchor="middle" style={{ fontSize: 7, fontFamily: font }} fill={C.muted}>
                {label(m.month)}
              </SvgText>
              {(i === 0 || m.month.endsWith('-01')) && (
                <SvgText x={cx} y={H - pad.bottom + 20} textAnchor="middle" style={{ fontSize: 6.5, fontFamily: font }} fill={C.faint}>
                  {m.month.slice(0, 4)}
                </SvgText>
              )}
            </G>
          )
        })}
      </Svg>
      <View style={[s.row, { marginTop: 2, alignItems: 'center' }]}>
        <View style={{ width: 14, borderTopWidth: 1.1, borderTopColor: C.ink, borderStyle: 'dashed', marginRight: 5 }} />
        <Text style={s.small}>{t('azureReport.pdf.monthlyMedian')}</Text>
      </View>
    </View>
  )
}

function placement(st: MetricStat | undefined, t: TFunction, lowerIsBetter = false): string {
  if (!st || st.percentile === null || st.value === null) return '–'
  const p = lowerIsBetter ? 100 - st.percentile : st.percentile
  if (p >= 75) return t('azureReport.place.top')
  if (p >= 50) return t('azureReport.place.aboveMedian')
  if (p >= 25) return t('azureReport.place.belowMedian')
  return t('azureReport.place.bottom')
}

interface Col { label: string; flex: number; align?: 'right'; pad?: boolean }

function TableHead({ s, cols }: { s: Styles; cols: Col[] }) {
  return (
    <View style={[s.row, { paddingBottom: 3, borderBottomWidth: 0.8, borderBottomColor: C.faint }]} fixed>
      {cols.map((c, i) => (
        <Text key={i} style={[s.th, { flex: c.flex, textAlign: c.align ?? 'left', paddingLeft: c.pad ? 8 : 0 }]}>{c.label}</Text>
      ))}
    </View>
  )
}

function DetailTable({ r, s, t, n }: { r: ReportData; s: Styles; t: TFunction; n: N }) {
  const cols = [
    { label: t('azureReport.pdf.colMetric'), flex: 3.2 },
    { label: t('azureReport.pdf.colCount'), flex: 1, align: 'right' as const },
    { label: t('azureReport.pdf.colPoints'), flex: 1, align: 'right' as const },
    { label: t('azureReport.pdf.colMedian'), flex: 1.5, align: 'right' as const },
    { label: t('azureReport.pdf.colPlacement'), flex: 1.6, pad: true },
  ]
  const d = r.dev as unknown as Record<string, number>
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={120}>{t('azureReport.pdf.detailTitle')}</Text>
      <TableHead s={s} cols={cols} />
      {REPORT_AREAS.map((a) => (
        <View key={a} wrap={false}>
          <View style={s.groupRow}>
            <View style={{ width: 6, height: 6, borderRadius: 1.5, backgroundColor: AREA_COLORS[a], marginRight: 5, marginTop: 1.5 }} />
            <Text style={s.groupText}>{t(`azureReport.area.${a}`)}</Text>
          </View>
          {FIELDS.filter((f) => f.area === a).map((f) => (
            <View key={f.field} style={s.tr}>
              <Text style={{ flex: 3.2 }}>{t(`azureRanking.${f.tKey}`)}</Text>
              <Text style={[s.num, { flex: 1 }]}>{n(d[f.field])}</Text>
              <Text style={[s.num, { flex: 1, color: C.muted }]}>{n((r.dev.pointsByMetric as Record<string, number> | undefined)?.[f.field] ?? 0)}</Text>
              <Text style={[s.num, { flex: 1.5, color: C.muted }]}>{n(r.metrics[f.field]?.median, Number.isInteger(r.metrics[f.field]?.median ?? 0) ? 0 : 1)}</Text>
              <Text style={{ flex: 1.6, paddingLeft: 8, color: C.muted }}>{placement(r.metrics[f.field], t)}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={[s.small, { marginTop: 5 }]}>{t('azureReport.pdf.detailHint')}</Text>
    </View>
  )
}

function WorkStyle({ r, s, t, n, locale }: { r: ReportData; s: Styles; t: TFunction; n: N; locale: string }) {
  const m = r.metrics
  const dur = (v: number | null | undefined) => (v === null || v === undefined ? '–' : formatDuration(v, t, locale))
  const rows: { key: string; value: string; median: string; place: string }[] = [
    { key: 'prCycleHours',        value: dur(m.prCycleHours?.value),        median: dur(m.prCycleHours?.median),        place: placement(m.prCycleHours, t, true) },
    { key: 'reviewResponseHours', value: dur(m.reviewResponseHours?.value), median: dur(m.reviewResponseHours?.median), place: placement(m.reviewResponseHours, t, true) },
    { key: 'findingsPerReview',   value: n(m.findingsPerReview?.value, 1),  median: n(m.findingsPerReview?.median, 1),  place: placement(m.findingsPerReview, t) },
    { key: 'reviewsPerOwnPr',     value: n(m.reviewsPerOwnPr?.value, 1),    median: n(m.reviewsPerOwnPr?.median, 1),    place: placement(m.reviewsPerOwnPr, t) },
    { key: 'workItemsPerPr',      value: n(m.workItemsPerPr?.value, 1),     median: n(m.workItemsPerPr?.median, 1),     place: placement(m.workItemsPerPr, t) },
    { key: 'distinctAuthors',     value: n(m.distinctAuthors?.value),       median: n(m.distinctAuthors?.median, 1),    place: placement(m.distinctAuthors, t) },
  ]
  const cols = [
    { label: t('azureReport.pdf.colMetric'), flex: 4.2 },
    { label: t('azureReport.pdf.colValue'), flex: 1, align: 'right' as const },
    { label: t('azureReport.pdf.colMedian'), flex: 1.5, align: 'right' as const },
    { label: t('azureReport.pdf.colPlacement'), flex: 1.6, pad: true },
  ]
  return (
    <View>
      <View wrap={false}>
        <Text style={s.h2}>{t('azureReport.pdf.workStyleTitle')}</Text>
        <TableHead s={s} cols={cols} />
        {rows.map((row) => (
          <View key={row.key} style={s.tr}>
            <Text style={{ flex: 4.2 }}>{t(`azureReport.metric.${row.key}`)}</Text>
            <Text style={[s.num, { flex: 1 }]}>{row.value}</Text>
            <Text style={[s.num, { flex: 1.5, color: C.muted }]}>{row.median}</Text>
            <Text style={{ flex: 1.6, paddingLeft: 8, color: C.muted }}>{row.place}</Text>
          </View>
        ))}
        <Text style={[s.small, { marginTop: 5 }]}>{t('azureReport.pdf.workStyleHint')}</Text>
      </View>
      {(r.repositories.length > 0 || r.workItemTypes.length > 0) && (
        <View style={[s.row, { marginTop: 4 }]} wrap={false}>
          {r.repositories.length > 0 && (
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={s.h3}>{t('azureReport.pdf.repositories')}</Text>
              <Text style={s.para}>{r.repositories.map((x) => `${x.name} (${n(x.prs)})`).join(', ')}</Text>
            </View>
          )}
          {r.workItemTypes.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>{t('azureReport.pdf.workItemTypes')}</Text>
              <Text style={s.para}>{r.workItemTypes.map((x) => `${x.type} (${n(x.count)})`).join(', ')}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function NameList({ s, title, items, n }: { s: Styles; title: string; items: { name: string; count: number }[]; n: N }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.h3}>{title}</Text>
      {items.length === 0 ? <Text style={s.small}>–</Text> : items.map((x) => (
        <View key={x.name} style={[s.tr, { paddingVertical: 2.5 }]}>
          <Text style={{ flex: 1 }}>{x.name}</Text>
          <Text style={[s.num, { width: 40, color: C.muted }]}>{n(x.count)}</Text>
        </View>
      ))}
    </View>
  )
}

function Collaboration({ r, s, t, n }: { r: ReportData; s: Styles; t: TFunction; n: N }) {
  return (
    <View wrap={false}>
      <Text style={s.h2}>{t('azureReport.pdf.collaborationTitle')}</Text>
      <View style={s.row}>
        <NameList s={s} title={t('azureReport.pdf.reviewedFor')} items={r.collaboration.reviewedFor} n={n} />
        <View style={{ width: 20 }} />
        <NameList s={s} title={t('azureReport.pdf.reviewedBy')} items={r.collaboration.reviewedBy} n={n} />
      </View>
    </View>
  )
}

function LevelSquares({ level }: { level: number }) {
  return (
    <View style={{ flexDirection: 'row', marginRight: 6 }}>
      {[1, 2, 3, 4, 5].map((l) => (
        <View key={l} style={{ width: 6, height: 6, borderRadius: 1.2, marginRight: 1.5, backgroundColor: l <= level ? C.accent : C.line }} />
      ))}
    </View>
  )
}

function Competencies({ ctx, s, t, n, locale }: { ctx: ReportContext; s: Styles; t: TFunction; n: N; locale: string }) {
  const comp = ctx.competencies!
  const experts = comp.skills.filter((x) => x.level >= 4).length
  const byArea = new Map<string, typeof comp.skills>()
  for (const sk of comp.skills) byArea.set(sk.area, [...(byArea.get(sk.area) ?? []), sk])
  const cols = [
    { label: t('azureReport.pdf.colSkill'), flex: 3.4 },
    { label: t('azureReport.pdf.colLevel'), flex: 2.4 },
    { label: t('azureReport.pdf.colTeamAvg'), flex: 1, align: 'right' as const },
    { label: t('azureReport.pdf.colNote'), flex: 2.6, pad: true },
  ]
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={100}>{t('azureReport.pdf.competenciesTitle')}</Text>
      {comp.skills.length === 0 ? (
        <Text style={s.small}>{t('azureReport.pdf.competenciesNone')}</Text>
      ) : (
        <>
          <Text style={[s.small, { marginBottom: 6 }]}>
            {t('azureReport.pdf.competenciesSummary', {
              count: comp.skills.length, experts,
              date: comp.lastUpdate ? new Date(comp.lastUpdate).toLocaleDateString(locale) : '–',
            })}
          </Text>
          <TableHead s={s} cols={cols} />
          {[...byArea].map(([area, list]) => (
            <View key={area}>
              <View style={s.groupRow} minPresenceAhead={30}><Text style={s.groupText}>{area}</Text></View>
              {list.map((sk) => (
                <View key={`${area}-${sk.name}`} style={s.tr} wrap={false}>
                  <Text style={{ flex: 3.4 }}>{sk.name}{sk.category ? <Text style={{ color: C.faint }}>  ·  {sk.category}</Text> : null}</Text>
                  <View style={[s.row, { flex: 2.4, alignItems: 'center' }]}>
                    <LevelSquares level={sk.level} />
                    <Text style={{ color: C.muted }}>{t(`skillLevel.${sk.level}`)}</Text>
                  </View>
                  <Text style={[s.num, { flex: 1, color: C.muted }]}>{n(sk.teamAvg, 1)}</Text>
                  <Text style={{ flex: 2.6, paddingLeft: 8, color: C.muted }}>
                    {sk.knowledgeHolder ? t('azureReport.pdf.skillOnlyExpert') : sk.growthPotential ? t('azureReport.pdf.skillGrowth') : ''}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  )
}
