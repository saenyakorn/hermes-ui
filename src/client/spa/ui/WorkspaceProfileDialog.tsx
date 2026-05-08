import { Dialog } from "@base-ui/react";
import { useCallback, useState } from "react";
import type { ProfileCreateMode, ProfileSummary } from "../../../server/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { cn } from "../../lib/cn";
import { useProfileWorkspace } from "../profile-context";
import { useWorkspaceProfileSubscribed } from "../workspace-profile";

const CREATE_MODES: readonly ProfileCreateMode[] = ["blank", "clone", "clone-all"];

function profileRowKey(p: ProfileSummary): string {
  return p.name ?? "__default__";
}

function profileSlug(profile: string | null): string {
  return profile === null ? "__default__" : profile;
}

export function WorkspaceProfileDialog() {
  const profiles = useProfileWorkspace();
  const workspaceProfile = useWorkspaceProfileSubscribed();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const viewedLabel = workspaceProfile.profile ?? "default";

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createMode, setCreateMode] = useState<ProfileCreateMode>("blank");
  const [createCloneFrom, setCreateCloneFrom] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const selectedProfile =
    selectedKey === null
      ? null
      : (profiles.list.profiles.find((p) => profileRowKey(p) === selectedKey) ?? null);

  const selectedNamedProfile =
    selectedProfile && selectedProfile.name !== null ? selectedProfile : null;

  const selectedSummary =
    selectedProfile === null ? null : profiles.gatewaySummaries[profileSlug(selectedProfile.name)];
  const selectedGatewayState = selectedSummary?.status.state ?? "stopped";

  const resetTransientState = useCallback(() => {
    setCreateName("");
    setCreateMode("blank");
    setCreateCloneFrom("");
    setRenameDraft("");
    setDeleteConfirm("");
  }, []);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      const matching = profiles.list.profiles.find(
        (p) => profileSlug(p.name) === profileSlug(workspaceProfile.profile),
      );
      const initial = matching ?? profiles.list.profiles[0] ?? null;
      setSelectedKey(initial ? profileRowKey(initial) : null);
      setRenameDraft(initial?.label ?? "");
      setDeleteConfirm("");
      return;
    }
    resetTransientState();
  };

  const onRenameSave = async () => {
    const currentName = selectedNamedProfile?.name;
    if (!currentName) return;
    await profiles.renameTo(currentName, renameDraft);
  };

  const onDelete = async () => {
    const name = selectedNamedProfile?.name;
    if (name === null || name === undefined) return;
    if (deleteConfirm.trim() !== name) return;
    if (!window.confirm(`Permanently delete profile "${name}"?`)) return;
    await profiles.removeConfirmed(name);
    setDeleteConfirm("");
    setSelectedKey(null);
  };

  const onView = () => {
    if (!selectedProfile) return;
    workspaceProfile.setProfile(selectedProfile.name);
  };

  const isViewingSelected =
    selectedProfile !== null &&
    profileSlug(selectedProfile.name) === profileSlug(workspaceProfile.profile);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        id="profile-picker"
        className={cn(
          "inline-flex min-w-[140px] max-w-full flex-1 items-center justify-between gap-2 rounded-md border border-accent-border/70 bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent",
        )}
      >
        <span className="min-w-0 truncate">{viewedLabel}</span>
        <span aria-hidden className="shrink-0 text-muted">
          ▾
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            className={cn(
              "max-h-[min(640px,85vh)] w-full max-w-4xl overflow-y-auto rounded-xl border border-accent-border/80 bg-surface p-4 shadow-xl outline-none",
            )}
          >
            <Dialog.Title className="text-base font-semibold text-text">Profiles</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted">
              Pick a profile to view in the workspace. Each profile&apos;s gateway runs
              independently — switching the view does not affect any running gateway.
            </Dialog.Description>

            {profiles.list.warning ? (
              <p className="mt-2 text-xs text-amber-300">{profiles.list.warning}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
              <section className="rounded-xl border border-frosted bg-background p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Profile list</p>
                <ul className="mt-2 space-y-2" role="list">
                  {profiles.list.profiles.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-muted">No profiles loaded.</li>
                  ) : (
                    profiles.list.profiles.map((p: ProfileSummary) => {
                      const key = profileRowKey(p);
                      const selected = selectedKey === key;
                      const summary = profiles.gatewaySummaries[profileSlug(p.name)];
                      const isViewing =
                        profileSlug(p.name) === profileSlug(workspaceProfile.profile);
                      const running = summary?.status.state === "running";
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                              selected
                                ? "border-accent/60 bg-accent/15 text-text"
                                : "border-accent-border/60 bg-surface text-muted hover:border-accent-border hover:bg-surface/80",
                            )}
                            onClick={() => {
                              setSelectedKey(key);
                              setRenameDraft(p.label);
                              setDeleteConfirm("");
                            }}
                          >
                            <span className="font-medium">{p.label}</span>
                            {isViewing ? (
                              <span className="ml-2 rounded-full bg-text px-2 py-0.5 text-[10px] text-background">
                                viewing
                              </span>
                            ) : null}
                            {running ? (
                              <span className="ml-2 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200">
                                running
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3 w-full"
                  onClick={() => setCreateOpen(true)}
                >
                  Create
                </Button>
              </section>

              <section className="rounded-xl border border-frosted bg-background p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Path</p>
                <div className="mt-2 rounded-md border border-accent-border/60 bg-surface px-3 py-2 text-sm text-text">
                  {selectedProfile?.dataDir ?? "-"}
                </div>

                <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                  Gateway state
                </p>
                <div className="mt-2 rounded-md border border-accent-border/60 bg-surface px-3 py-2 text-sm text-text">
                  {selectedGatewayState}
                </div>

                <label className="mt-3 block text-[11px] uppercase tracking-[0.12em] text-muted">
                  Rename
                  <Input
                    className="mt-2"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    size="md"
                    disabled={!selectedNamedProfile}
                  />
                </label>

                <label className="mt-3 block text-[11px] uppercase tracking-[0.12em] text-muted">
                  Delete confirm
                  <Input
                    className="mt-2"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={selectedNamedProfile?.name ?? "profile slug"}
                    size="md"
                    disabled={!selectedNamedProfile}
                  />
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={!selectedProfile || isViewingSelected}
                    onClick={onView}
                  >
                    {isViewingSelected ? "Viewing" : "View"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled={
                      !selectedNamedProfile || deleteConfirm.trim() !== selectedNamedProfile.name
                    }
                    onClick={() => void onDelete()}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={!selectedNamedProfile || renameDraft.trim().length === 0}
                    onClick={() => void onRenameSave()}
                  >
                    Rename
                  </Button>
                </div>
              </section>
            </div>

            <p className="mt-3 text-xs text-muted" role="status">
              {profiles.status}
            </p>

            <div className="mt-4 flex justify-end gap-2 border-t border-frosted pt-4">
              <Dialog.Close
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-md border border-accent-border bg-surface px-4 py-2 text-sm text-text transition",
                  "hover:opacity-90",
                )}
              >
                Close
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>

      <Dialog.Root
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen) {
            setCreateName("");
            setCreateMode("blank");
            setCreateCloneFrom("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-60 bg-black/65 backdrop-blur-[1px]" />
          <Dialog.Viewport className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <Dialog.Popup className="w-full max-w-md rounded-xl border border-accent-border/80 bg-surface p-4 shadow-xl outline-none">
              <Dialog.Title className="text-base font-semibold text-text">
                Create profile
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">
                Fill required profile details.
              </Dialog.Description>

              <div className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Name
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="my-profile"
                    size="md"
                    autoComplete="off"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Mode
                  <select
                    value={createMode}
                    onChange={(e) => setCreateMode(e.target.value as ProfileCreateMode)}
                    className="w-full rounded-md border border-accent-border/70 bg-surface px-2 py-2 text-sm text-text outline-none focus:border-accent"
                  >
                    {CREATE_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Clone from (optional)
                  <Input
                    value={createCloneFrom}
                    onChange={(e) => setCreateCloneFrom(e.target.value)}
                    placeholder="other-profile"
                    size="md"
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Dialog.Close
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-accent-border bg-surface px-4 py-2 text-sm text-text transition hover:opacity-90"
                >
                  Cancel
                </Dialog.Close>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={async () => {
                    const payload: { name: string; mode: ProfileCreateMode; cloneFrom?: string } = {
                      name: createName,
                      mode: createMode,
                    };
                    if (createCloneFrom.trim()) payload.cloneFrom = createCloneFrom.trim();
                    await profiles.createProfile(payload);
                    setCreateOpen(false);
                    setCreateName("");
                    setCreateMode("blank");
                    setCreateCloneFrom("");
                  }}
                >
                  Create
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}
