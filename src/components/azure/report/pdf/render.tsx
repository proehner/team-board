import { Font, pdf } from '@react-pdf/renderer'
import type { TFunction } from 'i18next'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import interExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff?url'
import interExt600 from '@fontsource/inter/files/inter-latin-ext-600-normal.woff?url'
import interExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff?url'
import AnnualReportPdf from './AnnualReportPdf'
import type { ReportContext } from '../types'

// Loaded on demand (dynamic import) — keeps @react-pdf/renderer out of the main bundle.

let registered = false
function registerFonts() {
  if (registered) return
  Font.register({ family: 'Inter', fonts: [
    { src: inter400, fontWeight: 400 }, { src: inter500, fontWeight: 500 },
    { src: inter600, fontWeight: 600 }, { src: inter700, fontWeight: 700 },
  ] })
  // Fallback for characters outside Latin-1 (e.g. names with ć, ş, ł)
  Font.register({ family: 'InterExt', fonts: [
    { src: interExt400, fontWeight: 400 }, { src: interExt600, fontWeight: 600 }, { src: interExt700, fontWeight: 700 },
  ] })
  Font.registerHyphenationCallback((word) => [word]) // no automatic hyphenation
  registered = true
}

export async function renderAnnualReport(ctx: ReportContext, t: TFunction, locale: string): Promise<Blob> {
  registerFonts()
  return pdf(<AnnualReportPdf ctx={ctx} t={t} locale={locale} font={['Inter', 'InterExt']} />).toBlob()
}
