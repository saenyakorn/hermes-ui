import path from "node:path";
import { LogStore } from "./log-store";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

const PROFILE_KEY_DEFAULT = "__default__";

function profileKey(profile: string | null): string {
  return profile === null ? PROFILE_KEY_DEFAULT : profile;
}

/**
 * Tracks one {@link LogStore} per profile so each profile's gateway streams to
 * its own logs directory (`<profileDataDir>/logs/`). Subscribers to the SSE
 * route bind to a specific profile's store instead of following a global
 * "active profile" pointer.
 */
export class LogStoreRegistry {
  private readonly stores = new Map<string, LogStore>();

  constructor(
    private readonly resolver: ProfileResolver,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** Returns (constructing on first access) the store for a given profile. */
  get(profile: string | null): LogStore {
    if (profile !== null) {
      validateProfileName(profile);
    }
    const key = profileKey(profile);
    const existing = this.stores.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const dataDir = this.resolver.resolveDataDir(profile);
    const store = new LogStore(path.join(dataDir, "logs"), this.clock);
    this.stores.set(key, store);
    return store;
  }
}
