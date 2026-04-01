/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend-URL für GitHub-Pages-Deployments, z. B. https://mein-server.example.com */
  readonly VITE_API_URL?: string
  /** Basis-Pfad für das Frontend, z. B. /team-lead/ – wird vom CI automatisch gesetzt */
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
