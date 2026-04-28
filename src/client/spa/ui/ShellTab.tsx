import { useMemo, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { useXTerm } from "react-xtermjs";
import { FitAddon } from "@xterm/addon-fit";
import { ApiFetcher } from "../../api-fetcher";
import { PROFILE_CHANGED_EVENT } from "../../lib/event";

export function ShellTab() {
  const api = useMemo(() => new ApiFetcher(), []);
  const fitAddon = useMemo(() => new FitAddon(), []);
  const socketRef = useRef<Socket | null>(null);
  const { ref, instance } = useXTerm({
    addons: [fitAddon],
    options: {
      cursorBlink: true,
      fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#0099ff",
        selectionBackground: "#0099ff55",
      },
    },
    listeners: {
      onData: (input) => {
        socketRef.current?.emit("terminal:input", input);
      },
    },
  });

  useSyncExternalStore(
    (onStoreChange) => {
      if (!instance || !ref.current) {
        return () => undefined;
      }

      const host = ref.current;
      const connectSocket = (): Socket => {
        const socket = io({
          transports: ["websocket"],
          auth: { token: api.getBasicAuthToken() },
        });

        const resize = (): void => {
          if (host.offsetWidth < 2 || host.offsetHeight < 2) {
            return;
          }
          fitAddon.fit();
          if (socket.connected) {
            socket.emit("terminal:resize", { cols: instance.cols, rows: instance.rows });
          }
        };

        socket.on("connect", () => {
          socket.emit("terminal:start");
          resize();
        });
        socket.on("terminal:output", (data: string) => instance.write(data));
        socket.on("terminal:exit", ({ exitCode }: { exitCode: number }) => {
          instance.writeln(`\r\n[process exited ${exitCode}]\r\n`);
        });

        const resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(host);
        window.addEventListener("resize", resize);
        resize();

        const originalDisconnect = socket.disconnect.bind(socket);
        socket.disconnect = () => {
          window.removeEventListener("resize", resize);
          resizeObserver.disconnect();
          originalDisconnect();
          return socket;
        };

        return socket;
      };

      socketRef.current = connectSocket();

      const onProfileChanged = () => {
        socketRef.current?.disconnect();
        socketRef.current = connectSocket();
        onStoreChange();
      };

      window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
      return () => {
        window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        socketRef.current?.disconnect();
        socketRef.current = null;
      };
    },
    () => 0,
    () => 0,
  );

  return (
    <section
      data-tab-panel="shell"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-sm text-muted">Interactive shell</p>
        <button
          id="shell-clear"
          type="button"
          className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          onClick={() => instance?.clear()}
        >
          Clear
        </button>
      </div>
      <div ref={ref} id="terminal" className="min-h-[320px] flex-1 rounded-lg bg-background" />
    </section>
  );
}
