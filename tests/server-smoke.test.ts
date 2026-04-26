import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { DEFAULT_HERMES_CONFIG_YAML } from "../src/server/config/default-hermes-config";
import { createRuntime, initializeRuntimeFilesystem } from "../src/server/index";

describe("createRuntime", () => {
  it("creates runtime services", () => {
    const runtime = createRuntime(
      {
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "secret",
        PORT: "3000",
      },
      "/repo",
    );

    expect(runtime.env.port).toBe(3000);
    expect(runtime.paths.dataDir).toBe("/repo/data");
  });

  it("creates starter config during startup initialization", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-startup-"));
    try {
      const runtime = createRuntime(
        {
          ADMIN_USERNAME: "admin",
          ADMIN_PASSWORD: "secret",
          PORT: "3000",
        },
        rootDir,
      );

      await initializeRuntimeFilesystem(runtime);

      await expect(readFile(path.join(runtime.paths.dataDir, "config.yaml"), "utf8")).resolves.toBe(
        DEFAULT_HERMES_CONFIG_YAML,
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
