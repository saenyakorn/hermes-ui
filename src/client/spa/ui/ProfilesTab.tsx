import type { ProfileListResult } from "../../../server/types";
import type { ProfileFileKind } from "../../../server/types";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import type { ProfileFilesState } from "../../hooks/useProfileFilesTab";

type ProfilesTabProps = {
  list: ProfileListResult;
  status: string;
  files: ProfileFilesState;
  onReload: () => Promise<void>;
  onCreate: () => Promise<void>;
  onActivate: (name: string | null) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onFileChange: (kind: ProfileFileKind, content: string) => void;
  onFileReload: (kind: ProfileFileKind) => Promise<void>;
  onFileSave: (kind: ProfileFileKind) => Promise<void>;
};

export function ProfilesTab(props: ProfilesTabProps) {
  const renderFilePanel = (kind: ProfileFileKind, title: string, editorId: string) => {
    const file = props.files[kind];
    const dirty = file.content !== file.savedContent;
    return (
      <article className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-frosted bg-background p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text">{title}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved changes?")) {
                  return;
                }
                void props.onFileReload(kind);
              }}
            >
              Reload
            </button>
            <button
              type="button"
              className="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50"
              disabled={!file.loaded || file.saving || !dirty}
              onClick={() => void props.onFileSave(kind)}
            >
              Save
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-muted">
          {file.path.length > 0 ? (file.updatedAt ? `${file.path} (updated ${file.updatedAt})` : file.path) : "-"}
        </p>
        <MarkdownEditor
          id={editorId}
          value={file.content}
          onChange={(content) => props.onFileChange(kind, content)}
        />
        <p className="mt-2 text-xs text-muted" role="status" aria-live="polite">
          {file.status}
        </p>
      </article>
    );
  };

  return (
    <section data-tab-panel="profiles" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p id="profiles-active" className="text-xs text-muted">
          {`Active: ${props.list.active ?? "default"} (${props.list.profiles.length} profile${props.list.profiles.length === 1 ? "" : "s"})`}
        </p>
        <div className="flex gap-2">
          <button id="profiles-reload" type="button" className="rounded-full bg-frosted px-3 py-1 text-xs text-text" onClick={() => void props.onReload()}>
            Reload
          </button>
          <button id="profiles-new" type="button" className="rounded-full bg-text px-3 py-1 text-xs text-background" onClick={() => void props.onCreate()}>
            New profile
          </button>
        </div>
      </div>

      <div id="profiles-list" className="mb-3 overflow-auto rounded-lg border border-frosted">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {props.list.profiles.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>
                  No profiles yet.
                </td>
              </tr>
            ) : (
              props.list.profiles.map((profile) => {
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
                        <button
                          type="button"
                          className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                          onClick={() => void props.onActivate(profile.name)}
                        >
                          Activate
                        </button>
                      ) : null}
                      {profileName !== null ? (
                        <>
                          <button
                            type="button"
                            className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                            onClick={() => void props.onRename(profileName)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-frosted px-2 py-1 text-[11px] text-danger"
                            onClick={() => void props.onDelete(profileName)}
                          >
                            Delete
                          </button>
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
      </div>

      <p id="profiles-status" className="mt-3 text-xs text-muted" role="status" aria-live="polite">
        {props.status}
      </p>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pb-1 lg:grid-cols-3">
        {renderFilePanel("soul", "SOUL.md", "profile-soul-editor")}
        {renderFilePanel("memory", "memories/MEMORY.md", "profile-memory-editor")}
        {renderFilePanel("user", "memories/USER.md", "profile-user-editor")}
      </div>
    </section>
  );
}
