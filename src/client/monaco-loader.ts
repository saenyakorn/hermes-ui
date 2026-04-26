type MonacoApi = typeof import("monaco-editor");
type MonacoAmdRequire = {
  config: (options: { paths: { vs: string } }) => void;
  (
    modules: readonly string[],
    onLoad: (monaco: MonacoApi) => void,
    onError?: (error: unknown) => void,
  ): void;
};
type MonacoGlobal = typeof globalThis & {
  monaco?: MonacoApi;
  require?: MonacoAmdRequire;
};

const monacoAssetsPath = "/assets/monaco/vs";
const monacoLoaderPath = `${monacoAssetsPath}/loader.js`;

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.head.append(script);
  });
}

export async function loadMonaco(): Promise<MonacoApi> {
  const global = globalThis as MonacoGlobal;
  if (global.monaco) {
    return global.monaco;
  }
  await loadScript(monacoLoaderPath);
  const amdRequire = global.require;
  if (!amdRequire) {
    throw new Error("Monaco loader did not initialize.");
  }
  amdRequire.config({ paths: { vs: monacoAssetsPath } });
  return new Promise((resolve, reject) => {
    amdRequire(
      ["vs/editor/editor.main"],
      () => {
        if (!global.monaco) {
          reject(new Error("Monaco editor did not initialize."));
          return;
        }
        resolve(global.monaco);
      },
      reject,
    );
  });
}
