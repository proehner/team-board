# Docker – Build & Start

Alle Docker-spezifischen Dateien liegen unter `docker/`.

Team Board läuft als zwei Docker-Container:

| Container | Aufgabe |
|-----------|---------|
| `app` | Node.js – liefert Frontend (statische Dateien) und REST-API |
| `nginx` | HTTPS-Termination (Port 443) + HTTP→HTTPS-Redirect (Port 80) |

Die SQLite-Datenbank wird in einem benannten Docker-Volume (`db-data`) gespeichert und bleibt über Neustarts und Updates erhalten.

---

## Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 25 (inkl. Docker Compose V2)
- OpenSSL (für die Zertifikatsgenerierung)
  - Windows: wird mit Git for Windows mitgeliefert, oder via [Chocolatey](https://chocolatey.org/): `choco install openssl`
  - Linux/macOS: normalerweise bereits installiert

---

## 1. SSL-Zertifikat erstellen

Für die lokale Entwicklung wird ein selbstsigniertes Zertifikat benötigt.

**Linux / macOS / Git Bash:**
```bash
sh docker/scripts/generate-ssl.sh
```

**Windows (PowerShell mit OpenSSL):**
```powershell
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 `
  -keyout docker/nginx/ssl/key.pem `
  -out    docker/nginx/ssl/cert.pem `
  -subj   "/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Die generierten Dateien `docker/nginx/ssl/cert.pem` und `docker/nginx/ssl/key.pem` werden von nginx gemountet und sind in `.gitignore` eingetragen.

> **Produktivbetrieb:** Ersetze die selbstsignierten Zertifikate durch echte (z. B. von Let's Encrypt oder dem internen CA). Lege die Dateien als `cert.pem` / `key.pem` in `docker/nginx/ssl/` ab.

---

## 2. Umgebungsvariablen konfigurieren

```bash
cp docker/.env.docker.example docker/.env.docker
```

Dann `docker/.env.docker` öffnen und den `JWT_SECRET` setzen:

```bash
# Sicheren Zufallswert generieren:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Wichtige Variablen:

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `JWT_SECRET` | Ja | Mindestens 32 zufällige Zeichen |
| `CORS_ORIGIN` | Nein | Standard: `https://localhost` |
| `HTTP_PORT` | Nein | Host-Port für HTTP-Redirect (Standard: 80) |
| `HTTPS_PORT` | Nein | Host-Port für HTTPS (Standard: 443) |

---

## 3. Build & Start

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker up -d --build
```

Die App ist danach erreichbar unter: **https://localhost**

Standard-Login: `admin` / `admin` (beim ersten Start wird automatisch ein Admin-Benutzer angelegt).

---

## Weitere Befehle

```bash
# Logs beobachten
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker logs -f

# Nur App-Logs
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker logs -f app

# Container stoppen (Daten bleiben erhalten)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker down

# Container stoppen UND Datenbank löschen (!)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker down -v

# Image neu bauen (nach Code-Änderungen)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker up -d --build

# Status prüfen
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker ps
```

---

## Ports ändern

Wenn Port 80 oder 443 bereits belegt ist, können alternative Ports in `docker/.env.docker` gesetzt werden:

```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

Die App ist dann unter **https://localhost:8443** erreichbar.

---

## Datenbank-Backup

Die Datenbank wird bei jedem Start automatisch als `teamlead.db.backup-<timestamp>` gesichert.  
Für ein manuelles Backup:

```bash
docker run --rm \
  -v team-board_db-data:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/db-backup.tar.gz -C /data .
```

---

## Projektstruktur (Docker-relevant)

```
team-board/
├── .dockerignore               # Exclude-Liste für den Docker Build-Kontext
├── DOCKER.md                   # Diese Dokumentation
└── docker/
    ├── Dockerfile              # Multi-Stage Build (Frontend + Backend)
    ├── docker-compose.yml      # Service-Orchestrierung
    ├── .env.docker.example     # Vorlage für Umgebungsvariablen
    ├── scripts/
    │   └── generate-ssl.sh     # Hilfsskript für selbstsignierte Zertifikate
    └── nginx/
        ├── nginx.conf          # nginx HTTPS-Konfiguration
        └── ssl/
            ├── cert.pem        # (nicht im Git – selbst generieren)
            └── key.pem         # (nicht im Git – selbst generieren)
```
