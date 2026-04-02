# Docker – Build & Start

All Docker-specific files are located under `docker/`.

Team Board runs as two Docker containers:

| Container | Role |
| ----------- | --------- |
| `app` | Node.js – serves the frontend (static files) and REST API |
| `nginx` | HTTPS termination (port 443) + HTTP→HTTPS redirect (port 80) |

The SQLite database is stored in a named Docker volume (`db-data`) and persists across restarts and updates.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 25 (including Docker Compose V2)
- OpenSSL (for certificate generation)
  - Windows: bundled with Git for Windows, or via [Chocolatey](https://chocolatey.org/): `choco install openssl`
  - Linux/macOS: usually already installed

---

## 1. Create an SSL Certificate

A self-signed certificate is required for local development.

**Linux / macOS / Git Bash:**

```bash
sh docker/scripts/generate-ssl.sh
```

**Windows (PowerShell with OpenSSL):**

```powershell
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 `
  -keyout docker/nginx/ssl/key.pem `
  -out    docker/nginx/ssl/cert.pem `
  -subj   "/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

The generated files `docker/nginx/ssl/cert.pem` and `docker/nginx/ssl/key.pem` are mounted by nginx and are listed in `.gitignore`.

> **Production:** Replace the self-signed certificates with real ones (e.g. from Let's Encrypt or an internal CA). Place the files as `cert.pem` / `key.pem` in `docker/nginx/ssl/`.

---

## 2. Configure Environment Variables

```bash
cp docker/.env.docker.example docker/.env.docker
```

Then open `docker/.env.docker` and set the `JWT_SECRET`:

```bash
# Generate a secure random value:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Key variables:

| Variable | Required | Description |
| ---------- | --------- | -------------- |
| `JWT_SECRET` | Yes | At least 32 random characters |
| `CORS_ORIGIN` | No | Default: `https://localhost` |
| `HTTP_PORT` | No | Host port for HTTP redirect (default: 80) |
| `HTTPS_PORT` | No | Host port for HTTPS (default: 443) |

---

## 3. Build & Start

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker up -d --build
```

The app is then available at: **<https://localhost>**

Default login: `admin` / `admin` (an admin user is created automatically on first start).

---

## Other Commands

```bash
# Follow logs
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker logs -f

# App logs only
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker logs -f app

# Stop containers (data is preserved)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker down

# Stop containers AND delete the database (!)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker down -v

# Rebuild the image (after code changes)
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker up -d --build

# Check status
docker compose -f docker/docker-compose.yml --env-file docker/.env.docker ps
```

---

## Changing Ports

If port 80 or 443 is already in use, alternative ports can be set in `docker/.env.docker`:

```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

The app will then be available at **<https://localhost:8443>**.

---

## Database Backup

The database is automatically backed up as `teamlead.db.backup-<timestamp>` on every start.  
For a manual backup:

```bash
docker run --rm \
  -v team-board_db-data:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/db-backup.tar.gz -C /data .
```

---

## Project Structure (Docker-relevant)

```txt
team-board/
├── .dockerignore               # Exclude list for the Docker build context
├── DOCKER.md                   # This documentation
└── docker/
    ├── Dockerfile              # Multi-stage build (frontend + backend)
    ├── docker-compose.yml      # Service orchestration
    ├── .env.docker.example     # Template for environment variables
    ├── scripts/
    │   └── generate-ssl.sh     # Helper script for self-signed certificates
    └── nginx/
        ├── nginx.conf          # nginx HTTPS configuration
        └── ssl/
            ├── cert.pem        # (not in Git – generate yourself)
            └── key.pem         # (not in Git – generate yourself)
```
