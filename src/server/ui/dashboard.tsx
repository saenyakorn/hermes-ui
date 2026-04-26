import { Button } from "@base-ui/react/button";
import type { GatewayStatus } from "../types";

export function Dashboard({ status }: { status: GatewayStatus }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-[420px_1fr]">
        <aside className="rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-5">
          <p className="text-xs uppercase text-[#a6a6a6]">Gateway</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
          <div
            id="gateway-status"
            className="mt-6 text-sm text-[#a6a6a6]"
            data-state={status.state}
          >
            State: <span className="text-white">{status.state}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              data-action="start"
              className="rounded-full bg-white px-4 py-2 text-sm text-black"
            >
              Start
            </Button>
            <Button
              data-action="stop"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
            >
              Stop
            </Button>
            <Button
              data-action="restart"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
            >
              Restart
            </Button>
          </div>
          <pre
            id="log-tail"
            className="mt-6 max-h-80 overflow-auto rounded-lg bg-black p-3 text-xs text-[#a6a6a6]"
          />
        </aside>

        <section className="grid min-h-screen grid-rows-[minmax(360px,1fr)_minmax(420px,0.9fr)] gap-4">
          <section className="flex flex-col rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[#a6a6a6]">Interactive shell</p>
              <Button
                id="terminal-clear"
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white"
              >
                Clear
              </Button>
            </div>
            <div id="terminal" className="min-h-[320px] flex-1 rounded-lg bg-black" />
          </section>

          <section className="rounded-xl border border-[rgba(0,153,255,0.25)] bg-[#090909] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-[#a6a6a6]">Hermes Config</p>
                <p id="config-path" className="mt-1 text-sm text-white">
                  data/config.yaml
                </p>
                <p id="config-updated-at" className="mt-1 text-xs text-[#a6a6a6]">
                  Loading config...
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  id="config-reload"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white"
                >
                  Reload from disk
                </Button>
                <Button
                  id="config-save"
                  disabled
                  className="rounded-full bg-white px-3 py-1 text-xs text-black"
                >
                  Save config
                </Button>
              </div>
            </div>
            <div
              id="config-editor"
              className="h-[330px] overflow-hidden rounded-lg border border-white/10 bg-black"
            />
            <div
              id="config-status"
              className="mt-3 text-xs text-[#a6a6a6]"
              role="status"
              aria-live="polite"
            >
              Waiting for editor...
            </div>
            <div id="config-errors" className="mt-2 text-xs text-red-300" role="alert" />
          </section>
        </section>
      </section>
    </main>
  );
}
