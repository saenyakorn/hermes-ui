import type { TabKey } from "../../tabs";
import type { ProfileSummary } from "../../../server/types";

type WorkspaceTabBarProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  triggerClass: (tab: TabKey) => string;
  profileValue: string;
  profiles: ProfileSummary[];
  onProfileChange: (value: string) => void;
};

export function WorkspaceTabBar({
  activeTab,
  onTabChange,
  triggerClass,
  profileValue,
  profiles,
  onProfileChange,
}: WorkspaceTabBarProps) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-frosted pb-3">
      <label className="flex items-center gap-2 text-xs text-muted" htmlFor="profile-picker">
        Profile
        <select
          id="profile-picker"
          className="rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none"
          value={profileValue}
          onChange={(event) => onProfileChange(event.target.value)}
        >
          {profiles.length === 0 ? (
            <option value="default">default</option>
          ) : (
            profiles.map((profile) => (
              <option key={profile.label} value={profile.name ?? "default"}>
                {profile.label}
              </option>
            ))
          )}
        </select>
      </label>
      <span className="mx-1 h-5 w-px bg-frosted" aria-hidden="true" />
      <button type="button" data-tab-trigger="control" className={triggerClass("control")} onClick={() => onTabChange("control")}>Control</button>
      <button type="button" data-tab-trigger="logs" className={triggerClass("logs")} onClick={() => onTabChange("logs")}>Live log</button>
      <button type="button" data-tab-trigger="shell" className={triggerClass("shell")} onClick={() => onTabChange("shell")}>Interactive shell</button>
      <button type="button" data-tab-trigger="config" className={triggerClass("config")} onClick={() => onTabChange("config")}>Hermes config</button>
      <button type="button" data-tab-trigger="env" className={triggerClass("env")} onClick={() => onTabChange("env")}>Env vars</button>
      <button type="button" data-tab-trigger="messaging" className={triggerClass("messaging")} onClick={() => onTabChange("messaging")}>Messaging Platform</button>
      <button type="button" data-tab-trigger="model-providers" className={triggerClass("model-providers")} onClick={() => onTabChange("model-providers")}>Model providers</button>
      <button type="button" data-tab-trigger="profiles" className={triggerClass("profiles")} onClick={() => onTabChange("profiles")}>Profiles</button>
      <button type="button" data-tab-trigger="sessions" className={triggerClass("sessions")} onClick={() => onTabChange("sessions")}>Sessions</button>
      <span className="hidden">{activeTab}</span>
    </div>
  );
}
