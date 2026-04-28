import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProfileSession,
  ProfileSessionCreateInput,
  ProfileSessionDeleteResult,
  ProfileSessionGetResult,
  ProfileSessionListResult,
  ProfileSessionRenameInput,
} from "../types";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

type SessionRecord = {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function validateSessionId(id: string): void {
  if (typeof id !== "string" || !SESSION_ID_PATTERN.test(id)) {
    throw new Error("Invalid session id.");
  }
}

function normalizeSessionName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Session name is required.");
  }
  if (trimmed.length > 120) {
    throw new Error("Session name must be 120 characters or less.");
  }
  return trimmed;
}

function getSessionDir(dataDir: string): string {
  return path.join(dataDir, "sessions");
}

function getSessionPath(dataDir: string, id: string): string {
  return path.join(getSessionDir(dataDir), `${id}.json`);
}

function toSession(profile: string | null, record: SessionRecord): ProfileSession {
  return { profile, ...record };
}

/**
 * Manages profile-scoped session metadata as JSON files under `<profile>/sessions/`.
 */
export class ProfileSessionsStore {
  constructor(
    private readonly resolver: ProfileResolver,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async list(profile: string | null): Promise<ProfileSessionListResult> {
    const dataDir = this.resolveProfileDataDir(profile);
    const sessionsDir = getSessionDir(dataDir);
    await mkdir(sessionsDir, { recursive: true });
    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: ProfileSession[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const id = entry.name.slice(0, -".json".length);
      if (!SESSION_ID_PATTERN.test(id)) {
        continue;
      }
      const session = await this.readRecord(profile, id).catch(() => null);
      if (session !== null) {
        sessions.push(session);
      }
    }
    sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return { profile, sessions };
  }

  async get(profile: string | null, id: string): Promise<ProfileSessionGetResult> {
    const dataDir = this.resolveProfileDataDir(profile);
    const { session, chat } = await this.readSessionDetail(dataDir, profile, id);
    return { profile, session: { ...session, chat } };
  }

  async create(
    profile: string | null,
    input: ProfileSessionCreateInput,
  ): Promise<ProfileSessionGetResult> {
    const dataDir = this.resolveProfileDataDir(profile);
    await mkdir(getSessionDir(dataDir), { recursive: true });
    const now = this.clock();
    const id = randomUUID().replace(/-/g, "");
    const name = normalizeSessionName(input.name);
    const record: SessionRecord = {
      id,
      name,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.writeRecord(dataDir, record);
    return { profile, session: { ...toSession(profile, record), chat: "" } };
  }

  async rename(
    profile: string | null,
    id: string,
    input: ProfileSessionRenameInput,
  ): Promise<ProfileSessionGetResult> {
    const dataDir = this.resolveProfileDataDir(profile);
    const current = await this.readRecordRaw(dataDir, id);
    const updated: SessionRecord = {
      ...current,
      name: normalizeSessionName(input.name),
      updatedAt: this.clock(),
    };
    await this.writeRecord(dataDir, updated);
    return { profile, session: { ...toSession(profile, updated), chat: "" } };
  }

  async archive(profile: string | null, id: string): Promise<ProfileSessionGetResult> {
    return { profile, session: { ...(await this.setArchived(profile, id, true)), chat: "" } };
  }

  async restore(profile: string | null, id: string): Promise<ProfileSessionGetResult> {
    return { profile, session: { ...(await this.setArchived(profile, id, false)), chat: "" } };
  }

  async remove(profile: string | null, id: string): Promise<ProfileSessionDeleteResult> {
    const dataDir = this.resolveProfileDataDir(profile);
    validateSessionId(id);
    await rm(getSessionPath(dataDir, id), { force: false });
    return { profile, id, deleted: true };
  }

  private async setArchived(
    profile: string | null,
    id: string,
    archived: boolean,
  ): Promise<ProfileSession> {
    const dataDir = this.resolveProfileDataDir(profile);
    const current = await this.readRecordRaw(dataDir, id);
    const updated: SessionRecord = {
      ...current,
      archived,
      updatedAt: this.clock(),
    };
    await this.writeRecord(dataDir, updated);
    return toSession(profile, updated);
  }

  private resolveProfileDataDir(profile: string | null): string {
    if (profile !== null) {
      validateProfileName(profile);
    }
    return this.resolver.resolveDataDir(profile);
  }

  private async readRecord(profile: string | null, id: string): Promise<ProfileSession> {
    const record = await this.readRecordRaw(this.resolveProfileDataDir(profile), id);
    return toSession(profile, record);
  }

  private async readSessionDetail(
    dataDir: string,
    profile: string | null,
    id: string,
  ): Promise<{ session: ProfileSession; chat: string }> {
    validateSessionId(id);
    const filePath = getSessionPath(dataDir, id);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionRecord> & {
      chat?: unknown;
      messages?: unknown;
    };
    const record = this.assertSessionRecord(id, parsed);
    const chat = this.extractChatText(parsed);
    return { session: toSession(profile, record), chat };
  }

  private async readRecordRaw(dataDir: string, id: string): Promise<SessionRecord> {
    validateSessionId(id);
    const filePath = getSessionPath(dataDir, id);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionRecord>;
    return this.assertSessionRecord(id, parsed);
  }

  private assertSessionRecord(id: string, parsed: Partial<SessionRecord>): SessionRecord {
    if (
      parsed.id !== id ||
      typeof parsed.name !== "string" ||
      typeof parsed.archived !== "boolean" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      throw new Error(`Invalid session metadata for id "${id}".`);
    }
    return {
      id: parsed.id,
      name: parsed.name,
      archived: parsed.archived,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  }

  private extractChatText(parsed: { chat?: unknown; messages?: unknown }): string {
    if (typeof parsed.chat === "string") {
      return parsed.chat;
    }
    if (!Array.isArray(parsed.messages)) {
      return "";
    }
    const lines: string[] = [];
    for (const message of parsed.messages) {
      if (typeof message === "string") {
        lines.push(message);
        continue;
      }
      if (typeof message !== "object" || message === null) {
        continue;
      }
      const roleRaw = (message as Record<string, unknown>).role;
      const role = typeof roleRaw === "string" ? roleRaw : "unknown";
      const contentRaw = (message as Record<string, unknown>).content;
      const content =
        typeof contentRaw === "string"
          ? contentRaw
          : contentRaw === undefined
            ? ""
            : JSON.stringify(contentRaw);
      lines.push(`[${role}] ${content}`);
    }
    return lines.join("\n");
  }

  private async writeRecord(dataDir: string, record: SessionRecord): Promise<void> {
    const filePath = getSessionPath(dataDir, record.id);
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = path.join(path.dirname(filePath), `.${record.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`);
      await rename(temporaryPath, filePath);
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }
    await stat(filePath);
  }
}
