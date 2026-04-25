# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Hermes Agent control plane, a Node.js/Express web UI for managing a Hermes gateway process.

- `package.json` defines the Node entry point as `server/index.js` and the available npm scripts.
- `server/` is the expected backend source location for Express routes, Socket.io, SSE, PTY handling, auth, and file persistence.
- Frontend assets are expected to be served by the Express app as simple HTML and CSS, with htmx for server-driven interactions.
- `.agents/skills/` contains Codex skill instructions used by agents working in this repo.
- `Dockerfile` and `docker-compose.yml` define the containerized runtime.
- `DESIGN.md` documents the dark Framer-inspired visual system.
- Runtime state should live in `data/` when mounted locally; do not commit secrets or generated runtime data.

## Build, Test, and Development Commands

Use npm as the package manager; this repo includes `package-lock.json`.

- `npm install` installs dependencies.
- `npm start` runs the production entry point with `node server/index.js`.
- `npm run dev` runs the same server through `nodemon` for local iteration.
- `docker-compose up -d` builds and starts the service on `http://localhost:3000`.

Required local environment variables:

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_password
export PORT=3000
```

## Coding Style & Naming Conventions

Use CommonJS JavaScript unless the project is explicitly migrated. Prefer small modules, clear route handlers, and explicit error handling. Use 2-space indentation, semicolons, and descriptive camelCase names for variables and functions. Keep server-only logic in `server/`; keep browser assets separate from process, filesystem, and authentication code.

Build UI with simple HTML and CSS. Use htmx attributes for dynamic server interactions instead of introducing a frontend framework. Keep client-side JavaScript minimal and only add it when htmx and server-rendered HTML are not enough.

For UI work, follow `DESIGN.md`: pure black surfaces, Framer Blue accents, restrained typography, and product-focused layouts. Avoid adding new visual systems without updating the design document.

## Testing Guidelines

No test script is currently defined. When adding behavior, add a focused test setup and wire it into `npm test`. Use `tests/` for integration tests and colocated `*.test.js` files for small units. Cover authentication, profile path sanitization, YAML writes, gateway process controls, WebSocket behavior, and SSE log streaming.

## Commit & Pull Request Guidelines

This checkout does not include Git history, so no existing commit convention is available. Use concise imperative commit messages such as `Add gateway restart endpoint` or `Fix profile path validation`.

Pull requests should include a short summary, validation steps run, linked issue when applicable, and screenshots or recordings for UI changes. Call out changes to auth, environment variables, Docker behavior, or persisted data paths.

## Security & Configuration Tips

Never commit `.env`, credentials, or generated `data/` contents. Keep Basic Auth enforced across HTTP, WebSocket, and SSE paths. Sanitize filesystem inputs before reading or writing profile files, and preserve atomic write behavior for YAML and `SOUL.md` updates.

@RTK.md
