import { useEffect } from 'react'

const APP_NAME = 'Team Board'

/** Sets the browser tab title to "<title> · Team Board" while the component is mounted. */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} · ${APP_NAME}`
    return () => { document.title = prev }
  }, [title])
}
