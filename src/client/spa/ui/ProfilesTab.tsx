import type { ProfileFileKind } from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { useProfileFilesTab } from "../../hooks/useProfileFilesTab";
import { useProfileWorkspace } from "../profile-context";

export function ProfilesTab() {
  const profiles = useProfileWorkspace();
  const profileFiles = useProfileFilesTab(profiles.activeProfile);

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
      <p
        id="profiles-status"
        className="shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {profiles.status}
      </p>

      <div className="flex min-w-0 flex-col gap-3">
        {renderFilePanel("soul", "SOUL.md", "profile-soul-editor")}
        {renderFilePanel("memory", "memories/MEMORY.md", "profile-memory-editor")}
        {renderFilePanel("user", "memories/USER.md", "profile-user-editor")}
      </div>
    </section>
  );
}
