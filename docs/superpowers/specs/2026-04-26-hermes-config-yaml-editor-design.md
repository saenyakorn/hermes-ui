# Hermes Config YAML Editor Design

Date: 2026-04-26

## Goal

Add an authenticated YAML editor for the Hermes runtime config at `data/config.yaml`.

The first version should let an operator:

- View and edit `data/config.yaml` from the existing dashboard.
- Create a minimal starter config automatically when the file is missing.
- Validate YAML syntax and basic known Hermes config fields before saving.
- Save the file atomically.
- Automatically restart the managed Hermes gateway after a successful save when it was already running.

Editing environment variables, profile files, and `SOUL.md` is out of scope.

## Architecture

Add a focused backend-owned configuration subsystem.

`ConfigStore` owns all filesystem and validation behavior for `data/config.yaml`. It should live under `src/server/services/` and be instantiated by `createRuntime()` beside `GatewayManager`, `LogStore`, and `TerminalManager`.

Responsibilities:

- Resolve only the fixed config path under `data/config.yaml`.
- Ensure a starter config exists before the first read.
- Read config text and file metadata.
- Parse YAML and run basic schema validation.
- Write valid config updates atomically with a temporary file and rename.
- Return typed results for route handlers and tests.
- Emit audit-style log entries for creation, save, validation failure, and restart attempts.

`createApp()` receives the config service through `AppServices`. Route handlers stay thin and orchestrate config saves with gateway restart behavior.

## Routes

All config routes require the existing Basic Auth middleware.

- `GET /config`: returns the current config text, file path, last modified time when available, and validation status.
- `POST /config`: accepts YAML text, validates it, writes it atomically, and restarts the gateway if it was running before the save.

The `POST /config` response should distinguish:

- save success or failure
- validation errors
- whether restart was attempted
- restart success or failure
- resulting gateway status

## Config File Behavior

The editor targets exactly one file:

```text
data/config.yaml
```

If the file does not exist, `ConfigStore` creates a minimal starter config automatically before returning content to the UI. The starter config should be an empty YAML mapping with comments, so it is valid and does not invent Hermes options:

```yaml
# Hermes Agent config
# Add Hermes settings here.
{}
```

Config writes must be atomic:

1. Write the new YAML to a temporary file in the same directory.
2. Rename the temporary file over `data/config.yaml`.
3. Clean up the temporary file if a write fails before rename when possible.

Invalid YAML or schema validation errors must not modify the existing file.

## Save And Restart Flow

Save flow:

1. Browser submits YAML text to `POST /config`.
2. Server parses YAML.
3. Server validates known Hermes fields while allowing unknown keys.
4. If validation fails, return errors and leave the file unchanged.
5. If validation passes, write `data/config.yaml` atomically.
6. If the gateway was `running` before the save, automatically call `gateway.restart()`.
7. Return save result, restart result, and gateway status.

If gateway restart fails after a successful save, the saved config remains in place. The response should clearly report that save succeeded and restart failed.

Saving while the gateway is stopped must not start it.

## Validation

Validation has two layers:

- YAML syntax validation rejects malformed YAML before any write.
- Basic schema validation requires the YAML document root to be a mapping and checks documented Hermes top-level fields where safe expectations are known, while allowing unknown keys for forward compatibility.

The implementation should avoid a strict full schema until the Hermes config contract is fully documented. Basic validation is intended to catch obvious operator mistakes, such as a scalar or list root document, without blocking new Hermes config options.

Validation errors should be returned as plain operator-facing messages that can be rendered inline in the editor panel.

## UI

Add a `Hermes Config` panel to the existing dark operational dashboard.

The panel should include:

- File label for `data/config.yaml`.
- Last saved or last modified time when available.
- Monaco Editor configured for YAML syntax highlighting and a dark theme.
- `Save config` action, enabled only when editor content has unsaved changes.
- `Reload from disk` action that discards local unsaved edits after confirmation.
- Status strip for clean, dirty, saving, saved, validation error, and restart result states.
- Inline validation and save/restart error messages.

The server-rendered dashboard should provide the editor container. The client bundle initializes Monaco, loads config via `GET /config`, tracks dirty state, and saves via `POST /config`.

Monaco is intentionally part of this feature for a proper YAML text-editor experience. Keep the integration scoped to the config editor and avoid broad client-side framework changes.

## Error Handling

Expected error cases:

- Missing config file: create starter config and return it.
- Malformed YAML: reject save, preserve existing file, show parse error.
- Invalid known schema field: reject save, preserve existing file, show validation error.
- File read failure: return an operator-facing error.
- File write failure: return an operator-facing error and do not restart gateway.
- Gateway restart failure after save: preserve saved config and report restart failure separately.
- Reload conflict with unsaved edits: require browser confirmation before discarding local content.

Save failures and validation failures must not restart the gateway.

## Testing

Add focused coverage for:

- Missing `data/config.yaml` creates starter config.
- `GET /config` returns content and metadata.
- Basic Auth protects config routes.
- `POST /config` rejects malformed YAML without writing.
- `POST /config` rejects invalid known schema values without writing.
- Valid save writes atomically.
- Running gateway is restarted after a valid save.
- Stopped gateway is not started by saving config.
- Restart failure is surfaced while preserving the saved config.
- Client-side dirty state and save/reload behavior where practical.

Required verification commands:

```bash
npm run typecheck
npm run build
npm test
```

## Out Of Scope

- Editing environment variables.
- Editing profile YAML files.
- Editing `SOUL.md`.
- Multi-file config browsing.
- Strict full Hermes config schema.
- Persisting editor sessions across browser reloads.
- Replacing the dashboard with a frontend SPA framework.
