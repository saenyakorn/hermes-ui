import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ModelProvidersPanel form wiring", () => {
  it("wraps each provider section with form.Form so submit buttons work", () => {
    const panelPath = path.resolve(
      process.cwd(),
      "src/client/spa/ui/ModelProvidersPanel.tsx",
    );
    const source = readFileSync(panelPath, "utf8");
    const formTagCount = source.match(/<form\.Form>/g)?.length ?? 0;

    expect(formTagCount).toBe(5);
  });
});
