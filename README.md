# Team Board

Ein Scrum-Team-Dashboard für Teamleiter – verwaltet Mitglieder, Kompetenzen, Sprints, Rotationen, Retrospektiven, Pulse-Checks, Stakeholder-Kommunikation und Azure DevOps Rankings in einer einzigen Webanwendung.

---

## Inhaltsverzeichnis

1. [Funktionen](#1-funktionen)
2. [Technologie-Stack](#2-technologie-stack)
3. [Lokaler Betrieb (Entwicklung)](#3-lokaler-betrieb-entwicklung)
4. [GitHub Pages Deployment](#4-github-pages-deployment)
5. [Umgebungsvariablen](#5-umgebungsvariablen)
6. [Backend separat hosten](#6-backend-separat-hosten)
7. [Benutzeranmeldung & Rollen](#7-benutzeranmeldung--rollen)
8. [Projektstruktur](#8-projektstruktur)

---

## 1. Funktionen

| Bereich | Was es bietet |
| --- | --- |
| **Dashboard** | Zentraler Überblick – aktiver Sprint, offene Aktionspunkte, Teamkennzahlen |
| **Team** | Mitgliederverwaltung mit Rollen und Aktiv/Inaktiv-Status |
| **Kompetenzen** | Kompetenzmatrix und Skill-Katalog mit Bewertungsstufen |
| **Sprints** | Sprint-Planung, Kapazitätsverwaltung und Velocity-Tracking |
| **Rotation** | Zuweisung und Rotation von Teamverantwortlichkeiten (z. B. On-Call, Scrum Master) |
| **Retrospektiven** | Strukturierte Retro-Boards mit Abstimmung und Aktionspunkten |
| **Teamgesundheit** | Bus-Faktor-Analyse, Workload-Verteilung und Abwesenheitssimulation |
| **Pulse Check** | Anonyme Zufriedenheitsumfragen im Team |
| **Stakeholder** | Sprint-Fortschritt und Zielerreichung für externe Kommunikation |
| **Azure Rankings** | Gamifiziertes Entwickler-Ranking auf Basis von Azure DevOps Metriken |
| **Dark / Light Mode** | Umschaltbar über den Sidebar-Button, Einstellung wird gespeichert |

---

## 2. Technologie-Stack

### Frontend

- React 18 + TypeScript
- Vite (Build-Tool)
- Tailwind CSS (inkl. Dark-Mode via `class`-Strategie)
- Zustand (State Management)
- React Router v6
- Lucide React (Icons)

### Backend (`server/`)

- Node.js + Express
- SQLite via `node-sqlite3-wasm` (kein natives Kompilieren nötig)
- JWT-Authentifizierung
- TypeScript

---

## 3. Lokaler Betrieb (Entwicklung)

### Voraussetzungen

- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Frontend-Abhängigkeiten
npm install

# Backend-Abhängigkeiten
cd server && npm install && cd ..
```

### Server starten

```bash
# Terminal 1 – Backend (startet auf http://localhost:3001)
cd server
npm run dev
```

```bash
# Terminal 2 – Frontend (startet auf http://localhost:5173)
npm run dev
```

Beim ersten Backend-Start werden automatisch Demo-Daten eingespielt (5 Mitglieder, Fähigkeiten, Sprint, Retrospektive).

**Standard-Login:** `admin` / `admin` (bitte nach dem ersten Login ändern)

---

## 4. GitHub Pages Deployment

Das Frontend kann als statische Site auf **GitHub Pages** gehostet werden. Das Backend muss separat laufen (siehe [Abschnitt 6](#6-backend-separat-hosten)).

### Einmalige Einrichtung (5 Schritte)

**Schritt 1 – Repository auf GitHub anlegen**

Repository erstellen (Name z. B. `team-lead`, kann öffentlich oder privat sein).

**Schritt 2 – Backend-URL als Repository-Variable hinterlegen**

Damit das Frontend im Browser weiß, wo das Backend läuft:

`Settings → Secrets and variables → Actions → Variables → New repository variable`

| Name | Wert |
|---|---|
| `VITE_API_URL` | `https://dein-server.example.com` (ohne abschließenden `/`) |

> Solange du das Backend noch nicht hast, kann der Wert leer bleiben – die App baut trotzdem, API-Aufrufe schlagen dann allerdings fehl.

**Schritt 3 – GitHub Pages aktivieren**

`Settings → Pages → Source: GitHub Actions`

**Schritt 4 – Code pushen**

```bash
git remote add origin https://github.com/DEIN-USER/team-lead.git
git push -u origin main
```

Der Workflow `.github/workflows/deploy.yml` startet automatisch, baut das Frontend und veröffentlicht es.

**Schritt 5 – App aufrufen**

Nach ca. 1–2 Minuten ist die App erreichbar unter:

```
https://DEIN-USER.github.io/team-lead/
```

### Automatische Deployments

Jeder Push auf `main` oder `master` löst automatisch einen neuen Build und Deploy aus. Den Status siehst du unter `Actions` im Repository.

---

## 5. Umgebungsvariablen

Kopiere `.env.example` nach `.env.local` für lokale Anpassungen (wird nicht eingecheckt):

```bash
cp .env.example .env.local
```

| Variable | Wo gesetzt | Beschreibung |
|---|---|---|
| `VITE_API_URL` | GitHub Repository Variable oder `.env.local` | Backend-URL, z. B. `https://mein-server.de`. Leer lassen für lokale Entwicklung. |
| `VITE_BASE_PATH` | Wird vom CI automatisch gesetzt | Basis-Pfad des Frontends (`/team-lead/`). Nur manuell nötig, wenn der Repo-Name vom Pfad abweicht. |

**Für das Backend** (`server/.env`, nicht eingecheckt):

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `3001` | TCP-Port des Express-Servers |
| `DB_PATH` | `server/data/teamlead.db` | Pfad zur SQLite-Datenbankdatei |
| `JWT_SECRET` | (zufällig generiert beim Start) | Geheimnis für JWT-Token-Signierung – in Produktion unbedingt setzen |

---

## 6. Backend separat hosten

GitHub Pages hostet nur statische Dateien. Das Backend (Express + SQLite) muss auf einem eigenen Server laufen. Empfohlene Optionen:

### Option A – VPS / eigener Server (empfohlen)

```bash
# Auf dem Server: Code clonen und bauen
git clone https://github.com/DEIN-USER/team-lead.git
cd team-lead
npm install
cd server && npm install
cd .. && npm run server:build

# Mit PM2 als Dienst starten
npm install -g pm2
pm2 start server/dist/index.js --name team-lead
pm2 save && pm2 startup
```

Danach einen Reverse-Proxy (nginx/Caddy) einrichten, der Port 3001 unter einer öffentlichen URL erreichbar macht.

### Option B – Windows Server mit IIS

Siehe [BETRIEB.md – Abschnitt 4](BETRIEB.md#4-deployment-auf-iis-windows) für die vollständige IIS-Anleitung mit iisnode.

### Option C – Render / Railway / Fly.io (Cloud)

Diese Plattformen können den Node.js-Server direkt aus dem `server/`-Verzeichnis hosten. Umgebungsvariablen (`PORT`, `DB_PATH`, `JWT_SECRET`) in den jeweiligen Plattform-Einstellungen setzen.

> **CORS:** Damit das auf GitHub Pages gehostete Frontend auf das Backend zugreifen darf, muss in `server/src/index.ts` die GitHub-Pages-Domain in der CORS-Konfiguration eingetragen sein.

---

## 7. Benutzeranmeldung & Rollen

Die Anwendung verwendet JWT-basierte Authentifizierung.

| Rolle | Rechte |
| --- | --- |
| `admin` | Vollzugriff auf alle Bereiche inkl. Benutzerverwaltung |
| `user` | Zugriff auf freigegebene Bereiche (konfigurierbar pro Nutzer) |

**Standard-Admin nach dem ersten Start:**

```txt
Benutzername: admin
Passwort:     admin
```

Das Passwort sollte direkt nach dem ersten Login unter `Administration → Benutzerverwaltung` geändert werden.

Weitere Benutzer können unter `/admin` angelegt und mit eingeschränkten Seitenzugriffen konfiguriert werden.

---

## 8. Projektstruktur

```txt
team-lead/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions: Build & Deploy zu GitHub Pages
├── src/                      # React-Frontend (TypeScript)
│   ├── api/                  # API-Client (fetch-Wrapper)
│   ├── components/
│   │   ├── layout/           # Sidebar, Layout
│   │   └── ui/               # Wiederverwendbare UI-Komponenten
│   ├── pages/                # Seiten-Komponenten
│   ├── store/                # Zustand-Stores (app, auth, theme)
│   └── types/                # Gemeinsame TypeScript-Typen
├── server/                   # Express-Backend (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Einstiegspunkt
│   │   ├── db.ts             # SQLite-Initialisierung
│   │   └── routes/           # REST-API-Endpunkte
│   └── data/
│       └── teamlead.db       # SQLite-Datenbankdatei (wird automatisch erstellt)
├── .env.example              # Vorlage für Umgebungsvariablen
├── BETRIEB.md                # Ausführliche Betriebsanleitung
├── vite.config.ts
└── package.json
```
