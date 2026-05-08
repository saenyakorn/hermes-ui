import { describe, expect, it } from "vitest";
import {
  buildGatewayStatusArgs,
  checkGatewayHealth,
  type GatewayStatusRunner,
} from "../src/server/services/health";

describe("buildGatewayStatusArgs", () => {
  it("omits --profile for the default profile", () => {
    expect(buildGatewayStatusArgs(null)).toEqual(["gateway", "status"]);
  });

  it("prepends --profile <name> for named profiles", () => {
    expect(buildGatewayStatusArgs("alpha")).toEqual(["--profile", "alpha", "gateway", "status"]);
  });
});

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

    await expect(checkGatewayHealth(false, null, statusRunner)).resolves.toBe("unknown");
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

    await expect(checkGatewayHealth(true, null, statusRunner)).resolves.toBe("healthy");
  });

  it("forwards the profile flag to the runner", async () => {
    const seen: string[][] = [];
    const statusRunner: GatewayStatusRunner = async (_command, args) => {
      seen.push([...args]);
      return {
        timedOut: false,
        spawned: true,
        exitCode: 0,
        signal: null,
        stdout: "all checks passed",
        stderr: "",
      };
    };

    await checkGatewayHealth(true, "alpha", statusRunner);
    expect(seen[0]).toEqual(["--profile", "alpha", "gateway", "status"]);
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

    await expect(checkGatewayHealth(true, null, statusRunner)).resolves.toBe("unreachable");
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

    await expect(checkGatewayHealth(true, null, statusRunner)).resolves.toBe("unhealthy");
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

    await expect(checkGatewayHealth(true, null, statusRunner)).resolves.toBe("unreachable");
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

    await expect(checkGatewayHealth(true, null, statusRunner)).resolves.toBe("unknown");
  });
});
