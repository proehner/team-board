import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

// react-markdown's defaultUrlTransform blocks non-standard protocols like upload://.
// We intercept upload:// URIs, resolve them to real API paths, and forward
// everything else to the default safe transform.
function urlTransform(url: string): string {
  if (url.startsWith('upload://')) {
    const filename = url.slice('upload://'.length)
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    return `${base}/api/uploads/${filename}`
  }
  return defaultUrlTransform(url)
}

const heading = 'scroll-mt-20 font-semibold tracking-tight text-slate-900 dark:text-slate-50 first:mt-0'

const components: Components = {
  h1: ({ children }) => <h1 className={`${heading} mt-6 mb-3 text-lg`}>{children}</h1>,
  h2: ({ children }) => <h2 className={`${heading} mt-6 mb-2.5 text-base`}>{children}</h2>,
  h3: ({ children }) => <h3 className={`${heading} mt-5 mb-2 text-sm`}>{children}</h3>,
  h4: ({ children }) => <h4 className={`${heading} mt-4 mb-1.5 text-sm text-slate-800 dark:text-slate-200`}>{children}</h4>,
  h5: ({ children }) => <h5 className={`${heading} mt-4 mb-1.5 text-sm text-slate-700 dark:text-slate-300`}>{children}</h5>,
  h6: ({ children }) => <h6 className={`${heading} mt-4 mb-1.5 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400`}>{children}</h6>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children, className }) => {
    const isTaskList = className?.includes('contains-task-list')
    return (
      <ul
        className={`my-3 space-y-1 first:mt-0 last:mb-0 [&_ol]:my-1 [&_ul]:my-1 ${
          isTaskList ? 'list-none pl-0.5' : 'list-disc pl-5 marker:text-slate-400 dark:marker:text-slate-500'
        }`}
      >
        {children}
      </ul>
    )
  },
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-slate-500 marker:tabular-nums dark:marker:text-slate-400 [&_ol]:my-1 [&_ul]:my-1"
    >
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li className={`pl-1 ${className?.includes('task-list-item') ? 'flex items-start gap-2 pl-0 [&>p]:my-0' : ''}`}>
      {children}
    </li>
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? (
      <input type="checkbox" checked={!!checked} readOnly disabled className="mt-[0.3rem] h-3.5 w-3.5 shrink-0 rounded" />
    ) : null,
  strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-slate-400 line-through dark:text-slate-500">{children}</del>,
  // Inline code. Code blocks are styled via the surrounding <pre> (descendant selectors win over these classes).
  code: ({ children }) => (
    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/70">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-800 scrollbar-thin [overflow-wrap:normal] first:mt-0 last:mb-0 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[length:inherit] [&_code]:text-inherit [&_code]:ring-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-[3px] border-indigo-300 bg-slate-50 py-2 pl-4 pr-3 text-slate-600 first:mt-0 last:mb-0 dark:border-indigo-500/50 dark:bg-slate-800/40 dark:text-slate-300 [&>p]:my-1.5">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-slate-200 dark:border-slate-800" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition-colors hover:text-indigo-500 hover:decoration-indigo-500 dark:text-indigo-400 dark:decoration-indigo-500/50 dark:hover:text-indigo-300 dark:hover:decoration-indigo-300"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt ?? ''}
      loading="lazy"
      onClick={() => { if (typeof src === 'string') window.open(src, '_blank', 'noopener,noreferrer') }}
      className="my-3 inline-block max-h-[480px] max-w-full cursor-zoom-in rounded-lg border border-slate-200 object-contain dark:border-slate-700"
    />
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 scrollbar-thin first:mt-0 last:mb-0 dark:border-slate-800">
      <table className="w-full border-collapse text-sm [overflow-wrap:normal]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-800/60">{children}</thead>,
  tr: ({ children }) => <tr className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">{children}</tr>,
  th: ({ children, style }) => (
    <th style={style} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{children}</td>
  ),
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

/** Renders user markdown (GFM) with the app's typography — light & dark. */
export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content.trim()) return null
  return (
    <div className={`text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
