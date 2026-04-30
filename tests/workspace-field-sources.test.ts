import { describe, expect, it } from "vitest";
import type { EnvReadResult } from "../src/server/types";
import {
  resolveMessagingIntegrationFieldValues,
  resolveModelProviderIntegrationFieldValues,
} from "../src/client/hooks/useWorkspaceFieldSources";

function envWithEntries(entries: EnvReadResult["entries"]): EnvReadResult {
  return {
    path: "/tmp/.env",
    updatedAt: null,
    entries,
  };
}

describe("resolveModelProviderIntegrationFieldValues", () => {
  it("returns public value for masked text env fields", () => {
    const values = resolveModelProviderIntegrationFieldValues(
      envWithEntries([
        {
          key: "OPENROUTER_BASE_URL",
          maskedValue: "https://***",
          publicValue: "https://openrouter.example",
        },
      ]),
      null,
    );

    expect(values["model-provider-openrouter-base-url"]).toBe("https://openrouter.example");
  });
});

describe("resolveMessagingIntegrationFieldValues", () => {
  it("returns public value for discord allowed roles", () => {
    const values = resolveMessagingIntegrationFieldValues(
      envWithEntries([
        {
          key: "DISCORD_ALLOWED_ROLES",
          maskedValue: "role***",
          publicValue: "admin,moderator",
        },
      ]),
      null,
    );

    expect(values["discord-advanced-allowed-roles"]).toBe("admin,moderator");
  });
});
