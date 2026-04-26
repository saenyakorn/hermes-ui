import { Button } from "@base-ui/react/button";
import { Tabs } from "@base-ui/react/tabs";

const tabClass =
  "rounded-full px-4 py-2 text-sm text-muted outline-none transition-colors hover:text-text data-[active]:bg-frosted data-[active]:text-text";

export function WorkspaceTabs() {
  return (
    <Tabs.Root defaultValue="logs" className="flex min-h-0 flex-1 flex-col">
      <Tabs.List className="mb-3 flex shrink-0 gap-2 border-b border-frosted pb-3">
        <Tabs.Tab value="logs" className={tabClass}>
          Live log
        </Tabs.Tab>
        <Tabs.Tab value="shell" className={tabClass}>
          Interactive shell
        </Tabs.Tab>
        <Tabs.Tab value="config" className={tabClass}>
          Hermes config
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="logs" keepMounted className="min-h-0 flex-1 overflow-hidden">
        <p className="mb-2 text-xs uppercase text-muted">Gateway log</p>
        <pre
          id="log-tail"
          className="max-h-[min(480px,calc(100vh-14rem))] overflow-auto rounded-lg bg-background p-3 text-xs text-muted"
        />
      </Tabs.Panel>

      <Tabs.Panel value="shell" keepMounted className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <p className="text-sm text-muted">Interactive shell</p>
          <Button
            id="terminal-clear"
            className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Clear
          </Button>
        </div>
        <div id="terminal" className="min-h-[320px] flex-1 rounded-lg bg-background" />
      </Tabs.Panel>

      <Tabs.Panel value="config" keepMounted className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted">Hermes Config</p>
            <p id="config-path" className="mt-1 text-sm text-text">
              data/config.yaml
            </p>
            <p id="config-updated-at" className="mt-1 text-xs text-muted">
              Loading config...
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="config-reload"
              className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
            >
              Reload from disk
            </Button>
            <Button
              id="config-save"
              disabled
              className="rounded-full bg-text px-3 py-1 text-xs text-background"
            >
              Save config
            </Button>
          </div>
        </div>
        <div
          id="config-editor"
          className="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-frosted bg-background"
        />
        <div
          id="config-status"
          className="mt-3 shrink-0 text-xs text-muted"
          role="status"
          aria-live="polite"
        >
          Waiting for editor...
        </div>
        <div id="config-errors" className="mt-2 shrink-0 text-xs text-danger" role="alert" />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
