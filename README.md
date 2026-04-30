# Hermes Agent Control Plane

A production-ready control plane and web UI for Hermes Gateway operations, built with a Framer-inspired dark interface and practical day-to-day tooling for operators.

## Table of Contents

- [What you get](#what-you-get)
- [Product Tour](#product-tour)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Architecture Snapshot](#architecture-snapshot)
- [Security Notes](#security-notes)
- [License](#license)

## What you get

- Managed gateway lifecycle: start, stop, restart, and monitor status.
- Live observability via streaming logs and a browser-based interactive shell.
- Monaco-powered config editing for YAML, profile files, and env variables.
- Profile-centric workflows with active-profile switching and content editing.
- Basic Auth protection across HTTP, SSE, and WebSocket transport.

---

## Product Tour

### 1) Control Center

Operate the gateway process from a single dashboard with clear controls and runtime visibility.

![Gateway control center](docs/assets/control.png)

### 2) Configuration Editor

Edit gateway YAML safely in Monaco with syntax support and write flows designed for reliable persistence.

![Configuration editor](docs/assets/config.png)

### 3) Environment Variables

Manage persisted runtime environment values directly in the UI.

![Environment variables](docs/assets/env-var.png)

### 4) Interactive Shell

Use an in-browser terminal powered by xterm.js and a server-side PTY bridge.

![Interactive shell](docs/assets/interactive-shell.png)

### 5) Messaging Platform Setup

Configure messaging-related integrations from the same control plane.

![Messaging platform](docs/assets/messaging-platform.png)

### 6) Model Provider Configuration

Configure and manage model-provider settings in a dedicated workflow.

![Model providers](docs/assets/model-providers.png)

### 7) Profile Management

Create, clone, switch, and maintain profiles. The active profile re-targets config, env, messaging, and shell contexts to the selected `HERMES_HOME`.

![Profiles management](docs/assets/profiles.png)

---

## Quick Start

### Prerequisites

- Docker + Docker Compose, or
- Node.js 20.x (see `engines` in `package.json`)

### Docker Compose (recommended)

Create `docker-compose.yml` in the project root:

```yaml
services:
  hermes-agent:
    image: ghcr.io/saenyakorn/hermes-ui:latest
    container_name: hermes-agent
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: change_me
      PORT: 3000
      LOG_LEVEL: info
      HERMES_HOME: /app/data
    volumes:
      - ./data:/app/data
```

Then start the service:

```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

Default credentials in this example are `admin` / `change_me` (override with env vars).

Useful lifecycle commands:

```bash
docker-compose ps
docker-compose logs -f hermes-agent
docker-compose pull
docker-compose up -d
docker-compose down
```

### Run Prebuilt Image Locally (GHCR)

Tags:

- `ghcr.io/saenyakorn/hermes-ui:<version>` (tagged commit)
- `ghcr.io/saenyakorn/hermes-ui:<version>-<commit-sha>` (untagged commit)
- optional `ghcr.io/saenyakorn/hermes-ui:latest`

Example:

```bash
docker pull ghcr.io/saenyakorn/hermes-ui:0.0.0
docker run -d \
  --name hermes-ui \
  -p 3000:3000 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=change_me \
  -e PORT=3000 \
  -e LOG_LEVEL=info \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/saenyakorn/hermes-ui:0.0.0
```

Open [http://localhost:3000](http://localhost:3000).

### Local Development

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_password
export PORT=3000
npm install
npm run dev
```

### Local Production Simulation

```bash
npm install
npm run typecheck
npm run build
npm test
npm start
```

### Deploy on Railway (Using Published GHCR Image)

1. Create a new Railway project.
2. Add a new service from a container image.
3. Use image `ghcr.io/saenyakorn/hermes-ui:<tag>` (for example `ghcr.io/saenyakorn/hermes-ui:0.0.0`).
4. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (`PORT` is usually injected by Railway).
5. (Recommended) Add a persistent volume mounted at `/app/data` to keep profile/config state across restarts.
6. Deploy and open the generated Railway URL.

If your GHCR package is private, configure Railway registry credentials that can pull from `ghcr.io`.

---

## Environment Variables

### Application Variables

| Variable         | Required | Default | Description                                                          |
| ---------------- | -------- | ------- | -------------------------------------------------------------------- |
| `ADMIN_USERNAME` | Yes      | -       | Basic Auth username for HTTP/SSE/WebSocket access                    |
| `ADMIN_PASSWORD` | Yes      | -       | Basic Auth password for HTTP/SSE/WebSocket access                    |
| `PORT`           | No       | `3000`  | HTTP server port (must be 1-65535)                                   |
| `LOG_LEVEL`      | No       | `info`  | One of: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` |

Gateway health checks now use `hermes gateway status` output; `HERMES_GATEWAY_HEALTH_URL` is no longer used.

### Container Runtime Variables

| Variable         | Required | Default      | Description                                                                     |
| ---------------- | -------- | ------------ | ------------------------------------------------------------------------------- |
| `NODE_ENV`       | No       | `production` | Node runtime environment in the container image                                 |
| `HERMES_HOME`    | No       | `/app/data`  | Hermes runtime data directory inside the container                              |
| `ADMIN_USERNAME` | Yes      | -            | Required at runtime (set via Docker Compose, `docker run`, or cloud env config) |
| `ADMIN_PASSWORD` | Yes      | -            | Required at runtime (set via Docker Compose, `docker run`, or cloud env config) |

### Docker Build Argument

| Variable         | Required | Default | Description                                                                       |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------- |
| `HERMES_VERSION` | No       | `main`  | Hermes installer source ref used at image build time (branch, tag, or commit SHA) |

Example:

```bash
docker build --build-arg HERMES_VERSION=main -t ghcr.io/saenyakorn/hermes-ui:custom .
```

---

## Scripts

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start development server with watch         |
| `npm run build`     | Build server and client assets into `dist/` |
| `npm start`         | Run production entrypoint (`dist/index.js`) |
| `npm test`          | Run Vitest suite                            |
| `npm run typecheck` | Run TypeScript checks (`tsc --noEmit`)      |
| `npm run lint`      | Run Oxlint                                  |
| `npm run format`    | Run Oxfmt                                   |

---

## Architecture Snapshot

- Runtime: Node.js 20+ with [Hono](https://hono.dev/).
- UI: React 19 + TypeScript modules, Tailwind CSS, Monaco Editor, and xterm.js.
- Storage: Data persisted under `data/` locally (or `/app/data` in Docker).
- Reliability: Atomic temp-file + rename flows for sensitive writes (for example config and profile markdown files).

---

## Security Notes

- Basic Auth is enforced for HTTP routes, SSE streams, and WebSocket connections.
- Profile and filesystem input paths are sanitized to block traversal.
- Treat logs, profile content, and configuration as sensitive operational data.

---

## License

MIT
