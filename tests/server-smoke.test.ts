import { describe, expect, it } from "vitest";
import { createRuntime } from "../src/server/index";

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
});
