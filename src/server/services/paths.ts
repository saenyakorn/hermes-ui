import path from "node:path";

export type AppPaths = {
  rootDir: string;
  dataDir: string;
  logsDir: string;
};

export function createPaths(rootDir: string = process.cwd()): AppPaths {
  const dataDir = path.join(rootDir, "data");

  return {
    rootDir,
    dataDir,
    logsDir: path.join(dataDir, "logs"),
  };
}
