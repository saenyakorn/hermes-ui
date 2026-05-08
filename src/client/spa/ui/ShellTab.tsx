import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { useXTerm } from "react-xtermjs";
import { FitAddon } from "@xterm/addon-fit";
import { ApiFetcher } from "../../api-fetcher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PROFILE_CHANGED_EVENT } from "../../lib/event";
import { useWorkspaceProfileSubscribed } from "../workspace-profile";

export function ShellTab() {
  const { profile } = useWorkspaceProfileSubscribed();
  const profileRef = useRef<string | null>(profile);
  profileRef.current = profile;
  const api = useMemo(() => new ApiFetcher(), []);
  const fitAddon = useMemo(() => new FitAddon(), []);
  const addons = useMemo(() => [fitAddon], [fitAddon]);
  const xtermOptions = useMemo(
    () => ({
      cursorBlink: true,
      scrollback: 10_000,
      fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#0099ff",
        selectionBackground: "#0099ff55",
      },
    }),
    [],
  );
  const socketRef = useRef<Socket | null>(null);
  const { ref, instance } = useXTerm({
    addons,
    options: xtermOptions,
    listeners: {
      onData: (input) => {
        socketRef.current?.emit("terminal:input", input);
      },
    },
  });

  const connectSocket = useCallback(
    (host: HTMLDivElement, terminalInstance: NonNullable<typeof instance>): Socket => {
      const socket = io({
        transports: ["websocket"],
        auth: { token: api.getBasicAuthToken(), profile: profileRef.current ?? "" },
      });

      const resize = (): void => {
        if (host.offsetWidth < 2 || host.offsetHeight < 2) {
          return;
        }
        fitAddon.fit();
        if (socket.connected) {
          socket.emit("terminal:resize", {
            cols: terminalInstance.cols,
            rows: terminalInstance.rows,
          });
        }
      };

      socket.on("connect", () => {
        socket.emit("terminal:start", { profile: profileRef.current ?? "" });
        resize();
      });
      socket.on("terminal:output", (data: string) => terminalInstance.write(data));
      socket.on("terminal:exit", ({ exitCode }: { exitCode: number }) => {
        terminalInstance.writeln(`\r\n[process exited ${exitCode}]\r\n`);
      });

      const resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(host);
      window.addEventListener("resize", resize);
      const onPointerDown = (): void => {
        terminalInstance.focus();
      };
      const onWheel = (event: WheelEvent): void => {
        if (event.deltaY === 0) {
          return;
        }
        // Keep scrolling inside xterm instead of bubbling to page containers.
        event.preventDefault();
        const lineStep = Math.max(1, Math.round(Math.abs(event.deltaY) / 16));
        terminalInstance.scrollLines(event.deltaY > 0 ? lineStep : -lineStep);
      };
      host.addEventListener("pointerdown", onPointerDown);
      host.addEventListener("wheel", onWheel, { passive: false });
      resize();

      const originalDisconnect = socket.disconnect.bind(socket);
      socket.disconnect = () => {
        window.removeEventListener("resize", resize);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("wheel", onWheel);
        resizeObserver.disconnect();
        originalDisconnect();
        return socket;
      };

      return socket;
    },
    [api, fitAddon, instance],
  );

  const subscribeTerminalRuntime = useCallback(
    (onStoreChange: () => void) => {
      if (!instance) {
        return () => {};
      }
      const host = ref.current;
      if (!host) {
        return () => {};
      }

      socketRef.current = connectSocket(host, instance);

      const onProfileChanged = () => {
        socketRef.current?.disconnect();
        socketRef.current = connectSocket(host, instance);
        onStoreChange();
      };

      window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
      return () => {
        window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        socketRef.current?.disconnect();
        socketRef.current = null;
      };
    },
    [connectSocket, instance, ref],
  );

  useSyncExternalStore(
    subscribeTerminalRuntime,
    () => 0,
    () => 0,
  );

  return (
    <section
      data-tab-panel="shell"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-sm font-semibold text-text">Interactive Shell</p>
        <Button
          id="shell-clear"
          type="button"
          variant="secondary"
          onClick={() => instance?.clear()}
        >
          Clear
        </Button>
      </div>
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col p-3">
        <div
          ref={ref}
          id="terminal"
          className="min-h-0 flex-1 overflow-hidden overscroll-contain rounded-lg border border-frosted bg-background"
        />
      </Card>
    </section>
  );
}
