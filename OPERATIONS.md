# Team Board – Operations Guide

## Quick Reference

| Task | Command |
| --- | --- |
| Install dependencies | `npm install && cd server && npm install && cd ..` |
| Local development | see [Section 2](#2-local-development) |
| **Production build** | **`npm run build:deploy`** |
| Custom IIS alias | `npm run build:deploy -- --base myapp` |

---

## 1. Project Structure

```txt
team-board/
├── src/                  Frontend (React + TypeScript + Vite)
├── server/
│   ├── src/              Backend (Express + SQLite via node-sqlite3-wasm)
│   │   ├── index.ts      Server entry point
│   │   ├── db.ts         Database initialisation
│   │   └── routes/       REST API endpoints
│   └── data/             SQLite database file (created automatically on first run)
├── scripts/
│   └── build-deploy.mjs  Production build + assembly script
├── vite.config.ts
├── web.config            IIS configuration (ready to use)
└── package.json
```

**API base URL:** `/api`  
**Database:** Single file `server/data/teamlead.db` (SQLite)

---

## 2. Local Development

### Prerequisites

- Node.js ≥ 18 (tested with v20 LTS and v24)
- npm ≥ 9

### Installation

```bash
npm install
cd server && npm install && cd ..
```

### Starting

```bash
# Terminal 1 – Backend (http://localhost:3001)
cd server && npm run dev

# Terminal 2 – Frontend (http://localhost:5173)
npm run dev
```

On the first backend start, sample data is seeded automatically.  
Default login: `admin` / `admin`

---

## 3. Production Build

A single command builds the frontend, compiles the server, and assembles a
complete, self-contained deployment artifact:

```bash
npm run build:deploy
```

The script runs three steps automatically:

1. **Frontend** – TypeScript check + Vite build (output: `dist/`)
2. **Server** – TypeScript compilation (output: `server/dist/`)
3. **Assembly** – everything is collected into `release/`

### Output

The command always produces **two artifacts** in parallel:

```txt
release/                 ← complete artifact (first deployment / fresh install)
├── dist/                ← compiled frontend (HTML, JS, CSS, assets)
├── server/
│   ├── dist/            ← compiled server (Node.js)
│   ├── node_modules/    ← server runtime dependencies
│   └── data/            ← database directory (empty, auto-populated on first run)
└── web.config           ← IIS configuration (only DB_PATH needs adjustment)

update/                  ← compiled outputs only (updating an existing IIS install)
├── dist/                ← compiled frontend
├── server/
│   └── dist/            ← compiled server (no node_modules, no data!)
└── web.config
```

Use `release/` for the **first deployment**. Use `update/` for all subsequent updates
— it is much smaller because it excludes `server/node_modules/` and the database.

### Custom IIS alias

The default base path is `/board`. To deploy under a different URL alias:

```bash
# Works in every shell (Git Bash, PowerShell, cmd)
npm run build:deploy -- --base myapp
```

> **Git Bash note:** Do not use a leading `/` (e.g. `/myapp`) in Git Bash – MSYS converts
> it to `C:/Program Files/Git/myapp` before Node.js receives it. The script adds the `/`
> automatically, so just pass the name without the slash.

Also update `APP_BASE_PATH` in `web.config` to match.

---

## 4. IIS Deployment

### IIS Prerequisites

- Windows Server with IIS installed
- [iisnode](https://github.com/Azure/iisnode/releases) installed
- [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) installed
- Node.js installed on the server and available in PATH for the IIS app pool user

### Architecture

```txt
Browser → IIS → URL Rewrite
                  ├── /assets/*  → dist/assets/*  (static, served directly by IIS)
                  ├── /api/*     → iisnode → Node.js / Express
                  └── /*         → iisnode → Node.js → index.html (SPA fallback)
```

---

### Step 1 – Build

```bash
npm run build:deploy
```

### Step 2 – Copy to the server

```powershell
xcopy /E /Y /I release\* C:\inetpub\wwwroot\board\
```

### Step 3 – Configure as IIS Application (mandatory)

> iisnode only works inside an IIS **Application**. A plain virtual directory is not sufficient.

1. Open **IIS Manager** (`inetmgr`)
2. Expand **Sites → Default Web Site**
3. If the `board` folder exists as a virtual directory: right-click → **Convert to Application**  
   If it does not exist: right-click **Default Web Site** → **Add Application...**
   - Alias: `board`
   - Physical path: `C:\inetpub\wwwroot\board`
4. Application Pool settings:
   - `.NET CLR Version:` **No Managed Code**
   - Pipeline mode: **Integrated**

### Step 4 – Grant write access

The IIS app pool user needs write access on `server\data\`:

```powershell
# Adjust user name as needed (e.g. "IIS AppPool\board" or "DefaultAppPool")
icacls "C:\inetpub\wwwroot\board\server\data" /grant "IIS AppPool\board:(OI)(CI)M"
```

### Step 5 – Adjust `web.config`

Set the absolute path to the SQLite database file:

```xml
<appSettings>
  <add key="DB_PATH" value="C:\inetpub\wwwroot\board\server\data\teamlead.db" />
  <add key="APP_BASE_PATH" value="/board" />
</appSettings>
```

> Do **not** set `PORT` – iisnode communicates via named pipe, not TCP.

### Step 6 – Verify

Restart the IIS site. The app is available at:

```txt
http://<servername>/board/
```

After the first request an `iisnode-logs/` directory appears in the deployment folder.
If it does not appear, the folder is not configured as an IIS Application (see Step 3).

---

## 5. Redeployment

```bash
# Rebuild (creates both release/ and update/ in one step)
npm run build:deploy
```

```powershell
# Copy update/ to the server (no node_modules, no database)
xcopy /E /Y update\dist\        C:\inetpub\wwwroot\board\dist\
xcopy /E /Y update\server\dist\ C:\inetpub\wwwroot\board\server\dist\

# Recycle the app pool (triggers a Node.js process restart)
iisreset /noforce
```

> `server\node_modules\` only needs to be re-copied when server dependencies change.
> In that case copy from `release\server\node_modules\` instead.

---

## 6. Configuration

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | TCP port of the Express server (not used under iisnode) |
| `DB_PATH` | `server/data/teamlead.db` | Absolute or relative path to the SQLite file |
| `JWT_SECRET` | random on start | Secret for JWT signing – **must be set explicitly in production** |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `APP_BASE_PATH` | (empty) | IIS sub-path prefix, e.g. `/board` |

Set via `web.config` `<appSettings>` (IIS) or a `server/.env` file (PM2 / standalone).

---

## 7. Database

The SQLite database is a single file at `server/data/teamlead.db`.

### Backup

```powershell
copy server\data\teamlead.db server\data\teamlead_backup_%date%.db
```

### Reset (delete all data)

Stop the server, delete `server\data\teamlead.db`, restart – seed data is inserted automatically.

### Inspect the schema

```bash
sqlite3 server/data/teamlead.db .schema
```

### Tables

| Table | Description |
| --- | --- |
| `teams` | Teams (multi-team support) |
| `members` | Team members |
| `skills` | Skill catalogue (global) |
| `member_skills` | Competency matrix (member × skill) |
| `sprints` | Sprints with metadata |
| `sprint_capacity` | Capacity per member per sprint |
| `assignments` | Rotation assignments |
| `retrospectives` | Retrospectives |
| `retro_items` | Individual items of a retrospective |

---

## 8. Troubleshooting

### Server not reachable

```bash
curl http://localhost:3001/api/health
```

If that fails: server not running, port conflict, or firewall blocking the port.

### iisnode errors (HTTP 500)

- Check `iisnode-logs/` in the deployment directory
- Is Node.js available in PATH for the app pool user?
- Does `server\data\` have write permissions?

### Database locked

```powershell
taskkill /F /IM node.exe
rmdir /S /Q server\data\teamlead.db.lock
```

### TypeScript errors

```bash
npx tsc --noEmit            # frontend
cd server && npx tsc --noEmit   # server
```

---

## 9. Alternative: PM2 without iisnode

If iisnode is not available, use PM2 to manage the Node.js process and configure IIS as a reverse proxy (requires the ARR module).

```bash
npm install -g pm2 pm2-windows-startup
pm2 start release\server\dist\index.js --name "team-board"
pm2 save
pm2-startup install
```

`web.config` for the reverse proxy:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3001/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```
