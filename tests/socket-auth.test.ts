import { describe, expect, it } from "vitest";
import { isSocketAuthorized } from "../src/server/socket";

type Handshake = {
  headers: Record<string, string | string[] | undefined>;
  auth?: Record<string, unknown>;
};

describe("isSocketAuthorized", () => {
  it("accepts an authorization header", () => {
    const handshake: Handshake = {
      headers: {
        authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
      },
    };

    const authorized = isSocketAuthorized(handshake, "admin", "secret");

    expect(authorized).toBe(true);
  });

  it("accepts socket auth payload token when header is missing", () => {
    const handshake: Handshake = {
      headers: {},
      auth: {
        token: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
      },
    };

    const authorized = isSocketAuthorized(handshake, "admin", "secret");

    expect(authorized).toBe(true);
  });

  it("rejects invalid auth payload token", () => {
    const handshake: Handshake = {
      headers: {},
      auth: {
        token: `Basic ${Buffer.from("admin:wrong").toString("base64")}`,
      },
    };

    const authorized = isSocketAuthorized(handshake, "admin", "secret");

    expect(authorized).toBe(false);
  });
});
