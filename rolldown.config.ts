import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/server/index.ts",
    platform: "node",
    external: ["node-pty"],
    output: { file: "dist/index.js", format: "esm" },
  },
  {
    input: {
      main: "src/client/main.ts",
      terminal: "src/client/terminal.ts",
      workspace: "src/client/workspace.tsx",
    },
    platform: "browser",
    output: { dir: "dist/assets", format: "esm", entryFileNames: "[name].js" },
  },
]);
