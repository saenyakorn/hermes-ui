import { describe, expect, it } from "vitest";
import { checkGatewayHealth } from "../src/server/services/health";

describe("checkGatewayHealth", () => {
  it("returns unknown when gateway is not running", async () => {
    await expect(
      checkGatewayHealth(false, async () => new Response(null, { status: 200 })),
    ).resolves.toBe("unknown");
  });

  it("returns healthy for 2xx response", async () => {
    await expect(
      checkGatewayHealth(true, async () => new Response(null, { status: 204 })),
    ).resolves.toBe("healthy");
  });

  it("returns unhealthy for non-2xx response", async () => {
    await expect(
      checkGatewayHealth(true, async () => new Response(null, { status: 500 })),
    ).resolves.toBe("unhealthy");
  });

  it("returns unreachable when fetch throws", async () => {
    await expect(
      checkGatewayHealth(true, async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).resolves.toBe("unreachable");
  });
});
