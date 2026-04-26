/** @jsxImportSource hono/jsx */

import { ConfigTabPanel } from "./tabs/config-tab";
import { ControlTabPanel } from "./tabs/control-tab";
import { EnvTabPanel } from "./tabs/env-tab";
import { LogsTabPanel } from "./tabs/logs-tab";
import { MessagingTabPanel } from "./tabs/messaging-tab";
import { ModelProvidersTabPanel } from "./tabs/model-providers-tab";
import { ShellTabPanel } from "./tabs/shell-tab";
import { WorkspaceTabStrip } from "./workspace-tab-strip";

export function renderHtmlDocument(title: string, initialStatus: string): string {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
        <script src="/assets/vendor/htmx.min.js" />
      </head>
      <body>
        <main class="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
          <section class="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4">
            <section
              id="workspace"
              class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3"
            >
              <WorkspaceTabStrip />
              <ControlTabPanel />
              <LogsTabPanel />
              <ShellTabPanel />
              <ConfigTabPanel />
              <EnvTabPanel />
              <MessagingTabPanel />
              <ModelProvidersTabPanel />
            </section>
          </section>
        </main>
        <script type="module" src="/assets/main.js" data-initial-status={initialStatus} />
      </body>
    </html>
  ).toString();
}
