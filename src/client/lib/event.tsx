import type { EnvReadResult, GatewayStatus, GatewaysSummary } from "../../server/types";

export const GATEWAY_STATUS_EVENT = "gateway:status";
export const GATEWAYS_SUMMARY_EVENT = "gateways:summary";
export const PROFILE_CHANGED_EVENT = "profile:changed";
export const ENV_SNAPSHOT_EVENT = "env:snapshot";
export const ENV_RELOAD_REQUEST_EVENT = "env:reload";
export const PROFILES_TAB_SHOWN_EVENT = "profiles:tab-shown";
export const SESSIONS_TAB_SHOWN_EVENT = "sessions:tab-shown";

export type EnvSnapshotDetail = {
  env: EnvReadResult;
  gateway?: GatewayStatus;
  profile: string | null;
};

export function dispatchGatewayStatus(status: GatewayStatus): void {
  window.dispatchEvent(new CustomEvent<GatewayStatus>(GATEWAY_STATUS_EVENT, { detail: status }));
}

export function dispatchGatewaysSummary(summary: GatewaysSummary): void {
  window.dispatchEvent(
    new CustomEvent<GatewaysSummary>(GATEWAYS_SUMMARY_EVENT, { detail: summary }),
  );
}

export function dispatchProfileChanged(activeProfile: string | null): void {
  window.dispatchEvent(
    new CustomEvent<string | null>(PROFILE_CHANGED_EVENT, { detail: activeProfile }),
  );
}

export function dispatchEnvSnapshot(detail: EnvSnapshotDetail): void {
  window.dispatchEvent(new CustomEvent<EnvSnapshotDetail>(ENV_SNAPSHOT_EVENT, { detail }));
}

export function dispatchEnvReloadRequest(): void {
  window.dispatchEvent(new CustomEvent(ENV_RELOAD_REQUEST_EVENT));
}

export function dispatchProfilesTabShown(): void {
  window.dispatchEvent(new CustomEvent(PROFILES_TAB_SHOWN_EVENT));
}

export function dispatchSessionsTabShown(): void {
  window.dispatchEvent(new CustomEvent(SESSIONS_TAB_SHOWN_EVENT));
}
