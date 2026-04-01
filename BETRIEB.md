# Team Board – Betriebsanleitung

## Inhaltsverzeichnis

1. [Projektstruktur](#1-projektstruktur)
2. [Lokaler Entwicklungsbetrieb](#2-lokaler-entwicklungsbetrieb)
3. [Produktions-Build erstellen](#3-produktions-build-erstellen)
4. [Deployment auf IIS (Windows)](#4-deployment-auf-iis-windows)
5. [Konfiguration](#5-konfiguration)
6. [Datenbank](#6-datenbank)
7. [Fehlerbehebung](#7-fehlerbehebung)

---

## 1. Projektstruktur

```txt
team-lead/
├── src/                  Frontend (React + TypeScript + Vite)
├── server/
│   ├── src/              Backend (Express + SQLite via node-sqlite3-wasm)
│   │   ├── index.ts      Server-Einstiegspunkt
│   │   ├── db.ts         Datenbankinitialisierung und Query-Helfer
│   │   ├── seed.ts       Initiale Testdaten (nur beim ersten Start)
│   │   └── routes/       REST-API-Endpunkte
│   ├── data/
│   │   └── teamlead.db   SQLite-Datenbankdatei (wird automatisch erstellt)
│   ├── dist/             Kompilierter Server (nach npm run build)
│   └── package.json
├── dist/                 Kompiliertes Frontend (nach npm run build)
├── vite.config.ts
└── package.json
```

**API-Basis-URL:** `/api`
**Datenbank:** Einzelne Datei `server/data/teamlead.db` (SQLite)

---

## 2. Lokaler Entwicklungsbetrieb

### Voraussetzungen

- Node.js ≥ 18 (getestet mit v20 LTS und v24)
- npm ≥ 9

### Einmalige Installation

```bash
# Im Stammverzeichnis (Frontend-Abhängigkeiten)
npm install

# Im Server-Verzeichnis
cd server
npm install
cd ..
```

### Server starten

```bash
cd server
npm run dev
```

Der Server startet auf **<http://localhost:3001>**.
Beim ersten Start werden automatisch Beispieldaten (5 Mitglieder, 10 Fähigkeiten, 1 Sprint, Retrospektive) eingespielt.

### Frontend-Entwicklungsserver starten (separates Terminal)

```bash
# Im Stammverzeichnis
npm run dev
```

Das Frontend ist auf **<http://localhost:5173>** erreichbar.
Alle `/api`-Anfragen werden automatisch per Vite-Proxy an den Server auf Port 3001 weitergeleitet.

### Umgebungsvariablen (optional)

| Variable  | Standard                        | Beschreibung                            |
|-----------|---------------------------------|-----------------------------------------|
| `PORT`    | `3001`                          | Port des Express-Servers                |
| `DB_PATH` | `server/data/teamlead.db`       | Abweichender Pfad zur Datenbankdatei    |

Beispiel mit abweichendem Port:

```bash
PORT=8080 npm run dev   # im server/-Verzeichnis
```

---

## 3. Produktions-Build erstellen

```bash
# 1. Frontend bauen (erzeugt dist/)
npm run build

# 2. Server bauen (erzeugt server/dist/)
npm run server:build
```

Im Produktionsmodus serviert der Express-Server das gebaute Frontend aus dem `dist/`-Ordner. Es wird **kein separater Frontend-Server** benötigt.

### Produktionsserver starten

```bash
npm run server:start
# oder direkt:
node server/dist/index.js
```

Die Anwendung ist dann auf **<http://localhost:3001>** erreichbar.

---

## 4. Deployment auf IIS (Windows)

### Voraussetzungen IIS

- Windows Server mit IIS installiert
- **IIS-Modul:** [iisnode](https://github.com/Azure/iisnode/releases) installiert
  (ermöglicht IIS, Node.js-Prozesse als IIS-Anwendungen zu hosten)
- **URL Rewrite Modul** für IIS installiert
  (Download: <https://www.iis.net/downloads/microsoft/url-rewrite>)
- Node.js auf dem Server installiert (im PATH)

### Schritt 1 – Build erstellen (auf Entwicklungsrechner oder Server)

```bash
npm install
npm run build
cd server && npm install
cd .. && npm run server:build
```

### Schritt 2 – Dateien auf den Server übertragen

Folgende Verzeichnisse/Dateien werden benötigt:

```txt
team-lead/
├── dist/                    ← gerendertes Frontend
├── server/
│   ├── dist/                ← kompilierter Server
│   ├── data/                ← Datenbankverzeichnis (muss beschreibbar sein)
│   └── node_modules/        ← Server-Abhängigkeiten
└── web.config               ← IIS-Konfiguration (siehe unten)
```

### Schritt 3 – `web.config` erstellen

Erstelle die Datei `web.config` im **Stammverzeichnis** der Anwendung:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>

    <!-- iisnode: Node.js-Prozess hosten -->
    <handlers>
      <add name="iisnode"
           path="server/dist/index.js"
           verb="*"
           modules="iisnode" />
    </handlers>

    <!-- URL Rewrite: alle Anfragen an den Node-Server leiten -->
    <rewrite>
      <rules>
        <!-- Statische Dateien (Frontend-Bundle) direkt ausliefern -->
        <rule name="StaticContent" stopProcessing="true">
          <match url="^dist/(.+)" />
          <action type="Rewrite" url="dist/{R:1}" />
        </rule>

        <!-- Alle anderen Anfragen an iisnode (Node.js) -->
        <rule name="NodeApp">
          <match url=".*" />
          <action type="Rewrite" url="server/dist/index.js" />
        </rule>
      </rules>
    </rewrite>

    <!-- iisnode-Konfiguration -->
    <iisnode
      nodeProcessCommandLine="node"
      watchedFiles="*.js"
      loggingEnabled="true"
      logDirectory="iisnode"
      debuggingEnabled="false" />

    <!-- Fehlerseiten deaktivieren (Node.js übernimmt) -->
    <httpErrors existingResponse="PassThrough" />

  </system.webServer>

  <!-- Umgebungsvariablen für den Node.js-Prozess -->
  <appSettings>
    <add key="PORT" value="3001" />
    <add key="DB_PATH" value="C:\inetpub\wwwroot\team-lead\server\data\teamlead.db" />
  </appSettings>
</configuration>
```

> **Hinweis:** Den Pfad bei `DB_PATH` an den tatsächlichen Installationspfad anpassen.

### Schritt 4 – IIS-Anwendung einrichten

1. **IIS-Manager** öffnen
2. Unter **Sites** → gewünschte Website → **Anwendung hinzufügen**
   - Alias: z. B. `team-lead`
   - Physischer Pfad: Pfad zum Stammverzeichnis (dort wo `web.config` liegt)
3. **Anwendungspool** konfigurieren:
   - `.NET CLR-Version`: **Kein verwalteter Code**
   - Pipeline-Modus: **Integriert**
4. **Berechtigungen** setzen:
   - Der Anwendungspool-Benutzer (z. B. `IIS AppPool\team-lead`) benötigt **Schreibrechte** auf das Verzeichnis `server/data/`

### Schritt 5 – Erreichbarkeit prüfen

Nach dem Einrichten ist die Anwendung erreichbar unter:

```txt
http://<servername>/team-lead/
```

oder, wenn als Root-Site konfiguriert:

```txt
http://<servername>/
```

### Alternative: PM2 als Windows-Dienst (ohne iisnode)

Wenn iisnode nicht gewünscht ist, kann PM2 als Windows-Dienst genutzt werden:

```bash
# PM2 global installieren
npm install -g pm2 pm2-windows-startup

# Server als Dienst registrieren
pm2 start server/dist/index.js --name "team-lead" -e server/logs/err.log -o server/logs/out.log
pm2 save
pm2-startup install

# IIS als Reverse Proxy konfigurieren (leitet Port 80 → 3001 weiter)
```

`web.config` für den IIS-Reverse-Proxy (Alternative zu iisnode):

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

> **Voraussetzung:** ARR (Application Request Routing) Modul für IIS muss installiert sein.

---

## 5. Konfiguration

### Umgebungsvariablen

| Variable  | Standard                  | Beschreibung                                   |
|-----------|---------------------------|------------------------------------------------|
| `PORT`    | `3001`                    | TCP-Port des Express-Servers                   |
| `DB_PATH` | `server/data/teamlead.db` | Absoluter oder relativer Pfad zur SQLite-Datei |

Variablen können gesetzt werden über:

- Shell: `PORT=8080 node server/dist/index.js`
- `web.config` (IIS, siehe oben)
- `.env`-Datei (wenn dotenv eingebunden – aktuell nicht konfiguriert)

### CORS

Im Entwicklungsmodus ist CORS für alle Origins freigegeben. Für Produktionsumgebungen kann die Konfiguration in `server/src/index.ts` eingeschränkt werden:

```typescript
app.use(cors({
  origin: 'https://meine-domain.de',
  credentials: true,
}))
```

---

## 6. Datenbank

Die SQLite-Datenbank liegt als **einzelne Datei** unter `server/data/teamlead.db`.

### Backup

```bash
# Einfaches Backup durch Kopieren
copy server\data\teamlead.db server\data\teamlead_backup_%date%.db
```

### Zurücksetzen (alle Daten löschen)

```bash
# Server stoppen, dann:
del server\data\teamlead.db
# Server neu starten → Seed-Daten werden automatisch neu eingespielt
```

### Schema ansehen

```bash
# Mit sqlite3 CLI (falls installiert):
sqlite3 server/data/teamlead.db .schema

# Oder mit dem Node.js REPL:
node -e "const {Database}=require('node-sqlite3-wasm'); const db=new Database('server/data/teamlead.db'); console.log(db.all(\"SELECT name FROM sqlite_master WHERE type='table'\"))"
```

### Tabellen

| Tabelle            | Beschreibung                                |
|--------------------|---------------------------------------------|
| `members`          | Teammitglieder                              |
| `skills`           | Fähigkeitskatalog                           |
| `member_skills`    | Kompetenz-Matrix (Mitglied × Fähigkeit)     |
| `sprints`          | Sprints mit Metadaten                       |
| `sprint_capacity`  | Kapazität pro Mitglied pro Sprint           |
| `assignments`      | Rotations-Zuweisungen                       |
| `retrospectives`   | Retrospektiven                              |
| `retro_items`      | Einzelne Items einer Retrospektive          |

---

## 7. Fehlerbehebung

### „Server nicht erreichbar" im Frontend

1. Prüfen ob der Server läuft: `curl http://localhost:3001/api/health`
2. Port-Konflikt: Anderen Port mit `PORT=3002 npm run dev` versuchen
3. Firewall: Port in der Windows-Firewall freigeben

### iisnode-Fehler (HTTP 500)

- iisnode-Logs prüfen: `server/iisnode/` (falls loggingEnabled=true)
- Node.js im PATH des IIS-Anwendungspool-Benutzers verfügbar?
- Berechtigungen auf `server/data/` prüfen (Schreibrecht nötig)

### Datenbankfehler

- Prüfen ob `server/data/` existiert und beschreibbar ist
- Bei `SQLite3Error: database is locked`: Lock-Verzeichnis und alten Prozess entfernen:

  ```bash
  # Alle Node-Prozesse beenden
  taskkill /F /IM node.exe
  # Verwaistes Lock-Verzeichnis entfernen (entsteht bei hartem Prozessabbruch)
  rmdir /S /Q server\data\teamlead.db.lock
  # Server neu starten
  cd server && npm run dev
  ```

### TypeScript-Kompilierfehler

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit
```
