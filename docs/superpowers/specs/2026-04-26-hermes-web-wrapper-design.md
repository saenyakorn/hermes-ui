# Hermes Web Wrapper Design

Date: 2026-04-26

## Goal

Build a web app wrapper for Hermes Agent that lets an authenticated operator manage the Hermes gateway process and use an interactive Hermes CLI session from the browser.

The first implementation should include:

- Gateway controller for start, stop, restart, status, and health checks.
- Interactive terminal connected to a separate `hermes` CLI process.
- Persistent gateway logs under `data/logs/`.
- A dark Framer-inspired dashboard that follows `DESIGN.md`.

## Technology

- Runtime: Node.js.
- Language: TypeScript in strict mode.
- Type policy: no `any`.
- Web framework: Hono.
- UI rendering: Hono JSX / React-style server-rendered components.
- Component primitives: Base UI.
- Styling: Tailwind CSS v4, using tokens that match `DESIGN.md`.
- Bundler: Rolldown.
- Terminal bridge: Socket.io plus `node-pty`.
- Env validation: zod.
- App logging: pino.
- Date handling: dayjs.
- Package manager: npm.

## Architecture

`src/server/index.ts` boots a Node HTTP server, serves the Hono app, and attaches Socket.io to the same server.

Hono routes render the dashboard and API responses. UI components live under `src/server/ui/` and are composed with Hono JSX. Server process and infrastructure code stays outside route handlers under `src/server/services/`.

Core modules:

- `gateway-manager.ts`: owns the single managed `hermes gateway` process.
- `terminal-manager.ts`: owns per-socket interactive `hermes` PTY sessions.
- `log-store.ts`: appends and tails gateway log files.
- `auth.ts`: enforces Basic Auth for HTTP, static assets, SSE, and Socket.io.
- `env.ts`: validates environment variables with zod.
- `health.ts`: checks the gateway health endpoint.
- `logger.ts`: creates the pino logger.

Rolldown bundles the TypeScript server into `dist/index.js`. `npm start` should run the bundled output. `npm run build`, `npm run typecheck`, and `npm test` should be available.

## Docker

Dockerfile and Compose remain first-class runtime paths.

The Dockerfile must:

- Install dependencies with npm.
- Build the TypeScript/Rolldown output.
- Run `node dist/index.js`.
- Preserve `PORT` behavior.
- Preserve `/app/data` as mounted runtime state.
- Include native build/runtime support needed by `node-pty`.
- Fail clearly if the `hermes` CLI is not available in the container.

`docker-compose.yml` should expose the web app on `http://localhost:3000` and mount runtime data to `/app/data`.

## Gateway Controller

The gateway controller manages exactly one service process.

Command:

```bash
hermes gateway
```

Working directory:

```bash
data/
```

State model:

- `stopped`
- `starting`
- `running`
- `stopping`
- `crashed`

Actions:

- `start`: spawn `hermes gateway` in `data/` when no managed gateway is running.
- `stop`: send a graceful signal, then force kill after a timeout.
- `restart`: stop the current managed process, then start a new one.
- `status`: return state, pid, started time, exit code, last error, cwd, and health state.

Safety rules:

- Reject duplicate starts with current pid and state.
- Stopping an already stopped gateway returns current state and does not crash.
- Crashes update state to `crashed` and preserve exit details.
- Missing `hermes` binary returns an actionable error in the UI and logs through pino.

## Health Check

Health checks use the fixed endpoint:

```text
http://127.0.0.1:8080/health
```

Health values:

- `healthy`: endpoint returns 2xx.
- `unhealthy`: endpoint responds with non-2xx.
- `unreachable`: request fails or times out.
- `unknown`: gateway is not running.

Health failures should not kill the gateway process. They only update status and logs.

## Interactive CLI

The interactive terminal is separate from the gateway controller.

Command:

```bash
hermes
```

Working directory:

```bash
data/
```

Behavior:

- Each browser terminal session spawns a `node-pty` process running `hermes`.
- The terminal does not attach to the managed `hermes gateway` process.
- The gateway process and terminal process may run at the same time.
- Multiple browser tabs may each create their own PTY session.
- Socket disconnect kills that socket's PTY after a short grace period.
- Missing `hermes` binary prints a clear terminal error and exits the PTY session.

Socket.io events:

- `terminal:start`: create PTY.
- `terminal:input`: write browser input to PTY.
- `terminal:resize`: update PTY dimensions.
- `terminal:output`: stream PTY output to the browser.
- `terminal:exit`: notify browser of PTY exit.

Terminal output is not persisted by default. Gateway logs are persisted.

## Authentication

Basic Auth protects every route and connection.

Protected surfaces:

- Dashboard HTML.
- Static assets under `/assets/*`.
- Gateway status, health, and action routes.
- Log tail route.
- SSE log stream.
- Socket.io handshake.

The app must fail boot when `ADMIN_USERNAME` or `ADMIN_PASSWORD` is missing or invalid. Socket.io must reject unauthenticated clients before spawning any PTY process.

Environment variables:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `PORT`

The env schema must be implemented with zod.

## Routes

HTTP routes:

- `GET /`: render dashboard.
- `GET /gateway/status`: return gateway status JSON.
- `POST /gateway/start`: start managed gateway.
- `POST /gateway/stop`: stop managed gateway.
- `POST /gateway/restart`: restart managed gateway.
- `GET /gateway/health`: check the fixed health endpoint.
- `GET /logs/tail`: return recent persisted gateway log lines.
- `GET /logs/stream`: stream gateway logs with SSE.
- `GET /assets/*`: serve compiled static assets.

All routes require Basic Auth.

## Logs

Gateway stdout, stderr, and lifecycle events persist to:

```text
data/logs/YYYY-MM-DD.log
```

Use dayjs for date formatting. Include timestamps on log entries. Log these events:

- gateway start
- gateway stop
- gateway restart
- gateway crash
- stdout/stderr lines
- health failures
- log write warnings

If a log write fails, keep the process running, emit a pino warning, and surface the warning in status/UI.

## UI

First screen is the product UI, not a marketing page.

Layout:

- Left panel: gateway status, health, actions, process details, and recent gateway log tail.
- Right panel: interactive terminal running `hermes`.

Left panel content:

- Gateway process state badge.
- Health state badge.
- Start, Stop, Restart controls.
- pid, uptime, cwd, health URL, last exit code, and last error.
- Recent gateway logs from persisted file.

Right panel content:

- Terminal surface.
- Connection state: connected, reconnecting, disconnected.
- Minimal controls: reconnect and clear terminal.

Design rules:

- Follow `DESIGN.md`.
- Pure black page surfaces.
- Framer Blue for focus, rings, and interactive accents.
- Muted silver for secondary text.
- Dense operational layout, no landing hero.
- Use Base UI primitives wrapped in local components and styled with Tailwind v4.
- Keep browser JavaScript limited to terminal socket behavior, status refresh, and action feedback.

## Error Handling

Expected errors should produce clear operator-facing messages and structured pino logs.

Cases:

- Invalid env: fail boot with zod validation output.
- Missing `hermes`: action returns error; terminal prints error.
- Duplicate gateway start: reject with current process state.
- Stop while stopped: return current state.
- Health timeout: mark `unreachable`.
- Health non-2xx: mark `unhealthy`.
- Log write failure: warn and continue.
- PTY exit: show exit code and allow reconnect.

## Testing

Add a focused test setup and wire it into `npm test`.

Required checks:

```bash
npm run typecheck
npm run build
npm test
```

Test coverage:

- zod env validation.
- Basic Auth enforcement for HTTP routes.
- Socket.io auth rejection before PTY spawn.
- Gateway state transitions.
- Duplicate start rejection.
- Stop while stopped behavior.
- Health check state mapping.
- dayjs log filename formatting.
- Log append and tail behavior.
- Hono route behavior with mocked services.

Run Docker build verification when Docker is available.

## Out Of Scope

- Profile management.
- YAML editor.
- `SOUL.md` editing.
- Persisting terminal sessions.
- Multiple managed gateway processes.
- Runtime editing of health endpoint.
- Frontend SPA framework.
