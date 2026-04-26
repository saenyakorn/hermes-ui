import { Button } from "@base-ui/react/button";
import { useState } from "react";
import { Terminal } from "../components/terminal";
import type { TerminalActions } from "../components/terminal";

export function ShellTab() {
  const [clearTerminal, setClearTerminal] = useState<() => void>(() => () => undefined);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-sm text-muted">Interactive shell</p>
        <Button onClick={clearTerminal} className="rounded-full bg-frosted px-3 py-1 text-xs text-text">
          Clear
        </Button>
      </div>
      <Terminal
        onReady={({ clear }: TerminalActions) => {
          setClearTerminal(() => clear);
        }}
        className="min-h-[320px] flex-1 rounded-lg bg-background"
      />
    </div>
  );
}
