import { createElement, useCallback, useEffect, useRef } from "react";

function getBasicAuthTokenFromLocation(): string | undefined {
  const url = new URL(window.location.href);
  if (!url.username || !url.password) {
    return undefined;
  }

  return `Basic ${btoa(`${url.username}:${url.password}`)}`;
}

export type TerminalActions = { clear: () => void };

export function Terminal({
  className,
  onReady,
}: {
  className?: string;
  onReady?: (actions: TerminalActions) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<{ clear: () => void } | null>(null);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  useEffect(() => {
    onReady?.({ clear });
  }, [clear, onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let dispose: (() => void) | undefined;
    let cancelled = false;

    const resizeTerminal = (
      terminal: { cols: number; rows: number },
      fit: { fit: () => void },
      socket: { connected: boolean; emit: (event: string, payload?: unknown) => void },
    ): void => {
      if (host.offsetWidth < 2 || host.offsetHeight < 2) {
        return;
      }

      fit.fit();
      if (socket.connected) {
        socket.emit("terminal:resize", { cols: terminal.cols, rows: terminal.rows });
      }
    };

    void Promise.all([
      import("xterm"),
      import("@xterm/addon-fit"),
      import("socket.io-client"),
    ])
      .then(([xtermModule, fitModule, socketModule]) => {
        if (cancelled) {
          return;
        }

        const terminal = new xtermModule.Terminal({
          cursorBlink: true,
          fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          theme: {
            background: "#000000",
            foreground: "#ffffff",
            cursor: "#0099ff",
            selectionBackground: "#0099ff55",
          },
        });
        terminalRef.current = terminal;

        const fit = new fitModule.FitAddon();
        terminal.loadAddon(fit);
        terminal.open(host);

        const socket = socketModule.io({
          transports: ["websocket"],
          auth: {
            token: getBasicAuthTokenFromLocation(),
          },
        });

        resizeTerminal(terminal, fit, socket);

        const disposeOnData = terminal.onData((input: string) => {
          socket.emit("terminal:input", input);
        });

        const onConnect = () => {
          socket.emit("terminal:start");
          resizeTerminal(terminal, fit, socket);
        };
        socket.on("connect", onConnect);

        const onOutput = (data: string) => {
          terminal.write(data);
        };
        socket.on("terminal:output", onOutput);

        const onExit = ({ exitCode }: { exitCode: number }) => {
          terminal.writeln(`\r\n[process exited ${exitCode}]\r\n`);
        };
        socket.on("terminal:exit", onExit);

        const onWindowResize = () => {
          resizeTerminal(terminal, fit, socket);
        };
        window.addEventListener("resize", onWindowResize);

        const resizeObserver = new ResizeObserver(() => {
          resizeTerminal(terminal, fit, socket);
        });
        resizeObserver.observe(host);

        const panel = host.closest<HTMLElement>('[role="tabpanel"]');
        const visibilityObserver = panel
          ? new MutationObserver(() => {
              resizeTerminal(terminal, fit, socket);
            })
          : null;

        if (visibilityObserver && panel) {
          visibilityObserver.observe(panel, {
            attributes: true,
            attributeFilter: ["hidden", "style", "class", "data-state"],
          });
        }

        dispose = () => {
          disposeOnData.dispose();
          window.removeEventListener("resize", onWindowResize);
          resizeObserver.disconnect();
          visibilityObserver?.disconnect();
          socket.off("connect", onConnect);
          socket.off("terminal:output", onOutput);
          socket.off("terminal:exit", onExit);
          socket.disconnect();
          terminal.dispose();
          terminalRef.current = null;
        };
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : String(cause);
          host.textContent = `[failed to initialize terminal: ${message}]`;
        }
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [onReady]);

  return createElement("div", { id: "terminal", ref: hostRef, className });
}
