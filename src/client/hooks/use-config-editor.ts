import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import {
  fetchConfigSaveResponse,
  getConfigRead,
  getErrorMessage,
  getRestartStatusMessage,
  type ConfigReadResult,
  type ConfigValidationIssue,
  type GatewayStatus,
} from "../api";

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

export function useConfigEditor(onGatewayStatus: (status: GatewayStatus) => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const savedConfigContentRef = useRef<string | null>(null);
  const configLoadedRef = useRef(false);
  const isSavingRef = useRef(false);

  const [path, setPath] = useState("data/config.yaml");
  const [updatedAt, setUpdatedAt] = useState("Loading config...");
  const [status, setStatus] = useState("Waiting for editor...");
  const [issues, setIssues] = useState<ConfigValidationIssue[]>([]);
  const [isSaveEnabled, setIsSaveEnabled] = useState(false);

  const isConfigDirty = useCallback(() => {
    return (
      savedConfigContentRef.current !== null &&
      editorRef.current?.getValue() !== savedConfigContentRef.current
    );
  }, []);

  const updateSaveButtonState = useCallback(() => {
    setIsSaveEnabled(Boolean(configLoadedRef.current && !isSavingRef.current && isConfigDirty()));
  }, [isConfigDirty]);

  const renderConfigMetadata = useCallback((config: ConfigReadResult) => {
    setPath(config.path);
    setUpdatedAt(config.updatedAt ? `Updated ${config.updatedAt}` : "Not saved yet");
  }, []);

  const loadConfigFromDisk = useCallback(async () => {
    if (!editorRef.current) {
      return;
    }

    configLoadedRef.current = false;
    setIssues([]);
    setStatus("Loading config...");
    updateSaveButtonState();

    try {
      const config = await getConfigRead();
      savedConfigContentRef.current = config.content;
      editorRef.current.setValue(config.content);
      configLoadedRef.current = true;
      renderConfigMetadata(config);
      setIssues(config.validation.issues);
      setStatus("No unsaved changes.");
    } catch (cause: unknown) {
      setStatus(`Failed to load config: ${getErrorMessage(cause)}`);
    } finally {
      updateSaveButtonState();
    }
  }, [renderConfigMetadata, updateSaveButtonState]);

  const saveConfig = useCallback(async () => {
    if (!editorRef.current || !configLoadedRef.current || !isConfigDirty()) {
      updateSaveButtonState();
      return;
    }

    isSavingRef.current = true;
    updateSaveButtonState();
    setStatus("Saving config...");

    try {
      const submittedContent = editorRef.current.getValue();
      const response = await fetchConfigSaveResponse(submittedContent);
      const currentContent = editorRef.current.getValue();

      if (!response.config.saved) {
        renderConfigMetadata(response.config);
        onGatewayStatus(response.gateway);

        if (currentContent !== submittedContent) {
          setIssues([]);
          setStatus("Config changed after save started. Review current edits before saving again.");
          return;
        }

        setIssues(response.config.validation.issues);
        setStatus("Config validation failed. File was not changed.");
        return;
      }

      savedConfigContentRef.current = response.config.content;
      renderConfigMetadata(response.config);
      setIssues(response.config.validation.issues);
      onGatewayStatus(response.gateway);

      if (currentContent !== response.config.content) {
        setStatus("Unsaved changes.");
        return;
      }

      setStatus(getRestartStatusMessage(response));
    } catch (cause: unknown) {
      setStatus(`Failed to save config: ${getErrorMessage(cause)}`);
    } finally {
      isSavingRef.current = false;
      updateSaveButtonState();
    }
  }, [isConfigDirty, onGatewayStatus, renderConfigMetadata, updateSaveButtonState]);

  const reloadConfigWithConfirmation = useCallback(async () => {
    if (configLoadedRef.current && isConfigDirty() && !window.confirm("Discard unsaved config changes?")) {
      return;
    }

    await loadConfigFromDisk();
  }, [isConfigDirty, loadConfigFromDisk]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let dispose: (() => void) | undefined;
    let cancelled = false;

    void loadMonaco()
      .then((monaco) => {
        if (cancelled) {
          return;
        }

        const editorInstance = monaco.editor.create(container, {
          value: "",
          language: "yaml",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          scrollBeyondLastLine: false,
        });
        editorRef.current = editorInstance;

        const layoutEditorIfVisible = (): void => {
          if (container.offsetWidth < 2 || container.offsetHeight < 2) {
            return;
          }

          editorInstance.layout();
        };

        const resizeObserver = new ResizeObserver(() => {
          layoutEditorIfVisible();
        });
        resizeObserver.observe(container);

        const panel = container.closest<HTMLElement>('[role="tabpanel"]');
        const visibilityObserver = panel
          ? new MutationObserver(() => {
              layoutEditorIfVisible();
            })
          : null;
        if (visibilityObserver && panel) {
          visibilityObserver.observe(panel, {
            attributes: true,
            attributeFilter: ["hidden", "style", "class", "data-state"],
          });
        }

        const onDidChangeModelContent = editorInstance.onDidChangeModelContent(() => {
          if (!configLoadedRef.current) {
            updateSaveButtonState();
            return;
          }

          setStatus(isConfigDirty() ? "Unsaved changes." : "No unsaved changes.");
          updateSaveButtonState();
        });

        layoutEditorIfVisible();
        void loadConfigFromDisk();

        dispose = () => {
          onDidChangeModelContent.dispose();
          resizeObserver.disconnect();
          visibilityObserver?.disconnect();
          editorInstance.dispose();
          editorRef.current = null;
        };
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setStatus(`Failed to initialize config editor: ${getErrorMessage(cause)}`);
        }
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [isConfigDirty, loadConfigFromDisk, updateSaveButtonState]);

  return useMemo(
    () => ({
      containerRef,
      path,
      updatedAt,
      status,
      issues,
      isSaveEnabled,
      saveConfig,
      reloadConfigWithConfirmation,
    }),
    [isSaveEnabled, issues, path, reloadConfigWithConfirmation, saveConfig, status, updatedAt],
  );
}

async function loadMonaco(): Promise<MonacoApi> {
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

function loadScript(src: string): Promise<void> {
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existingScript) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.append(script);
  });
}
