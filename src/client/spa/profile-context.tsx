import { createContext, type ReactNode, useContext } from "react";
import type { GatewaysSummary } from "../../server/types";
import type { ProfileWorkspaceApi } from "../hooks/useProfilesTab";
import { useProfilesTab } from "../hooks/useProfilesTab";

const ProfileWorkspaceContext = createContext<ProfileWorkspaceApi | null>(null);

export type ProfileProviderProps = {
  children: ReactNode;
  /**
   * Server-rendered initial gateway summary so the first paint shows the
   * status pills without waiting on the GET /gateways round trip.
   */
  initialGateways?: GatewaysSummary;
};

export function ProfileProvider({ children, initialGateways }: ProfileProviderProps) {
  const value = useProfilesTab(
    initialGateways === undefined ? {} : { initialSummary: initialGateways },
  );
  return (
    <ProfileWorkspaceContext.Provider value={value}>{children}</ProfileWorkspaceContext.Provider>
  );
}

export function useProfileWorkspace(): ProfileWorkspaceApi {
  const ctx = useContext(ProfileWorkspaceContext);
  if (!ctx) {
    throw new Error("useProfileWorkspace must be used within ProfileProvider");
  }
  return ctx;
}
