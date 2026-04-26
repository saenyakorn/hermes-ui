import { FitAddon } from "@xterm/addon-fit";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { Terminal } from "xterm";

function resizeTerminal(
  host: HTMLElement,
  terminal: Terminal,
  fit: FitAddon,
  socket: Socket,
): void {
  if (host.offsetWidth < 2 || host.offsetHeight < 2) {
    return;
  }

  fit.fit();
  if (socket.connected) {
    socket.emit("terminal:resize", { cols: terminal.cols, rows: terminal.rows });
  }
}

function getBasicAuthTokenFromLocation(): string | undefined {
  const url = new URL(window.location.href);
  if (!url.username || !url.password) {
    return undefined;
  }

  return `Basic ${btoa(`${url.username}:${url.password}`)}`;
}

const terminalElement = document.querySelector<HTMLElement>("#terminal");

if (terminalElement) {
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
  terminal.open(terminalElement);

  const socket = io({
    transports: ["websocket"],
    auth: {
      token: getBasicAuthTokenFromLocation(),
    },
  });

  resizeTerminal(terminalElement, terminal, fit, socket);

  terminal.onData((input) => {
    socket.emit("terminal:input", input);
  });

  socket.on("connect", () => {
    terminal.writeln("\r\n[connected]\r\n");
    socket.emit("terminal:start");
    resizeTerminal(terminalElement, terminal, fit, socket);
  });

  socket.on("terminal:output", (data: string) => {
    terminal.write(data);
  });

  socket.on("terminal:exit", ({ exitCode }: { exitCode: number }) => {
    terminal.writeln(`\r\n[process exited ${exitCode}]\r\n`);
  });

  window.addEventListener("resize", () => {
    resizeTerminal(terminalElement, terminal, fit, socket);
  });

  const observer = new ResizeObserver(() => {
    resizeTerminal(terminalElement, terminal, fit, socket);
  });
  observer.observe(terminalElement);
  const panel = terminalElement.closest<HTMLElement>('[role="tabpanel"]');
  if (panel) {
    const visibilityObserver = new MutationObserver(() => {
      resizeTerminal(terminalElement, terminal, fit, socket);
    });
    visibilityObserver.observe(panel, {
      attributes: true,
      attributeFilter: ["hidden", "style", "class", "data-state"],
    });
  }

  document.querySelector<HTMLButtonElement>("#terminal-clear")?.addEventListener("click", () => {
    terminal.clear();
  });
}
