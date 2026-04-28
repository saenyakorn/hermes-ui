import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfileResolver } from "../src/server/services/paths";
import { ProfileSessionsStore } from "../src/server/services/profile-sessions";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-sessions-"));
  await mkdir(path.join(rootDir, "data", "profiles"), { recursive: true });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createStore(): { resolver: ProfileResolver; sessions: ProfileSessionsStore } {
  const resolver = new ProfileResolver(rootDir);
  return {
    resolver,
    sessions: new ProfileSessionsStore(resolver, () => "2026-04-29T00:00:00.000Z"),
  };
}

describe("ProfileSessionsStore", () => {
  it("creates, lists, and reads profile-scoped sessions", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const { resolver, sessions } = createStore();
    await resolver.initialize();

    const created = await sessions.create("coder", { name: "Sprint planning" });
    expect(created.session.profile).toBe("coder");
    expect(created.session.name).toBe("Sprint planning");
    expect(created.session.archived).toBe(false);

    const list = await sessions.list("coder");
    expect(list.profile).toBe("coder");
    expect(list.sessions).toHaveLength(1);
    expect(list.sessions[0]?.id).toBe(created.session.id);

    const detail = await sessions.get("coder", created.session.id);
    expect(detail.session.id).toBe(created.session.id);
    expect(detail.session.archived).toBe(false);
  });

  it("supports rename + archive + restore + delete", async () => {
    const { resolver, sessions } = createStore();
    await resolver.initialize();

    const created = await sessions.create(null, { name: "Default workspace" });
    const id = created.session.id;

    const renamed = await sessions.rename(null, id, { name: "Renamed workspace" });
    expect(renamed.session.name).toBe("Renamed workspace");

    const archived = await sessions.archive(null, id);
    expect(archived.session.archived).toBe(true);

    const restored = await sessions.restore(null, id);
    expect(restored.session.archived).toBe(false);

    const deleted = await sessions.remove(null, id);
    expect(deleted.deleted).toBe(true);

    const listAfterDelete = await sessions.list(null);
    expect(listAfterDelete.sessions).toHaveLength(0);
  });

  it("isolates default and named profile session spaces", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "ops"), { recursive: true });
    const { resolver, sessions } = createStore();
    await resolver.initialize();

    await sessions.create(null, { name: "Default Session" });
    await sessions.create("ops", { name: "Ops Session" });

    const defaultList = await sessions.list(null);
    const opsList = await sessions.list("ops");

    expect(defaultList.sessions).toHaveLength(1);
    expect(defaultList.sessions[0]?.name).toBe("Default Session");
    expect(opsList.sessions).toHaveLength(1);
    expect(opsList.sessions[0]?.name).toBe("Ops Session");
  });
});
