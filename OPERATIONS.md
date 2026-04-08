# Team Board – Operations Guide

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Local Development](#2-local-development)
3. [Creating a Production Build](#3-creating-a-production-build)
4. [Deployment on IIS (Windows)](#4-deployment-on-iis-windows)
5. [Configuration](#5-configuration)
6. [Database](#6-database)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Project Structure

```txt
team-lead/
├── src/                  Frontend (React + TypeScript + Vite)
├── server/
│   ├── src/              Backend (Express + SQLite via node-sqlite3-wasm)
│   │   ├── index.ts      Server entry point
│   │   ├── db.ts         Database initialisation and query helpers
│   │   ├── seed.ts       Initial test data (first start only)
│   │   └── routes/       REST API endpoints
│   ├── data/
│   │   └── teamlead.db   SQLite database file (created automatically)
│   ├── dist/             Compiled server (after npm run build)
│   └── package.json
├── dist/                 Compiled frontend (after npm run build)
├── vite.config.ts
└── package.json
```

**API base URL:** `/api`  
**Database:** Single file `server/data/teamlead.db` (SQLite)

---

## 2. Local Development

### Prerequisites

- Node.js ≥ 18 (tested with v20 LTS and v24)
- npm ≥ 9

### One-time Installation

```bash
# In the root directory (frontend dependencies)
npm install

# In the server directory
cd server
npm install
cd ..
```

### Starting the Server

```bash
cd server
npm run dev
```

The server starts on **<http://localhost:3001>**.  
On the first start, sample data (5 members, 10 skills, 1 sprint, retrospective) is seeded automatically.

### Starting the Frontend Development Server (separate terminal)

```bash
# In the root directory
npm run dev
```

The frontend is available at **<http://localhost:5173>**.  
All `/api` requests are automatically proxied by Vite to the server on port 3001.

### Environment Variables (optional)

| Variable  | Default                   | Description                        |
|-----------|---------------------------|------------------------------------|
| `PORT`    | `3001`                    | Port of the Express server         |
| `DB_PATH` | `server/data/teamlead.db` | Custom path to the database file   |

Example with a custom port:

```bash
PORT=8080 npm run dev   # inside the server/ directory
```

---

## 3. Creating a Production Build

```bash
# 1. Build the frontend (generates dist/)
npm run build

# 2. Build the server (generates server/dist/)
npm run server:build
```

In production mode, the Express server serves the built frontend from the `dist/` folder. **No separate frontend server** is needed.

### Starting the Production Server

```bash
npm run server:start
# or directly:
node server/dist/index.js
```

The application is then available at **<http://localhost:3001>**.

---

## 4. Deployment on IIS (Windows)

### IIS Prerequisites

- Windows Server with IIS installed
- **iisnode** installed: <https://github.com/Azure/iisnode/releases>
- **URL Rewrite Module** installed: <https://www.iis.net/downloads/microsoft/url-rewrite>
- Node.js installed on the server and available in the PATH of the IIS application pool user

### Architecture

iisnode acts as an IIS handler that forwards HTTP requests directly to a Node.js process via a named pipe — no separate TCP port needed. The `web.config` at the application root controls routing:

```txt
Browser → IIS → URL Rewrite
                  ├── /assets/*   → dist/assets/*  (static, IIS serves directly)
                  ├── /api/*      → iisnode → Node.js/Express
                  └── /*          → iisnode → Node.js → index.html (SPA)
```

> **Critical:** The deployment directory **must be configured as an IIS Application**, not just a virtual directory. Without this, iisnode is never invoked. See Step 3.

---

### Step 1 – Create a Build

The frontend must be built with the correct subpath so that asset URLs and API calls include the `/board/` prefix.

```bash
# Install dependencies (first time or after changes)
npm install
cd server && npm install && cd ..

# Build frontend for IIS subdirectory deployment
npm run build:iis

# Build server
npm run server:build
```

`npm run build:iis` sets `VITE_BASE_PATH=/board/` automatically. To deploy under a different alias, adjust the `build:iis` script in `package.json` accordingly.

### Step 2 – Transfer Files to the Server

Copy the following to `C:\inetpub\wwwroot\board\` (or your target directory):

```txt
board/
├── dist/                    ← frontend build output (from npm run build:iis)
├── server/
│   ├── dist/                ← compiled server (from npm run server:build)
│   ├── data/                ← database directory (must be writable by IIS app pool)
│   └── node_modules/        ← server dependencies
├── server/.env              ← server environment file (JWT_SECRET etc.)
└── web.config               ← copy from repo root, adjust DB_PATH
```

The `web.config` is included in the repository root — copy it to the deployment directory and adjust the `DB_PATH` value.

### Step 3 – Configure as IIS Application (mandatory)

> This step is **required**. iisnode only works within an IIS Application context. A plain virtual directory is not sufficient.

1. Open **IIS Manager** (`inetmgr`)
2. Expand the tree: **Sites → Default Web Site**
3. If the `board` folder already exists as a virtual directory: right-click → **Convert to Application**  
   If it does not exist yet: right-click on **Default Web Site** → **Add Application...**
   - **Alias:** `board`
   - **Physical path:** `C:\inetpub\wwwroot\board`
4. In the Application Pool settings:
   - `.NET CLR Version:` **No Managed Code**
   - **Pipeline mode:** Integrated
5. Click **OK**

### Step 4 – Set Permissions

The IIS application pool user (e.g. `IIS AppPool\board` or `DefaultAppPool`) needs:

- **Read** access on the entire `board/` directory
- **Write** access on `board/server/data/` (SQLite database file)

```powershell
# Example (adjust user name as needed):
icacls "C:\inetpub\wwwroot\board\server\data" /grant "IIS AppPool\board:(OI)(CI)M"
```

### Step 5 – Configure `web.config`

The `web.config` from the repository root is already correct. After copying, only adjust the `DB_PATH`:

```xml
<appSettings>
  <add key="DB_PATH" value="C:\inetpub\wwwroot\board\server\data\teamlead.db" />
</appSettings>
```

> Do **not** set `PORT` — iisnode ignores it and communicates via a named pipe instead.

### Step 6 – Verify

After restarting the IIS site, the application is available at:

```txt
http://<servername>/board/
```

Check that iisnode is working — a log directory should appear after the first request:

```txt
C:\inetpub\wwwroot\board\iisnode-logs\
```

If this directory does not appear, iisnode is not being invoked. Most common cause: `board` is not configured as an IIS Application (see Step 3).

---

### Redeployment (after code changes)

```bash
# Rebuild
npm run build:iis
npm run server:build

# Copy to IIS (adjust path as needed)
xcopy /E /Y dist\ C:\inetpub\wwwroot\board\dist\
xcopy /E /Y server\dist\ C:\inetpub\wwwroot\board\server\dist\

# Restart the IIS application (recycles the Node.js process)
iisreset /noforce
```

---

### Alternative: PM2 as a Windows Service (without iisnode)

If iisnode is not available, PM2 can manage the Node.js process as a Windows service with IIS acting as a reverse proxy.

```bash
npm install -g pm2 pm2-windows-startup
pm2 start server/dist/index.js --name "team-board"
pm2 save
pm2-startup install
```

`web.config` for the reverse proxy (requires the ARR module):

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

---

## 5. Configuration

### Environment Variables

| Variable  | Default                   | Description                                       |
|-----------|---------------------------|---------------------------------------------------|
| `PORT`    | `3001`                    | TCP port of the Express server                    |
| `DB_PATH` | `server/data/teamlead.db` | Absolute or relative path to the SQLite file      |

Variables can be set via:

- Shell: `PORT=8080 node server/dist/index.js`
- `web.config` (IIS, see above)
- `.env` file (if dotenv is included – not configured by default)

### CORS

In development mode CORS is open for all origins. For production environments the configuration in `server/src/index.ts` can be restricted:

```typescript
app.use(cors({
  origin: 'https://my-domain.com',
  credentials: true,
}))
```

---

## 6. Database

The SQLite database is stored as a **single file** at `server/data/teamlead.db`.

### Backup

```bash
# Simple backup by copying
copy server\data\teamlead.db server\data\teamlead_backup_%date%.db
```

### Reset (delete all data)

```bash
# Stop the server, then:
del server\data\teamlead.db
# Restart the server → seed data is re-inserted automatically
```

### Inspect the Schema

```bash
# With the sqlite3 CLI (if installed):
sqlite3 server/data/teamlead.db .schema

# Or with the Node.js REPL:
node -e "const {Database}=require('node-sqlite3-wasm'); const db=new Database('server/data/teamlead.db'); console.log(db.all(\"SELECT name FROM sqlite_master WHERE type='table'\"))"
```

### Tables

| Table              | Description                                 |
|--------------------|---------------------------------------------|
| `members`          | Team members                                |
| `skills`           | Skill catalogue                             |
| `member_skills`    | Competency matrix (member × skill)          |
| `sprints`          | Sprints with metadata                       |
| `sprint_capacity`  | Capacity per member per sprint              |
| `assignments`      | Rotation assignments                        |
| `retrospectives`   | Retrospectives                              |
| `retro_items`      | Individual items of a retrospective         |

---

## 7. Troubleshooting

### "Server unreachable" in the frontend

1. Check whether the server is running: `curl http://localhost:3001/api/health`
2. Port conflict: try a different port with `PORT=3002 npm run dev`
3. Firewall: open the port in the Windows Firewall

### iisnode errors (HTTP 500)

- Check iisnode logs: `server/iisnode/` (if loggingEnabled=true)
- Is Node.js available in the PATH of the IIS application pool user?
- Check permissions on `server/data/` (write access required)

### Database errors

- Check that `server/data/` exists and is writable
- For `SQLite3Error: database is locked`: remove the lock directory and the old process:

  ```bash
  # Stop all Node processes
  taskkill /F /IM node.exe
  # Remove the stale lock directory (created on hard process termination)
  rmdir /S /Q server\data\teamlead.db.lock
  # Restart the server
  cd server && npm run dev
  ```

### TypeScript compilation errors

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit
```
