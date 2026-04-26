# Hermes Config YAML Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated Monaco-powered YAML editor for `data/config.yaml` with atomic saves, basic validation, and automatic gateway restart after valid saves when the gateway is running.

**Architecture:** Add a focused `ConfigStore` service that owns all `data/config.yaml` filesystem and validation behavior. Expose thin Hono routes for config read/save and orchestrate gateway restart in the route after a successful save. Extend the existing server-rendered dashboard with a Monaco editor panel initialized by the client bundle.

**Tech Stack:** TypeScript strict mode, Hono, React server-rendered components, zod, `yaml`, `@monaco-editor/loader`, `monaco-editor`, Vitest, npm.

---

## Scope Check

The approved spec covers one subsystem: editing the fixed Hermes runtime config file at `data/config.yaml`. Env editing, profile files, `SOUL.md`, multi-file browsing, and a strict full Hermes schema remain out of scope.

## File Structure

- Create `src/server/services/config-store.ts`: fixed-path config file service, starter creation, YAML parsing, root mapping validation, atomic write, metadata, audit log calls.
- Modify `src/server/types.ts`: shared API response types for config read/save and validation errors.
- Modify `src/server/app.tsx`: add `AppConfig` service contract, config routes, request parsing, save-and-restart orchestration.
- Modify `src/server/index.ts`: instantiate `ConfigStore` and pass it to `createApp()`.
- Modify `src/server/ui/dashboard.tsx`: add `Hermes Config` panel with editor mount, actions, and status elements.
- Modify `src/server/ui/layout.tsx`: keep existing assets; add no global framework.
- Modify `src/client/main.ts`: load Monaco through `@monaco-editor/loader`, fetch config, track dirty state, save, reload, and render status/errors.
- Modify `rolldown.config.ts`: keep `main` and `terminal` browser entries; no worker bundling required when Monaco is loaded by loader.
- Modify `package.json` and `package-lock.json`: add `yaml`, `@monaco-editor/loader`, and `monaco-editor`.
- Create `tests/config-store.test.ts`: service-level config behavior.
- Modify `tests/app-routes.test.ts`: route-level config auth/save/restart behavior.

## Task 1: Add Dependencies

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
npm install yaml @monaco-editor/loader monaco-editor
```

Expected: `package.json` and `package-lock.json` include the new dependencies.

- [ ] **Step 2: Verify dependency install**

Run:

```bash
npm run typecheck
```

Expected: typecheck may still pass because no code imports the dependencies yet. If existing unrelated dirty changes cause failures, record the failure output before proceeding and do not modify unrelated files.

- [ ] **Step 3: Commit dependency change**

```bash
git add package.json package-lock.json
git commit -m "chore: add config editor dependencies"
```

## Task 2: Define Config API Types

**Files:**

- Modify: `src/server/types.ts`

- [ ] **Step 1: Add shared config response types**

Append these exports to `src/server/types.ts`:

```ts
export type ConfigValidationIssue = {
  message: string;
  path: string | null;
};

export type ConfigReadResult = {
  path: string;
  content: string;
  updatedAt: string | null;
  validation: {
    ok: boolean;
    issues: ConfigValidationIssue[];
  };
};

export type ConfigSaveResult = ConfigReadResult & {
  saved: boolean;
};

export type ConfigSaveResponse = {
  config: ConfigSaveResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit type definitions**

```bash
git add src/server/types.ts
git commit -m "feat: add config api types"
```

## Task 3: Build ConfigStore With TDD

**Files:**

- Create: `src/server/services/config-store.ts`
- Create: `tests/config-store.test.ts`

- [ ] **Step 1: Write failing tests for config creation, read, validation, and save**

Create `tests/config-store.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigStore } from "../src/server/services/config-store";
import { LogStore } from "../src/server/services/log-store";

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-config-store-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function createStore(): ConfigStore {
  const logs = new LogStore(path.join(tmpDir, "logs"), () => "2026-04-26T10:30:00.000Z");
  return new ConfigStore(tmpDir, logs, () => "2026-04-26T10:30:00.000Z");
}

describe("ConfigStore", () => {
  it("creates a starter config when config.yaml is missing", async () => {
    const store = createStore();

    const result = await store.read();

    expect(result.path).toBe("data/config.yaml");
    expect(result.content).toContain("# Hermes Agent config");
    expect(result.content).toContain("{}");
    expect(result.updatedAt).not.toBeNull();
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(result.content);
  });

  it("reads existing config content and metadata", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway:\n  host: 127.0.0.1\n");
    const store = createStore();

    const result = await store.read();

    expect(result.content).toBe("gateway:\n  host: 127.0.0.1\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    expect(result.updatedAt).not.toBeNull();
  });

  it("rejects malformed YAML without writing", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save("gateway:\n  - [broken");

    expect(result.saved).toBe(false);
    expect(result.validation.ok).toBe(false);
    expect(result.validation.issues[0]?.message).toContain("YAML");
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe("gateway: {}\n");
  });

  it("rejects non-mapping YAML without writing", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save("- invalid\n- root\n");

    expect(result.saved).toBe(false);
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe("gateway: {}\n");
  });

  it("writes valid config atomically", async () => {
    const store = createStore();

    const result = await store.save("gateway:\n  port: 8080\n");

    expect(result.saved).toBe(true);
    expect(result.content).toBe("gateway:\n  port: 8080\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway:\n  port: 8080\n",
    );
  });

  it("allows unknown top-level keys for forward compatibility", async () => {
    const store = createStore();

    const result = await store.save("futureHermesOption:\n  enabled: true\n");

    expect(result.saved).toBe(true);
    expect(result.validation.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/config-store.test.ts
```

Expected: FAIL with an import error because `src/server/services/config-store.ts` does not exist.

- [ ] **Step 3: Implement ConfigStore**

Create `src/server/services/config-store.ts`:

```ts
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import type { ConfigReadResult, ConfigSaveResult, ConfigValidationIssue } from "../types";
import type { LogStore } from "./log-store";

const STARTER_CONFIG = "# Hermes Agent config\n# Add Hermes settings here.\n{}\n";
const CONFIG_FILE_NAME = "config.yaml";

export class ConfigStore {
  constructor(
    private readonly dataDir: string,
    private readonly logs: LogStore,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<ConfigReadResult> {
    await this.ensureConfigFile();
    const content = await readFile(this.getConfigPath(), "utf8");
    const metadata = await stat(this.getConfigPath());

    return {
      path: "data/config.yaml",
      content,
      updatedAt: metadata.mtime.toISOString(),
      validation: this.validate(content),
    };
  }

  async save(content: string): Promise<ConfigSaveResult> {
    await this.ensureDataDir();
    const validation = this.validate(content);

    if (!validation.ok) {
      await this.logs.append("gateway", "Config validation failed");
      const current = await this.read();

      return {
        ...current,
        content,
        validation,
        saved: false,
      };
    }

    const temporaryPath = path.join(this.dataDir, `.config.yaml.${process.pid}.${Date.now()}.tmp`);

    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, this.getConfigPath());
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }

    await this.logs.append("gateway", "Config saved");
    const saved = await this.read();

    return {
      ...saved,
      saved: true,
    };
  }

  private async ensureConfigFile(): Promise<void> {
    await this.ensureDataDir();

    try {
      await stat(this.getConfigPath());
    } catch (cause: unknown) {
      if (!this.isMissingFileError(cause)) {
        throw cause;
      }

      await writeFile(this.getConfigPath(), STARTER_CONFIG, { flag: "wx" });
      await this.logs.append("gateway", "Created starter config at data/config.yaml");
    }
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private validate(content: string): { ok: boolean; issues: ConfigValidationIssue[] } {
    const document = parseDocument(content);
    const issues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    if (document.contents !== null && !isMap(document.contents)) {
      return {
        ok: false,
        issues: [{ message: "Config root must be a YAML mapping.", path: null }],
      };
    }

    return { ok: true, issues: [] };
  }

  private getConfigPath(): string {
    return path.join(this.dataDir, CONFIG_FILE_NAME);
  }

  private isMissingFileError(cause: unknown): boolean {
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- tests/config-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit ConfigStore**

```bash
git add src/server/services/config-store.ts tests/config-store.test.ts
git commit -m "feat: add hermes config store"
```

## Task 4: Add Config Routes And Restart Orchestration

**Files:**

- Modify: `src/server/app.tsx`
- Modify: `src/server/index.ts`
- Modify: `tests/app-routes.test.ts`

- [ ] **Step 1: Extend route tests for config read auth**

In `tests/app-routes.test.ts`, update imports:

```ts
import type { ConfigReadResult, ConfigSaveResult, GatewayStatus } from "../src/server/types";
```

Add helpers above `createServices()`:

```ts
const configRead: ConfigReadResult = {
  path: "data/config.yaml",
  content: "{}\n",
  updatedAt: "2026-04-26T10:30:00.000Z",
  validation: { ok: true, issues: [] },
};

const configSave: ConfigSaveResult = {
  ...configRead,
  saved: true,
};
```

Add `config` to the service object returned by `createServices()`:

```ts
config: {
  read: vi.fn(async () => configRead),
  save: vi.fn(async () => configSave),
},
```

Add route tests inside `describe("createApp", () => { ... })`:

```ts
it("requires basic auth for config", async () => {
  const response = await createApp(createServices()).request("/config");

  expect(response.status).toBe(401);
});

it("returns config JSON", async () => {
  const services = createServices();

  const response = await createApp(services).request("/config", {
    headers: { authorization: auth },
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(configRead);
  expect(services.config.read).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm test -- tests/app-routes.test.ts
```

Expected: FAIL because `AppServices` does not yet include `config` and `/config` is not implemented.

- [ ] **Step 3: Add app service contract and GET route**

In `src/server/app.tsx`, update the type import:

```ts
import type { AppEnv, ConfigReadResult, ConfigSaveResult, GatewayStatus, LogTail } from "./types";
```

Add this service type:

```ts
export type AppConfig = {
  read: () => Promise<ConfigReadResult>;
  save: (content: string) => Promise<ConfigSaveResult>;
};
```

Add `config` to `AppServices`:

```ts
export type AppServices = {
  env: AppEnv;
  gateway: AppGateway;
  logs: AppLogs;
  config: AppConfig;
};
```

Add the GET route after the gateway routes:

```ts
app.get("/config", async (context) => context.json(await services.config.read()));
```

- [ ] **Step 4: Instantiate ConfigStore in runtime**

In `src/server/index.ts`, import and instantiate `ConfigStore`:

```ts
import { ConfigStore } from "./services/config-store";
```

Inside `createRuntime()` after `logs`:

```ts
const config = new ConfigStore(paths.dataDir, logs);
```

Return it:

```ts
return {
  env,
  logger,
  paths,
  logs,
  config,
  gateway,
  terminals,
};
```

Pass it into `createApp()`:

```ts
const app = createApp({
  env: runtime.env,
  gateway: runtime.gateway,
  logs: runtime.logs,
  config: runtime.config,
});
```

- [ ] **Step 5: Run route tests**

Run:

```bash
npm test -- tests/app-routes.test.ts
```

Expected: PASS for existing tests and new GET config tests.

- [ ] **Step 6: Write failing POST tests for save, validation, and restart behavior**

Add these tests to `tests/app-routes.test.ts`:

```ts
it("saves config without starting a stopped gateway", async () => {
  const services = createServices();

  const response = await createApp(services).request("/config", {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ content: "gateway:\n  port: 8080\n" }),
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    config: { saved: true, content: "{}\n" },
    restart: { attempted: false, ok: true, error: null },
    gateway: { state: "stopped" },
  });
  expect(services.config.save).toHaveBeenCalledWith("gateway:\n  port: 8080\n");
  expect(services.gateway.restart).not.toHaveBeenCalled();
});

it("restarts a running gateway after saving config", async () => {
  const services = createServices();
  const runningStatus: GatewayStatus = {
    ...services.gateway.status(),
    state: "running",
    pid: 1234,
  };
  const restartedStatus: GatewayStatus = {
    ...runningStatus,
    pid: 5678,
  };
  services.gateway.status = vi.fn(() => runningStatus);
  services.gateway.restart = vi.fn(async () => restartedStatus);

  const response = await createApp(services).request("/config", {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ content: "{}\n" }),
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    restart: { attempted: true, ok: true, error: null },
    gateway: { state: "running", pid: 5678 },
  });
  expect(services.gateway.restart).toHaveBeenCalledTimes(1);
});

it("does not restart when config validation fails", async () => {
  const services = createServices();
  const invalidSave: ConfigSaveResult = {
    ...configRead,
    content: "- invalid\n",
    saved: false,
    validation: {
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    },
  };
  services.config.save = vi.fn(async () => invalidSave);

  const response = await createApp(services).request("/config", {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ content: "- invalid\n" }),
  });

  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toMatchObject({
    config: { saved: false, validation: { ok: false } },
    restart: { attempted: false, ok: true, error: null },
  });
  expect(services.gateway.restart).not.toHaveBeenCalled();
});

it("surfaces restart failure after a successful save", async () => {
  const services = createServices();
  const runningStatus: GatewayStatus = {
    ...services.gateway.status(),
    state: "running",
    pid: 1234,
  };
  const crashedStatus: GatewayStatus = {
    ...runningStatus,
    state: "crashed",
    pid: null,
    lastError: "spawn hermes ENOENT",
  };
  services.gateway.status = vi
    .fn()
    .mockReturnValueOnce(runningStatus)
    .mockReturnValue(crashedStatus);
  services.gateway.restart = vi.fn(async () => {
    throw new Error("spawn hermes ENOENT");
  });

  const response = await createApp(services).request("/config", {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: JSON.stringify({ content: "{}\n" }),
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    config: { saved: true },
    restart: { attempted: true, ok: false, error: "spawn hermes ENOENT" },
    gateway: { state: "crashed", lastError: "spawn hermes ENOENT" },
  });
});
```

- [ ] **Step 7: Implement POST route and helpers**

In `src/server/app.tsx`, add after `GET /config`:

```ts
app.post("/config", async (context) => {
  const body = (await context.req.json()) as { content?: unknown };

  if (typeof body.content !== "string") {
    return context.json({ error: "Expected JSON body with string content." }, 400);
  }

  const wasRunning = services.gateway.status().state === "running";
  const config = await services.config.save(body.content);
  const restart = {
    attempted: false,
    ok: true,
    error: null as string | null,
  };

  if (!config.saved) {
    return context.json(
      {
        config,
        restart,
        gateway: services.gateway.status(),
      },
      422,
    );
  }

  let gateway = services.gateway.status();

  if (wasRunning) {
    restart.attempted = true;

    try {
      gateway = await services.gateway.restart();
    } catch (cause: unknown) {
      restart.ok = false;
      restart.error = formatCause(cause);
      gateway = services.gateway.status();
    }
  }

  return context.json({
    config,
    restart,
    gateway,
  });
});
```

Add helper near `runGatewayAction()`:

```ts
function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}
```

- [ ] **Step 8: Run route tests**

Run:

```bash
npm test -- tests/app-routes.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit routes**

```bash
git add src/server/app.tsx src/server/index.ts tests/app-routes.test.ts
git commit -m "feat: add config routes"
```

## Task 5: Add Dashboard Config Panel

**Files:**

- Modify: `src/server/ui/dashboard.tsx`

- [ ] **Step 1: Add server-rendered editor panel markup**

Replace the current root grid in `Dashboard` with a layout that keeps gateway controls and terminal, then adds a config panel below them. The component should still accept only `{ status }`.

Use this full component body:

```tsx
export function Dashboard({ status }: { status: GatewayStatus }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-[420px_1fr]">
        <aside className="rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-5">
          <p className="text-xs uppercase text-[#a6a6a6]">Gateway</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
          <div
            id="gateway-status"
            className="mt-6 text-sm text-[#a6a6a6]"
            data-state={status.state}
          >
            State: <span className="text-white">{status.state}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              data-action="start"
              className="rounded-full bg-white px-4 py-2 text-sm text-black"
            >
              Start
            </Button>
            <Button
              data-action="stop"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
            >
              Stop
            </Button>
            <Button
              data-action="restart"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
            >
              Restart
            </Button>
          </div>
          <pre
            id="log-tail"
            className="mt-6 max-h-80 overflow-auto rounded-lg bg-black p-3 text-xs text-[#a6a6a6]"
          />
        </aside>

        <section className="grid min-h-screen grid-rows-[minmax(360px,1fr)_minmax(420px,0.9fr)] gap-4">
          <section className="rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[#a6a6a6]">Interactive shell</p>
              <Button
                id="terminal-clear"
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white"
              >
                Clear
              </Button>
            </div>
            <div id="terminal" className="h-full min-h-[320px] rounded-lg bg-black" />
          </section>

          <section className="rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-[#a6a6a6]">Hermes Config</p>
                <p id="config-path" className="mt-1 text-sm text-white">
                  data/config.yaml
                </p>
                <p id="config-updated-at" className="mt-1 text-xs text-[#a6a6a6]">
                  Loading config...
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  id="config-reload"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white"
                >
                  Reload from disk
                </Button>
                <Button
                  id="config-save"
                  disabled
                  className="rounded-full bg-white px-3 py-1 text-xs text-black"
                >
                  Save config
                </Button>
              </div>
            </div>
            <div
              id="config-editor"
              className="h-[330px] overflow-hidden rounded-lg border border-white/10 bg-black"
            />
            <div id="config-status" className="mt-3 text-xs text-[#a6a6a6]">
              Waiting for editor...
            </div>
            <div id="config-errors" className="mt-2 text-xs text-red-300" />
          </section>
        </section>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Build to verify JSX and Tailwind classes**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit dashboard markup**

```bash
git add src/server/ui/dashboard.tsx
git commit -m "feat: add config editor panel"
```

## Task 6: Implement Monaco Config Client

**Files:**

- Modify: `src/client/main.ts`

- [ ] **Step 1: Add client-side config types**

At the top of `src/client/main.ts`, add:

```ts
import loader from "@monaco-editor/loader";
import type { editor } from "monaco-editor";
```

Add these types after existing `LogTail`:

```ts
type ConfigValidationIssue = {
  message: string;
  path: string | null;
};

type ConfigReadResult = {
  path: string;
  content: string;
  updatedAt: string | null;
  validation: {
    ok: boolean;
    issues: ConfigValidationIssue[];
  };
};

type ConfigSaveResult = ConfigReadResult & {
  saved: boolean;
};

type ConfigSaveResponse = {
  config: ConfigSaveResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};
```

- [ ] **Step 2: Add editor state and rendering helpers**

Add below `fetchJson()`:

```ts
let configEditor: editor.IStandaloneCodeEditor | null = null;
let savedConfigContent = "";
let hasConfigLoaded = false;

function setText(selector: string, value: string): void {
  const target = document.querySelector<HTMLElement>(selector);

  if (target) {
    target.textContent = value;
  }
}

function renderConfigStatus(message: string): void {
  setText("#config-status", message);
}

function renderConfigErrors(issues: ConfigValidationIssue[]): void {
  const target = document.querySelector<HTMLElement>("#config-errors");
  if (!target) {
    return;
  }

  target.replaceChildren(
    ...issues.map((issue) => {
      const line = document.createElement("div");
      line.textContent = issue.path === null ? issue.message : `${issue.path}: ${issue.message}`;
      return line;
    }),
  );
}

function updateSaveButton(): void {
  const saveButton = document.querySelector<HTMLButtonElement>("#config-save");
  const currentValue = configEditor?.getValue() ?? "";

  if (!saveButton) {
    return;
  }

  saveButton.disabled = !hasConfigLoaded || currentValue === savedConfigContent;
}

function renderConfigMetadata(config: ConfigReadResult): void {
  setText("#config-path", config.path);
  setText(
    "#config-updated-at",
    config.updatedAt === null ? "Not saved yet" : `Last saved ${config.updatedAt}`,
  );
}
```

- [ ] **Step 3: Add load, save, reload, and Monaco init functions**

Add below the config helpers:

```ts
async function loadConfigFromDisk(): Promise<void> {
  const config = await fetchJson<ConfigReadResult>("/config");

  savedConfigContent = config.content;
  hasConfigLoaded = true;
  configEditor?.setValue(config.content);
  renderConfigMetadata(config);
  renderConfigErrors(config.validation.issues);
  renderConfigStatus(
    config.validation.ok ? "Config loaded." : "Config loaded with validation errors.",
  );
  updateSaveButton();
}

async function saveConfig(): Promise<void> {
  const saveButton = document.querySelector<HTMLButtonElement>("#config-save");
  const content = configEditor?.getValue();

  if (content === undefined) {
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
  }

  renderConfigStatus("Saving config...");

  try {
    const response = await fetchJson<ConfigSaveResponse>("/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });

    renderConfigMetadata(response.config);
    renderConfigErrors(response.config.validation.issues);
    renderStatus(response.gateway);

    if (!response.config.saved) {
      renderConfigStatus("Config validation failed. File was not changed.");
      return;
    }

    savedConfigContent = response.config.content;

    if (response.restart.attempted && response.restart.ok) {
      renderConfigStatus("Config saved. Gateway restarted.");
    } else if (response.restart.attempted) {
      renderConfigStatus(
        `Config saved. Gateway restart failed: ${response.restart.error ?? "unknown error"}`,
      );
    } else {
      renderConfigStatus("Config saved. Gateway was stopped, so no restart was needed.");
    }
  } catch (cause: unknown) {
    renderConfigStatus(cause instanceof Error ? cause.message : String(cause));
  } finally {
    updateSaveButton();
  }
}

async function reloadConfigWithConfirmation(): Promise<void> {
  const currentValue = configEditor?.getValue() ?? "";

  if (currentValue !== savedConfigContent && !window.confirm("Discard unsaved config changes?")) {
    return;
  }

  renderConfigStatus("Reloading config...");
  await loadConfigFromDisk();
}

async function initializeConfigEditor(): Promise<void> {
  const editorElement = document.querySelector<HTMLElement>("#config-editor");

  if (!editorElement) {
    return;
  }

  renderConfigStatus("Loading Monaco editor...");
  const monaco = await loader.init();

  configEditor = monaco.editor.create(editorElement, {
    value: "",
    language: "yaml",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    scrollBeyondLastLine: false,
  });

  configEditor.onDidChangeModelContent(() => {
    renderConfigErrors([]);
    renderConfigStatus(
      configEditor?.getValue() === savedConfigContent ? "No unsaved changes." : "Unsaved changes.",
    );
    updateSaveButton();
  });

  document.querySelector<HTMLButtonElement>("#config-save")?.addEventListener("click", () => {
    void saveConfig();
  });
  document.querySelector<HTMLButtonElement>("#config-reload")?.addEventListener("click", () => {
    void reloadConfigWithConfirmation();
  });

  await loadConfigFromDisk();
}
```

- [ ] **Step 4: Initialize config editor on page load**

At the bottom of `src/client/main.ts`, before `bindActions();`, add:

```ts
void initializeConfigEditor();
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If Monaco loader produces a bundling error, keep `@monaco-editor/loader` as the import path and adjust only the loader setup in `src/client/main.ts`; do not replace Monaco with a textarea.

- [ ] **Step 7: Commit client editor**

```bash
git add src/client/main.ts
git commit -m "feat: wire monaco config editor"
```

## Task 7: End-To-End Verification

**Files:**

- Verify: `src/server/services/config-store.ts`
- Verify: `src/server/app.tsx`
- Verify: `src/client/main.ts`
- Verify: `src/server/ui/dashboard.tsx`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/config-store.test.ts tests/app-routes.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/assets/main.js`, `dist/assets/terminal.js`, `dist/index.js`, and `dist/assets/app.css` are produced.

- [ ] **Step 5: Manual browser check**

Run:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=secret npm run dev
```

Open `http://localhost:3000` and verify:

- Basic Auth prompts for credentials.
- The dashboard loads with gateway, terminal, and `Hermes Config` panels.
- Monaco renders YAML syntax highlighting in the config panel.
- Missing `data/config.yaml` creates the starter config.
- Editing config enables `Save config`.
- Saving invalid YAML shows validation errors and does not overwrite the file.
- Saving `{}` succeeds.
- If the gateway is running, save attempts a restart and reports the restart result.
- If the gateway is stopped, save reports that no restart was needed.

- [ ] **Step 6: Commit final fixes if needed**

If verification required small fixes, commit only the files touched for those fixes:

```bash
git add src tests package.json package-lock.json rolldown.config.ts
git commit -m "fix: stabilize config editor"
```

If no fixes were required, skip this commit.

## Self-Review

- Spec coverage: The plan covers fixed `data/config.yaml`, starter creation, YAML/root mapping validation, atomic write, Basic Auth routes, automatic restart only when running, Monaco UI, errors, and verification.
- Placeholder scan: No incomplete implementation steps remain; each code-changing task includes concrete code or exact commands.
- Type consistency: Server and client config response names match: `ConfigReadResult`, `ConfigSaveResult`, `ConfigSaveResponse`, and `ConfigValidationIssue`.
