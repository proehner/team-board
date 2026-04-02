# Team Board

A Scrum team dashboard for team leads – manage members, competencies, sprints, rotations, retrospectives, pulse checks, stakeholder communication, and Azure DevOps rankings in a single web application.

---

## Table of Contents

1. [Features](#1-features)
2. [Technology Stack](#2-technology-stack)
3. [Local Development](#3-local-development)
4. [GitHub Pages Deployment](#4-github-pages-deployment)
5. [Environment Variables](#5-environment-variables)
6. [Hosting the Backend Separately](#6-hosting-the-backend-separately)
7. [User Login & Roles](#7-user-login--roles)
8. [Project Structure](#8-project-structure)

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
| **Dark / Light Mode** | Toggleable via the sidebar button, setting is persisted |

---

## 2. Technology Stack

### Frontend

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (including dark mode via `class` strategy)
- Zustand (state management)
- React Router v6
- Lucide React (icons)
- i18next + react-i18next (English / German UI, auto-detection)

### Backend (`server/`)

- Node.js + Express
- SQLite via `node-sqlite3-wasm` (no native compilation required)
- JWT authentication
- TypeScript

---

## 3. Local Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install && cd ..
```

### Starting the Server

```bash
# Terminal 1 – Backend (starts on http://localhost:3001)
cd server
npm run dev
```

```bash
# Terminal 2 – Frontend (starts on http://localhost:5173)
npm run dev
```

On the first backend start, demo data is seeded automatically (5 members, skills, sprint, retrospective).

**Default login:** `admin` / `admin` (please change after first login)

---

## 4. GitHub Pages Deployment

The frontend can be hosted as a static site on **GitHub Pages**. The backend must run separately (see [Section 6](#6-hosting-the-backend-separately)).

### One-time Setup (5 Steps)

**Step 1 – Create a repository on GitHub**

Create a repository (name e.g. `team-lead`, can be public or private).

**Step 2 – Add the backend URL as a repository variable**

So the frontend running in the browser knows where the backend is:

`Settings → Secrets and variables → Actions → Variables → New repository variable`

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://your-server.example.com` (without trailing `/`) |

> If you don't have the backend yet, the value can be left empty – the app will still build, but API calls will fail.

**Step 3 – Enable GitHub Pages**

`Settings → Pages → Source: GitHub Actions`

**Step 4 – Push code**

```bash
git remote add origin https://github.com/YOUR-USER/team-lead.git
git push -u origin main
```

The workflow `.github/workflows/deploy.yml` starts automatically, builds the frontend and publishes it.

**Step 5 – Open the app**

After approximately 1–2 minutes the app is available at:

```
https://YOUR-USER.github.io/team-lead/
```

### Automatic Deployments

Every push to `main` or `master` automatically triggers a new build and deploy. You can see the status under `Actions` in the repository.

---

## 5. Environment Variables

Copy `.env.example` to `.env.local` for local overrides (not committed):

```bash
cp .env.example .env.local
```

| Variable | Where set | Description |
|---|---|---|
| `VITE_API_URL` | GitHub repository variable or `.env.local` | Backend URL, e.g. `https://my-server.com`. Leave empty for local development. |
| `VITE_BASE_PATH` | Set automatically by CI | Base path of the frontend (`/team-lead/`). Only needed manually if the repo name differs from the path. |

**For the backend** (`server/.env`, not committed):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | TCP port of the Express server |
| `DB_PATH` | `server/data/teamlead.db` | Path to the SQLite database file |
| `JWT_SECRET` | (randomly generated on start) | Secret for JWT token signing – must be set in production |

---

## 6. Hosting the Backend Separately

GitHub Pages only hosts static files. The backend (Express + SQLite) must run on its own server. Recommended options:

### Option A – VPS / own server (recommended)

```bash
# On the server: clone and build
git clone https://github.com/YOUR-USER/team-lead.git
cd team-lead
npm install
cd server && npm install
cd .. && npm run server:build

# Start as a service with PM2
npm install -g pm2
pm2 start server/dist/index.js --name team-lead
pm2 save && pm2 startup
```

Then set up a reverse proxy (nginx/Caddy) to make port 3001 accessible via a public URL.

### Option B – Windows Server with IIS

See [OPERATIONS.md – Section 4](OPERATIONS.md#4-deployment-on-iis-windows) for the full IIS guide with iisnode.

### Option C – Render / Railway / Fly.io (Cloud)

These platforms can host the Node.js server directly from the `server/` directory. Set environment variables (`PORT`, `DB_PATH`, `JWT_SECRET`) in the respective platform settings.

> **CORS:** For the frontend hosted on GitHub Pages to be able to access the backend, the GitHub Pages domain must be added to the CORS configuration in `server/src/index.ts`.

---

## 7. User Login & Roles

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

The password should be changed immediately after the first login under `Administration → User Management`.

Additional users can be created at `/admin` and configured with restricted page access.

---

## 8. Project Structure

```txt
team-lead/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions: build & deploy to GitHub Pages
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
│       └── teamlead.db       # SQLite database file (created automatically)
├── .env.example              # Template for environment variables
├── OPERATIONS.md                # Detailed operations guide
├── vite.config.ts
└── package.json
```
