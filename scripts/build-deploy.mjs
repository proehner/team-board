#!/usr/bin/env node
/**
 * Builds and assembles two deployment artifacts:
 *
 *   release/  – complete, self-contained (first deployment or fresh install)
 *   update/   – compiled outputs only (updating an existing IIS installation)
 *
 * Usage:
 *   npm run build:deploy                   → base path /board (default)
 *   npm run build:deploy -- --base /myapp  → base path /myapp
 */
import { execSync } from 'child_process'
import { cpSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const UPDATE  = join(ROOT, 'update')

const baseIdx  = process.argv.indexOf('--base')
const basePath = baseIdx !== -1 ? process.argv[baseIdx + 1] : '/board'
const viteBase = basePath.endsWith('/') ? basePath : basePath + '/'

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

// ── 1. Clean ──────────────────────────────────────────────────────────────────
console.log('Cleaning release/ and update/ ...')
rmSync(RELEASE, { recursive: true, force: true })
rmSync(UPDATE,  { recursive: true, force: true })

// ── 2. Build frontend ─────────────────────────────────────────────────────────
console.log('\n[1/3] Building frontend ...')
process.env.VITE_BASE_PATH = viteBase
run('npm run build')

// ── 3. Build server ───────────────────────────────────────────────────────────
console.log('\n[2/3] Building server ...')
run('npm run build', join(ROOT, 'server'))

// ── 4. Assemble release/ (complete – for first deployment) ───────────────────
console.log('\n[3/3] Assembling release/ and update/ ...')

mkdirSync(RELEASE)
cpSync(join(ROOT, 'dist'),               join(RELEASE, 'dist'),               { recursive: true })
mkdirSync(join(RELEASE, 'server', 'dist'), { recursive: true })
cpSync(join(ROOT, 'server', 'dist'),     join(RELEASE, 'server', 'dist'),     { recursive: true })
cpSync(join(ROOT, 'server', 'node_modules'), join(RELEASE, 'server', 'node_modules'), { recursive: true })
cpSync(join(ROOT, 'server', 'package.json'), join(RELEASE, 'server', 'package.json'))
mkdirSync(join(RELEASE, 'server', 'data'), { recursive: true })
cpSync(join(ROOT, 'web.config'),         join(RELEASE, 'web.config'))

// ── 5. Assemble update/ (compiled outputs only – for updating existing installs)
mkdirSync(UPDATE)
cpSync(join(ROOT, 'dist'),               join(UPDATE, 'dist'),                { recursive: true })
mkdirSync(join(UPDATE, 'server', 'dist'), { recursive: true })
cpSync(join(ROOT, 'server', 'dist'),     join(UPDATE, 'server', 'dist'),      { recursive: true })
cpSync(join(ROOT, 'web.config'),         join(UPDATE, 'web.config'))

console.log(`
╔══════════════════════════════════════════════════════════╗
║  Build complete.                                         ║
╠══════════════════════════════════════════════════════════╣
║  release/  full artifact   (first deployment)            ║
║  update/   compiled only   (update existing IIS install) ║
╚══════════════════════════════════════════════════════════╝

  Base path : ${basePath}

  First deployment – copy everything:
    xcopy /E /Y /I release\\* C:\\inetpub\\wwwroot\\board\\

  Update existing installation:
    xcopy /E /Y update\\dist\\        C:\\inetpub\\wwwroot\\board\\dist\\
    xcopy /E /Y update\\server\\dist\\ C:\\inetpub\\wwwroot\\board\\server\\dist\\
    iisreset /noforce

  Note: update/ does NOT contain server\\node_modules\\ or server\\data\\.
  Re-copy server\\node_modules\\ only when server dependencies change.
`)
