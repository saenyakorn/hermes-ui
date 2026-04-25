# Hermes Agent Control Plane

A production-ready control plane and Web UI for the Hermes Agent, inspired by Framer's aesthetic.

## Features

- **Cinematic Dark UI:** High-fidelity design system with absolute black canvas, electric blue accents, and refined typography.
- **Gateway Management:** Start, stop, and restart the Hermes Gateway as a managed child process.
- **Interactive Terminal:** Full-featured browser terminal (xterm.js) bridged via Socket.io to a server-side PTY.
- **Live Logs:** Real-time streaming of gateway stdout/stderr via Server-Sent Events (SSE).
- **Configuration Management:** Professional YAML editor (Monaco Editor) with syntax highlighting, atomic writes, and audit logging.
- **Profiles Manager:** CRUD operations for agent profiles and interactive editing of `SOUL.md` files.
- **Security:** Strict HTTP Basic Auth across all routes, including WebSockets and SSE.

## Quick Start

### 1. Prerequisites
- Docker and Docker Compose
- Or Node.js 20+

### 2. Using Docker Compose (Recommended)
```bash
docker-compose up -d
```
Access the UI at [http://localhost:3000](http://localhost:3000)
- **Username:** `admin`
- **Password:** `hermes_secret`

### 3. Local Development
```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_password
npm install
npm start
```

## Architecture

- **Backend:** Node.js Express server (`server/index.js`).
- **Frontend:** Vanilla JavaScript/HTML/CSS with Monaco Editor and xterm.js via CDN.
- **Storage:** All runtime data (configs, profiles, audit logs) is persisted in the `/data` directory (mounted volume in Docker).
- **Atomic Writes:** Configuration and SOUL.md files are saved using a temporary file + rename pattern to ensure reliability.

## Security Policy

- **Authentication:** Single realm Basic Auth. Fail-fast if credentials are not provided via environment variables.
- **Data Isolation:** All profile operations are sanitized to prevent directory traversal attacks.
- **Secrets:** Secret masking in the YAML editor is a planned enhancement requiring a JSON Schema for the configuration.

## License
MIT
