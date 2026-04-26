import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/server/config/env";

describe("loadEnv", () => {
  it("loads valid env", () => {
    const env = loadEnv({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "secret",
      PORT: "3000",
    });

    expect(env).toEqual({
      adminUsername: "admin",
      adminPassword: "secret",
      logLevel: "info",
      port: 3000,
    });
  });

  it("loads valid log level", () => {
    const env = loadEnv({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "secret",
      LOG_LEVEL: "debug",
      PORT: "3000",
    });

    expect(env.logLevel).toBe("debug");
  });

  it("rejects missing credentials", () => {
    expect(() => loadEnv({ PORT: "3000" })).toThrow("Invalid environment");
  });

  it("rejects out-of-range port", () => {
    expect(() =>
      loadEnv({
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "secret",
        PORT: "70000",
      }),
    ).toThrow("Invalid environment");
  });

  it("rejects invalid log level", () => {
    expect(() =>
      loadEnv({
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "secret",
        LOG_LEVEL: "verbose",
        PORT: "3000",
      }),
    ).toThrow("Invalid environment");
  });
});
