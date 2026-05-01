# Team Board

A Scrum team dashboard for team leads – manage members, competencies, sprints, rotations, retrospectives, pulse checks, meetings, tickets, roadmap, known errors, stakeholder communication, and Azure DevOps rankings in a single web application.

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
| **Dashboard** | Customizable overview tiles – active sprint, open action items, team metrics, custom URLs |
| **Team** | Member management with roles, avatar upload, and active/inactive status |
| **Competencies** | Competency matrix and hierarchical skill catalogue (areas → categories → skills) with rating levels 0–5 |
| **Sprints** | Sprint planning, per-member capacity management, velocity tracking, and sprint detail view |
| **Rotation** | Assignment and rotation of configurable team responsibilities (e.g. on-call, Scrum Master) with color coding |
| **Retrospectives** | Structured retro boards with voting, status tracking, and action item assignment |
| **Team Health** | Bus factor analysis, workload distribution, and absence simulation |
| **Pulse Check** | Anonymous satisfaction surveys within the team |
| **Meetings** | Recurring meeting management with topics, comments, file attachments, and ticket links |
| **Tickets** | Lightweight ticket tracking with status, priority, multiple assignees, and global/team scoping |
| **Roadmap** | Feature planning with sub-tickets, API endpoint definitions, UI screens, and per-feature detail views |
| **Known Errors** | Error database with severity, solutions, workarounds, comments, and file attachments |
| **Software** | Registry for tracking vendor software versions used by the team |
| **Stakeholder** | Sprint progress and goal achievement overview for external communication |
| **Azure Rankings** | Gamified developer ranking based on Azure DevOps metrics |
| **Global Search** | Cross-module search across members, skills, tickets, topics, errors, and roadmap features |
| **Multi-Team** | Full tenant isolation – each team has its own members, sprints, assignments, and settings |
| **Dark / Light Mode** | Toggleable via the sidebar button, persisted across sessions |

---

## 2. Technology Stack

### Frontend

- React 18 + TypeScript
- Vite 5 (build tool)
- Tailwind CSS 3 (dark mode via `class` strategy)
- Zustand (state management)
- React Router v6
- Lucide React (icons)
- React Markdown + remark-gfm (rich text rendering)
- date-fns (date utilities)
- i18next + react-i18next (English / German, auto-detection)

### Backend (`server/`)

- Node.js + Express 4
- SQLite via `node-sqlite3-wasm` (no native compilation required)
- JWT authentication (jsonwebtoken)
- bcryptjs (password hashing)
- Multer (file upload handling)
- Nodemailer (email notifications)
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

This creates a `release/` folder (first deployment) and an `update/` folder (subsequent updates) that can be copied directly to the IIS deployment directory:

```powershell
xcopy /E /Y /I release\* C:\inetpub\wwwroot\board\
```

### IIS Setup (summary)

| Step | What to do |
| --- | --- |
| Prerequisites | Install [iisnode](https://github.com/Azure/iisnode/releases) and [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) |
| IIS Application | Configure the target folder as an **IIS Application** (not just a virtual directory) |
| Permissions | Grant write access on `server\data\` to the IIS app pool user |
| `web.config` | Set `DB_PATH` to the absolute path of the database file |

The `web.config` is included in the `release/` output and pre-configured for iisnode. Only `DB_PATH` needs to be set to the actual absolute path on the target server.

For the complete step-by-step guide including redeployment, PM2 alternative, and troubleshooting, see [OPERATIONS.md](OPERATIONS.md).

### Docker Deployment

For Docker-based deployments (nginx + HTTPS), see [DOCKER.md](DOCKER.md).

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
| `user` | Access to permitted pages (configurable per user in Admin → User Management) |

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
├── src/                          # React frontend (TypeScript)
│   ├── api/                      # API client (fetch wrapper)
│   ├── components/
│   │   ├── layout/               # Sidebar, Layout wrapper
│   │   └── ui/                   # Reusable UI components (Button, Card, Modal, …)
│   ├── i18n/                     # i18next setup + locale files (en/de)
│   ├── pages/                    # Page components (one per module)
│   ├── store/                    # Zustand stores (app, auth, theme)
│   ├── types/                    # Shared TypeScript interfaces
│   └── utils/                    # Date and avatar helpers
├── server/                       # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts              # Entry point, middleware, route registration
│   │   ├── db.ts                 # SQLite initialisation (30 tables)
│   │   ├── seed.ts               # Demo data seeding
│   │   ├── email.ts              # Email notification helpers
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT validation & page access control
│   │   └── routes/               # REST API endpoints (one file per module)
│   └── data/
│       └── teamlead.db           # SQLite database (created automatically)
├── docker/                       # Docker deployment
│   ├── Dockerfile                # Multi-stage build (frontend + backend)
│   ├── docker-compose.yml        # Service orchestration (app + nginx)
│   ├── .env.docker.example       # Docker environment template
│   ├── scripts/
│   │   └── generate-ssl.sh       # Self-signed certificate generator
│   └── nginx/
│       ├── nginx.conf            # HTTPS termination + HTTP redirect
│       └── ssl/                  # cert.pem / key.pem (not in Git)
├── scripts/
│   └── build-deploy.mjs          # Production build + assembly script
├── public/                       # Static public assets
├── .env.example                  # Template for environment variables
├── web.config                    # IIS configuration (iisnode + URL Rewrite)
├── OPERATIONS.md                 # Full operations guide (build, deploy, DB, troubleshooting)
├── DOCKER.md                     # Docker setup guide
├── vite.config.ts
└── package.json
```
