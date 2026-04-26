import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/server/index.ts",
    platform: "node",
    external: ["node-pty"],
    output: { dir: "dist", format: "esm", entryFileNames: "index.js" },
  },
  {
    input: {
      main: "src/client/main.ts",
    },
    platform: "browser",
    output: { dir: "dist/assets", format: "esm", entryFileNames: "[name].js" },
  },
]);
