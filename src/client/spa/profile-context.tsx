import { createContext, type ReactNode, useContext } from "react";
import type { ProfileWorkspaceApi } from "../hooks/useProfilesTab";
import { useProfilesTab } from "../hooks/useProfilesTab";

const ProfileWorkspaceContext = createContext<ProfileWorkspaceApi | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const value = useProfilesTab();
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
