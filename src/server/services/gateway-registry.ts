import type { GatewayHealthState, GatewayStatus } from "../types";
import { GatewayManager, type SpawnGateway } from "./gateway-manager";
import type { LogStoreRegistry } from "./log-store-registry";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

const PROFILE_KEY_DEFAULT = "__default__";

function profileKey(profile: string | null): string {
  return profile === null ? PROFILE_KEY_DEFAULT : profile;
}

export type GatewayProfileSummary = {
  profile: string | null;
  status: GatewayStatus;
  health: GatewayHealthState;
};

export type GatewaysSummary = {
  gateways: GatewayProfileSummary[];
};

/**
 * Lazily constructs a {@link GatewayManager} per profile so multiple
 * `hermes gateway run` children can run concurrently — switching the
 * UI's "viewed" profile no longer terminates other profiles' gateways.
 */
export class GatewayRegistry {
  private readonly managers = new Map<string, GatewayManager>();

  constructor(
    private readonly resolver: ProfileResolver,
    private readonly logsRegistry: LogStoreRegistry,
    private readonly spawnGateway?: SpawnGateway,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Returns the {@link GatewayManager} for the given profile, instantiating it
   * on first access. `null` targets the default profile.
   */
  get(profile: string | null): GatewayManager {
    if (profile !== null) {
      validateProfileName(profile);
    }
    const key = profileKey(profile);
    const existing = this.managers.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const cwd = this.resolver.resolveDataDir(profile);
    const logs = this.logsRegistry.get(profile);
    const manager = new GatewayManager(profile, cwd, logs, this.spawnGateway, this.clock);
    this.managers.set(key, manager);
    return manager;
  }

  /** True iff a manager already exists (and may hold a child process). */
  has(profile: string | null): boolean {
    return this.managers.has(profileKey(profile));
  }

  /** Snapshot of all managers known to the registry (without instantiating new ones). */
  knownProfiles(): Array<string | null> {
    return Array.from(this.managers.entries()).map(([key]) =>
      key === PROFILE_KEY_DEFAULT ? null : key,
    );
  }

  /**
   * Returns a status snapshot for every profile currently tracked by the
   * registry, plus any extra `additionalProfiles` (typically discovered on
   * disk by {@link ProfileStore}).
   *
   * `refreshHealth` controls whether each manager is asked for live health
   * (default true).
   */
  async list(
    additionalProfiles: ReadonlyArray<string | null> = [],
    refreshHealth = true,
  ): Promise<GatewaysSummary> {
    const seen = new Set<string>();
    const ordered: Array<string | null> = [];

    const push = (profile: string | null): void => {
      const key = profileKey(profile);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      ordered.push(profile);
    };

    push(null);
    for (const profile of this.knownProfiles()) {
      push(profile);
    }
    for (const profile of additionalProfiles) {
      push(profile);
    }

    const gateways: GatewayProfileSummary[] = [];
    for (const profile of ordered) {
      const manager = this.get(profile);
      if (refreshHealth) {
        const status = await manager.refreshHealth();
        gateways.push({ profile, status, health: status.health });
        continue;
      }
      const status = manager.status();
      gateways.push({ profile, status, health: status.health });
    }
    return { gateways };
  }

  /** Awaits every running gateway shutting down (best-effort, isolates failures). */
  async shutdownAll(): Promise<void> {
    const shutdowns = Array.from(this.managers.values()).map((manager) =>
      manager.shutdown().catch(() => undefined),
    );
    await Promise.all(shutdowns);
  }
}
