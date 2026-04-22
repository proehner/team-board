# Team Board

A Scrum team dashboard for team leads – manage members, competencies, sprints, rotations, retrospectives, pulse checks, stakeholder communication, and Azure DevOps rankings in a single web application.

---

## Table of Contents

1. [Features](#1-features)
2. [Technology Stack](#2-technology-stack)
3. [Local Development](#3-local-development)
4. [Production Build & IIS Deployment](#4-production-build--iis-deployment)
5. [User Login & Roles](#5-user-login--roles)
6. [Environment Variables](#6-environment-variables)
7. [Project Structure](#7-project-structure)

---

## 1. Features

| Area | What it offers |
| --- | --- |
| **Dashboard** | Central overview – active sprint, open action items, team metrics |
| **Team** | Member management with roles and active/inactive status |
| **Competencies** | Competency matrix and skill catalogue with rating levels |
| **Sprints** | Sprint planning, capacity management and velocity tracking |
| **Rotation** | Assignment and rotation of team responsibilities (e.g. on-call, Scrum Master) |
| **Retrospectives** | Structured retro boards with voting and action items |
| **Team Health** | Bus factor analysis, workload distribution and absence simulation |
| **Pulse Check** | Anonymous satisfaction surveys within the team |
| **Stakeholder** | Sprint progress and goal achievement for external communication |
| **Azure Rankings** | Gamified developer ranking based on Azure DevOps metrics |
| **Dark / Light Mode** | Toggleable via the sidebar button, persisted across sessions |

---

## 2. Technology Stack

### Frontend

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (dark mode via `class` strategy)
- Zustand (state management)
- React Router v6
- Lucide React (icons)
- i18next + react-i18next (English / German, auto-detection)

### Backend (`server/`)

- Node.js + Express
- SQLite via `node-sqlite3-wasm` (no native compilation required)
- JWT authentication
- TypeScript

---

## 3. Local Development

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
All `/api` requests are proxied by Vite to `localhost:3001`.

**Default login:** `admin` / `admin` (change after first login)

---

## 4. Production Build & IIS Deployment

### Build

One command builds the frontend, compiles the server, and assembles a self-contained artifact:

```bash
npm run build:deploy
```

This creates a `release/` folder that can be copied directly to the IIS deployment directory:

```powershell
xcopy /E /Y /I release\* C:\inetpub\wwwroot\board\
```

### IIS Setup (summary)

| Step | What to do |
| --- | --- |
| Prerequisites | Install [iisnode](https://github.com/Azure/iisnode/releases) and [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) |
| IIS Application | Configure the target folder as an **IIS Application** (not just a virtual directory) |
| Permissions | Grant write access on `server\data\` to the IIS app pool user |
| `web.config` | Adjust `DB_PATH` to the absolute path of the database file |

The `web.config` is included in the `release/` output and pre-configured for iisnode. Only `DB_PATH` needs to be set to the actual absolute path on the target server.

For the complete step-by-step guide including redeployment, PM2 alternative, and troubleshooting, see [OPERATIONS.md](OPERATIONS.md).

### Custom IIS alias

The default URL alias is `/board`. To deploy under a different path:

```bash
npm run build:deploy -- --base /myapp
```

Also update `APP_BASE_PATH` in `web.config` to match.

---

## 5. User Login & Roles

The application uses JWT-based authentication.

| Role | Permissions |
| --- | --- |
| `admin` | Full access to all areas including user management |
| `user` | Access to permitted areas (configurable per user) |

**Default admin after first start:**

```txt
Username: admin
Password: admin
```

Change the password immediately after the first login under **Administration → User Management**.

Additional users can be created at `/admin` and configured with restricted page access.

---

## 6. Environment Variables

**Frontend** (set at build time via `.env.local` or CI variables):

| Variable | Description |
| --- | --- |
| `VITE_BASE_PATH` | Base path of the app (e.g. `/board/`). Set automatically by `build:deploy`. |

**Backend** (`server/.env`, not committed):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | TCP port (not used under iisnode) |
| `DB_PATH` | `server/data/teamlead.db` | Path to the SQLite database file |
| `JWT_SECRET` | random on start | **Must be set explicitly in production** |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `APP_BASE_PATH` | (empty) | IIS sub-path prefix, e.g. `/board` |

Copy `.env.example` to `server/.env` as a starting point.

---

## 7. Project Structure

```txt
team-board/
├── src/                      # React frontend (TypeScript)
│   ├── api/                  # API client (fetch wrapper)
│   ├── components/
│   │   ├── layout/           # Sidebar, layout
│   │   └── ui/               # Reusable UI components
│   ├── i18n/                 # i18next setup + locale files (en/de)
│   ├── pages/                # Page components
│   ├── store/                # Zustand stores (app, auth, theme)
│   └── types/                # Shared TypeScript types
├── server/                   # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── db.ts             # SQLite initialisation
│   │   └── routes/           # REST API endpoints
│   └── data/
│       └── teamlead.db       # SQLite database (created automatically)
├── scripts/
│   └── build-deploy.mjs      # Production build + assembly script
├── .env.example              # Template for environment variables
├── web.config                # IIS configuration (iisnode + URL Rewrite)
├── OPERATIONS.md             # Full operations guide (build, deploy, DB, troubleshooting)
├── vite.config.ts
└── package.json
```
