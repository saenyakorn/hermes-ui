import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPaths } from "../src/server/services/paths";

describe("createPaths", () => {
  it("anchors data and logs under cwd", () => {
    const paths = createPaths("/repo");

    expect(paths.dataDir).toBe(path.join("/repo", "data"));
    expect(paths.logsDir).toBe(path.join("/repo", "data", "logs"));
  });
});
