# Hermes Agent Control Plane

A production-ready control plane and Web UI for the Hermes Agent, inspired by Framer's aesthetic.

## Features

- **Cinematic dark UI:** High-fidelity design system with absolute black canvas, electric blue accents, and refined typography ([DESIGN.md](DESIGN.md)).
- **Gateway management:** Start, stop, and restart the Hermes gateway as a managed child process.
- **Interactive terminal:** Browser terminal (xterm.js) bridged via Socket.io to a server-side PTY.
- **Live logs:** Real-time streaming of gateway stdout/stderr via Server-Sent Events (SSE).
- **Configuration:** YAML editing (Monaco) with syntax highlighting, atomic writes, and model/workspace-related helpers where configured.
- **Environment variables:** View and edit persisted env for the gateway from the UI.
- **Profiles:** CRUD for agent profiles via the `hermes profile` CLI (blank / `--clone` / `--clone-all`), an active-profile picker that re-points the gateway, config, env, messaging, and shell tabs at the selected `HERMES_HOME`, and Monaco editors for `SOUL.md`, `memories/MEMORY.md`, and `memories/USER.md`.
- **Security:** HTTP Basic Auth across HTTP routes, WebSockets, and SSE.

## Quick start

### Prerequisites

- Docker and Docker Compose, **or**
- Node.js 20.x (see `engines` in [package.json](package.json))

### Docker Compose (recommended)

```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

Default credentials from [docker-compose.yml](docker-compose.yml):

- **Username:** `admin`
- **Password:** `hermes_secret`

Override via `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Runtime state is mounted at `./data` → `/app/data` in the container (`HERMES_HOME=/app/data` in the image).

### Local development

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_password
export PORT=3000   # optional; defaults in code if unset
npm install
npm run dev
```

`npm run dev` runs the server from TypeScript with `tsx watch` (no separate `build` step).

### Production build (local)

```bash
npm install
npm run typecheck
npm run build
npm test
npm start
```

`npm start` runs `node dist/index.js`. The Docker image runs `typecheck`, `build`, and `tests` in the build stage before copying `dist/`.

## Scripts

| Command                           | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                     | Development server with watch                                      |
| `npm run build`                   | Bundle server + client, Tailwind, Monaco, htmx assets into `dist/` |
| `npm start`                       | Production entry (`dist/index.js`)                                 |
| `npm test`                        | Vitest test suite                                                  |
| `npm run typecheck`               | `tsc --noEmit`                                                     |
| `npm run lint` / `npm run format` | Oxlint / Oxfmt                                                     |

## Architecture

- **Runtime:** Node.js 20+ with [Hono](https://hono.dev/) (`src/server/app.tsx`, `src/server/index.ts`).
- **UI:** Server-rendered HTML with [htmx](https://htmx.org/), Tailwind CSS 4, small TypeScript client modules under `src/client/`, Monaco Editor and xterm.js (bundled or copied into `dist/assets/` at build time).
- **Storage:** Configs, profiles, audit logs, and session data under `data/` locally (or `/app/data` in Docker). Do not commit secrets or generated runtime data.
- **Atomic writes:** Configuration and `SOUL.md` updates use temp-file + rename where applicable.

## Security policy

- **Authentication:** Single-realm Basic Auth; configure credentials via environment variables.
- **Paths:** Profile and filesystem paths are sanitized to prevent directory traversal.
- **Secrets:** Treat UI and logs as sensitive; use strong passwords in production and rotate defaults from compose examples.

## License

MIT
