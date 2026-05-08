import { useMemo } from "react";
import type {
  GatewayProfileSummary,
  GatewayStatus,
  ProfileFileKind,
  ProfileSummary,
} from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { useProfileFilesTab } from "../../hooks/useProfileFilesTab";
import { cn } from "../../lib/cn";
import { useProfileWorkspace } from "../profile-context";
import { useWorkspaceProfileSubscribed } from "../workspace-profile";
import { SectionLabel, StatusChip } from "../../components/UiPrimitives";

const DEFAULT_PROFILE_LABEL = "default";

function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs === null || uptimeMs <= 0) {
    return "-";
  }
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function profileSlug(profile: string | null): string {
  return profile === null ? "default" : profile;
}

function profileLabel(profile: string | null): string {
  return profile === null ? DEFAULT_PROFILE_LABEL : profile;
}

function stateChipClass(state: GatewayStatus["state"]): string {
  switch (state) {
    case "running":
      return "text-emerald-300";
    case "starting":
    case "stopping":
      return "text-amber-300";
    case "crashed":
      return "text-danger";
    default:
      return "text-muted";
  }
}

type ProfileRow = {
  profile: string | null;
  label: string;
  slug: string;
  summary: GatewayProfileSummary | undefined;
  meta: ProfileSummary | undefined;
};

function buildRows(
  profilesList: readonly ProfileSummary[],
  summaries: Record<string, GatewayProfileSummary>,
): ProfileRow[] {
  const seen = new Set<string>();
  const rows: ProfileRow[] = [];

  const push = (profile: string | null, meta?: ProfileSummary): void => {
    const slug = profileSlug(profile);
    if (seen.has(slug)) {
      return;
    }
    seen.add(slug);
    rows.push({
      profile,
      label: profileLabel(profile),
      slug,
      summary: summaries[slug],
      meta: meta ?? profilesList.find((entry) => profileSlug(entry.name) === slug),
    });
  };

  push(null);
  for (const meta of profilesList) {
    push(meta.name, meta);
  }
  for (const slug of Object.keys(summaries)) {
    if (slug === "default") {
      continue;
    }
    push(slug);
  }
  return rows;
}

export function ProfilesTab() {
  const profiles = useProfileWorkspace();
  const workspaceProfile = useWorkspaceProfileSubscribed();
  const profileFiles = useProfileFilesTab(workspaceProfile.profile);

  const rows = useMemo(
    () => buildRows(profiles.list.profiles, profiles.gatewaySummaries),
    [profiles.list.profiles, profiles.gatewaySummaries],
  );

  const renderFilePanel = (kind: ProfileFileKind, title: string, editorId: string) => {
    const file = profileFiles.files[kind];
    const dirty = file.content !== file.savedContent;
    return (
      <Card className="flex min-w-0 shrink-0 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text">{title}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved changes?")) {
                  return;
                }
                void profileFiles.reload(kind);
              }}
            >
              Reload
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!file.loaded || file.saving || !dirty}
              onClick={() => void profileFiles.save(kind)}
            >
              Save
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted">
          {file.path.length > 0
            ? file.updatedAt
              ? `${file.path} (updated ${file.updatedAt})`
              : file.path
            : "-"}
        </p>
        <MarkdownEditor
          id={editorId}
          value={file.content}
          onChange={(content) => profileFiles.setContent(kind, content)}
        />
        <p className="text-xs text-muted" role="status" aria-live="polite">
          {file.status}
        </p>
      </Card>
    );
  };

  return (
    <section
      data-tab-panel="profiles"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pb-1"
    >
      <Card className="shrink-0 p-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Gateways per profile</SectionLabel>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void profiles.refresh()}
            disabled={profiles.busyProfile !== null}
          >
            Refresh
          </Button>
        </div>
        {profiles.list.warning ? (
          <p className="mt-2 text-xs text-amber-300">{profiles.list.warning}</p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-xs text-text">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <th className="px-3 text-left font-normal">Profile</th>
                <th className="px-3 text-left font-normal">State</th>
                <th className="px-3 text-left font-normal">Health</th>
                <th className="px-3 text-left font-normal">PID</th>
                <th className="px-3 text-left font-normal">Uptime</th>
                <th className="px-3 text-right font-normal">Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = row.summary?.status;
                const state = status?.state ?? "stopped";
                const isViewing = profileSlug(workspaceProfile.profile) === row.slug;
                const isBusy = profiles.busyProfile === row.slug;
                return (
                  <tr
                    key={row.slug}
                    data-profile-row={row.slug}
                    className={cn(
                      "rounded-lg border border-frosted bg-background",
                      isViewing ? "border-accent/60" : "",
                    )}
                  >
                    <td className="rounded-l-lg border-y border-l border-frosted px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{row.label}</span>
                        {isViewing ? (
                          <span className="mt-0.5 inline-flex w-fit rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-text">
                            viewing
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-y border-frosted px-3 py-2">
                      <StatusChip className={stateChipClass(state)}>{state}</StatusChip>
                    </td>
                    <td className="border-y border-frosted px-3 py-2">{status?.health ?? "-"}</td>
                    <td className="border-y border-frosted px-3 py-2">{status?.pid ?? "-"}</td>
                    <td className="border-y border-frosted px-3 py-2">
                      {formatUptime(status?.uptimeMs ?? null)}
                    </td>
                    <td className="rounded-r-lg border-y border-r border-frosted px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2 py-1 text-[11px]"
                          disabled={isBusy}
                          onClick={() => void profiles.start(row.profile)}
                        >
                          Start
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="px-2 py-1 text-[11px]"
                          disabled={isBusy}
                          onClick={() => void profiles.stop(row.profile)}
                        >
                          Stop
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          className="px-2 py-1 text-[11px]"
                          disabled={isBusy}
                          onClick={() => void profiles.restart(row.profile)}
                        >
                          Restart
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2 py-1 text-[11px]"
                          disabled={isViewing}
                          onClick={() => workspaceProfile.setProfile(row.profile)}
                        >
                          {isViewing ? "Viewing" : "View"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="rounded-lg border border-frosted bg-background px-3 py-3 text-center text-muted"
                  >
                    No profiles loaded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p
          id="profiles-status"
          className="mt-2 text-xs text-muted"
          role="status"
          aria-live="polite"
        >
          {profiles.status}
        </p>
      </Card>

      <Card className="shrink-0 p-4">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{`Profile files — viewing: ${profileLabel(workspaceProfile.profile)}`}</SectionLabel>
          <p className="text-xs text-muted">
            File edits below target the currently-viewed profile only.
          </p>
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-3">
        {renderFilePanel("soul", "SOUL.md", "profile-soul-editor")}
        {renderFilePanel("memory", "memories/MEMORY.md", "profile-memory-editor")}
        {renderFilePanel("user", "memories/USER.md", "profile-user-editor")}
      </div>
    </section>
  );
}
