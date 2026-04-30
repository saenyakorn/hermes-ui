import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("MessagingPanel form wiring", () => {
  const panelPath = path.resolve(process.cwd(), "src/client/spa/ui/MessagingPanel.tsx");
  const source = readFileSync(panelPath, "utf8");

  it("wraps each section (Discord + Slack) with its own form.Form", () => {
    const formTagCount = source.match(/<form\.Form>/g)?.length ?? 0;
    expect(formTagCount).toBe(2);
  });

  it("does not import the deleted singleton hook", () => {
    expect(source).not.toMatch(/useMessagingModelProviders/);
    expect(source).not.toMatch(/useWorkspaceIntegrations/);
  });

  it("each section owns its own useAppForm", () => {
    const useAppFormCount = source.match(/useAppForm\(\{/g)?.length ?? 0;
    expect(useAppFormCount).toBe(2);
  });
});
