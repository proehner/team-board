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
- **IIS Module:** [iisnode](https://github.com/Azure/iisnode/releases) installed  
  (allows IIS to host Node.js processes as IIS applications)
- **URL Rewrite Module** for IIS installed  
  (Download: <https://www.iis.net/downloads/microsoft/url-rewrite>)
- Node.js installed on the server (in PATH)

### Step 1 – Create a Build (on dev machine or server)

```bash
npm install
npm run build
cd server && npm install
cd .. && npm run server:build
```

### Step 2 – Transfer Files to the Server

The following directories/files are required:

```txt
team-lead/
├── dist/                    ← rendered frontend
├── server/
│   ├── dist/                ← compiled server
│   ├── data/                ← database directory (must be writable)
│   └── node_modules/        ← server dependencies
└── web.config               ← IIS configuration (see below)
```

### Step 3 – Create `web.config`

Create the file `web.config` in the **root directory** of the application:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>

    <!-- iisnode: host the Node.js process -->
    <handlers>
      <add name="iisnode"
           path="server/dist/index.js"
           verb="*"
           modules="iisnode" />
    </handlers>

    <!-- URL Rewrite: route all requests to the Node server -->
    <rewrite>
      <rules>
        <!-- Serve static files (frontend bundle) directly -->
        <rule name="StaticContent" stopProcessing="true">
          <match url="^dist/(.+)" />
          <action type="Rewrite" url="dist/{R:1}" />
        </rule>

        <!-- Route all other requests to iisnode (Node.js) -->
        <rule name="NodeApp">
          <match url=".*" />
          <action type="Rewrite" url="server/dist/index.js" />
        </rule>
      </rules>
    </rewrite>

    <!-- iisnode configuration -->
    <iisnode
      nodeProcessCommandLine="node"
      watchedFiles="*.js"
      loggingEnabled="true"
      logDirectory="iisnode"
      debuggingEnabled="false" />

    <!-- Disable error pages (Node.js handles them) -->
    <httpErrors existingResponse="PassThrough" />

  </system.webServer>

  <!-- Environment variables for the Node.js process -->
  <appSettings>
    <add key="PORT" value="3001" />
    <add key="DB_PATH" value="C:\inetpub\wwwroot\team-lead\server\data\teamlead.db" />
  </appSettings>
</configuration>
```

> **Note:** Adjust the `DB_PATH` value to the actual installation path.

### Step 4 – Configure the IIS Application

1. Open **IIS Manager**
2. Under **Sites** → desired website → **Add Application**
   - Alias: e.g. `team-lead`
   - Physical path: path to the root directory (where `web.config` is located)
3. Configure the **Application Pool**:
   - `.NET CLR Version`: **No Managed Code**
   - Pipeline mode: **Integrated**
4. Set **Permissions**:
   - The application pool user (e.g. `IIS AppPool\team-lead`) needs **write access** to the `server/data/` directory

### Step 5 – Verify Accessibility

After setup, the application is reachable at:

```txt
http://<servername>/team-lead/
```

or, if configured as the root site:

```txt
http://<servername>/
```

### Alternative: PM2 as a Windows Service (without iisnode)

If iisnode is not desired, PM2 can be used as a Windows service:

```bash
# Install PM2 globally
npm install -g pm2 pm2-windows-startup

# Register the server as a service
pm2 start server/dist/index.js --name "team-lead" -e server/logs/err.log -o server/logs/out.log
pm2 save
pm2-startup install

# Configure IIS as reverse proxy (forwards port 80 → 3001)
```

`web.config` for the IIS reverse proxy (alternative to iisnode):

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3001/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_ORIGINAL_URL" value="{R:0}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

> **Requirement:** The ARR (Application Request Routing) module for IIS must be installed.

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
