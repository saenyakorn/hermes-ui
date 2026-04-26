import { io } from "socket.io-client";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

export function setupTerminal(getAuthToken: () => string | undefined): Terminal | null {
  const host = document.getElementById("terminal");
  if (!(host instanceof HTMLDivElement)) {
    return null;
  }
  const terminal = new Terminal({
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
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(host);
  const socket = io({
    transports: ["websocket"],
    auth: { token: getAuthToken() },
  });

  const resize = (): void => {
    if (host.offsetWidth < 2 || host.offsetHeight < 2) {
      return;
    }
    fit.fit();
    if (socket.connected) {
      socket.emit("terminal:resize", { cols: terminal.cols, rows: terminal.rows });
    }
  };

  const clear = document.getElementById("shell-clear");
  if (clear instanceof HTMLButtonElement) {
    clear.addEventListener("click", () => {
      terminal.clear();
    });
  }

  terminal.onData((input) => socket.emit("terminal:input", input));
  socket.on("connect", () => {
    socket.emit("terminal:start");
    resize();
  });
  socket.on("terminal:output", (data: string) => terminal.write(data));
  socket.on("terminal:exit", ({ exitCode }: { exitCode: number }) => {
    terminal.writeln(`\r\n[process exited ${exitCode}]\r\n`);
  });
  window.addEventListener("resize", resize);
  new ResizeObserver(() => resize()).observe(host);
  resize();
  return terminal;
}
