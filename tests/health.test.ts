import { describe, expect, it } from "vitest";
import { checkGatewayHealth, type GatewayStatusRunner } from "../src/server/services/health";

describe("checkGatewayHealth", () => {
  it("returns unknown when gateway is not running", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: false,
      spawned: true,
      exitCode: 0,
      signal: null,
      stdout: "all checks passed",
      stderr: "",
    });

    await expect(checkGatewayHealth(false, statusRunner)).resolves.toBe("unknown");
  });

  it("returns healthy when gateway status exits cleanly", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: false,
      spawned: true,
      exitCode: 0,
      signal: null,
      stdout: "all checks passed",
      stderr: "",
    });

    await expect(checkGatewayHealth(true, statusRunner)).resolves.toBe("healthy");
  });

  it("returns unreachable when gateway status output indicates connectivity failure", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: false,
      spawned: true,
      exitCode: 1,
      signal: null,
      stdout: "",
      stderr: "connection refused while contacting gateway",
    });

    await expect(checkGatewayHealth(true, statusRunner)).resolves.toBe("unreachable");
  });

  it("returns unhealthy for gateway status reported failures", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: false,
      spawned: true,
      exitCode: 2,
      signal: null,
      stdout: "failed to validate config",
      stderr: "",
    });

    await expect(checkGatewayHealth(true, statusRunner)).resolves.toBe("unhealthy");
  });

  it("returns unreachable when gateway status times out", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: true,
      spawned: true,
      exitCode: null,
      signal: "SIGKILL",
      stdout: "",
      stderr: "",
    });

    await expect(checkGatewayHealth(true, statusRunner)).resolves.toBe("unreachable");
  });

  it("returns unknown when gateway status cannot be spawned", async () => {
    const statusRunner: GatewayStatusRunner = async () => ({
      timedOut: false,
      spawned: false,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "spawn hermes ENOENT",
    });

    await expect(checkGatewayHealth(true, statusRunner)).resolves.toBe("unknown");
  });
});
