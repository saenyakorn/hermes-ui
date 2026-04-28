import type { ProfileFileKind } from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { useProfileFilesTab } from "../../hooks/useProfileFilesTab";
import { useProfilesTab } from "../../hooks/useProfilesTab";

export function ProfilesTab() {
  const profiles = useProfilesTab();
  const profileFiles = useProfileFilesTab(profiles.list.active);

  const renderFilePanel = (kind: ProfileFileKind, title: string, editorId: string) => {
    const file = profileFiles.files[kind];
    const dirty = file.content !== file.savedContent;
    return (
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
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
        <p className="mb-2 text-xs text-muted">
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
        <p className="mt-2 text-xs text-muted" role="status" aria-live="polite">
          {file.status}
        </p>
      </Card>
    );
  };

  return (
    <section
      data-tab-panel="profiles"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p id="profiles-active" className="text-xs text-muted">
          {`Active: ${profiles.list.active ?? "default"} (${profiles.list.profiles.length} profile${profiles.list.profiles.length === 1 ? "" : "s"})`}
        </p>
        <div className="flex gap-2">
          <Button
            id="profiles-reload"
            type="button"
            variant="secondary"
            onClick={() => void profiles.refresh()}
          >
            Reload
          </Button>
          <Button
            id="profiles-new"
            type="button"
            variant="primary"
            onClick={() => void profiles.create()}
          >
            New profile
          </Button>
        </div>
      </div>

      <Card id="profiles-list" className="mb-3 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {profiles.list.profiles.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>
                  No profiles yet.
                </td>
              </tr>
            ) : (
              profiles.list.profiles.map((profile) => {
                const profileName = profile.name;
                return (
                  <tr key={profile.label} className="border-b border-frosted last:border-b-0">
                    <td className="px-3 py-2 text-text">
                      <span>{profile.label}</span>
                      {profile.active ? (
                        <span className="ml-2 rounded-full bg-text px-2 py-0.5 text-[10px] text-background">
                          active
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted">{profile.dataDir}</td>
                    <td className="px-3 py-2 text-muted">{profile.updatedAt ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {!profile.active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-[11px]"
                            onClick={() => void profiles.activate(profile.name)}
                          >
                            Activate
                          </Button>
                        ) : null}
                        {profileName !== null ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => void profiles.rename(profileName)}
                            >
                              Rename
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="px-2 py-1 text-[11px]"
                              onClick={() => void profiles.remove(profileName)}
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <p id="profiles-status" className="mt-3 text-xs text-muted" role="status" aria-live="polite">
        {profiles.status}
      </p>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pb-1 lg:grid-cols-3">
        {renderFilePanel("soul", "SOUL.md", "profile-soul-editor")}
        {renderFilePanel("memory", "memories/MEMORY.md", "profile-memory-editor")}
        {renderFilePanel("user", "memories/USER.md", "profile-user-editor")}
      </div>
    </section>
  );
}
