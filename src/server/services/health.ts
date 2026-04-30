import { spawn } from "node:child_process";
import type { GatewayHealthState } from "../types";

const GATEWAY_STATUS_TIMEOUT_MS = 5_000;
const GATEWAY_STATUS_ARGS = ["gateway", "status"] as const;

export type GatewayStatusRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<{
  timedOut: boolean;
  spawned: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

const defaultGatewayStatusRunner: GatewayStatusRunner = (command, args, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let done = false;
    let timedOut = false;
    let spawned = false;
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    timeout.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    const finalize = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (done) {
        return;
      }
      done = true;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
      resolve({
        timedOut,
        spawned,
        exitCode,
        signal,
        stdout,
        stderr,
      });
    };

    child.on("spawn", () => {
      spawned = true;
    });

    child.on("error", (error: Error) => {
      stderr += `${error.message}\n`;
      finalize(null, null);
    });

    child.on("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
      finalize(exitCode, signal);
    });
  });

export async function checkGatewayHealth(
  gatewayRunning: boolean,
  statusRunner: GatewayStatusRunner = defaultGatewayStatusRunner,
): Promise<GatewayHealthState> {
  if (!gatewayRunning) {
    return "unknown";
  }

  const result = await statusRunner("hermes", GATEWAY_STATUS_ARGS, GATEWAY_STATUS_TIMEOUT_MS);
  return classifyGatewayStatusResult(result);
}

function classifyGatewayStatusResult(result: {
  timedOut: boolean;
  spawned: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}): GatewayHealthState {
  if (!result.spawned) {
    return "unknown";
  }

  if (result.timedOut) {
    return "unreachable";
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (containsUnreachableSignal(combinedOutput)) {
    return "unreachable";
  }

  if (containsUnhealthySignal(combinedOutput)) {
    return "unhealthy";
  }

  if (result.exitCode === 0 || containsHealthySignal(combinedOutput)) {
    return "healthy";
  }

  return "unhealthy";
}

function containsUnreachableSignal(output: string): boolean {
  return (
    output.includes("econnrefused") ||
    output.includes("connection refused") ||
    output.includes("timed out") ||
    output.includes("timeout") ||
    output.includes("unable to connect") ||
    output.includes("network is unreachable")
  );
}

function containsUnhealthySignal(output: string): boolean {
  return (
    output.includes("error") ||
    output.includes("failed") ||
    output.includes("invalid") ||
    output.includes("unhealthy")
  );
}

function containsHealthySignal(output: string): boolean {
  return (
    output.includes("ok") || output.includes("healthy") || output.includes("all checks passed")
  );
}
