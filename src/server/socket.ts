import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isAuthorizedBasicHeader } from "./services/auth";
import type { TerminalManager } from "./services/terminal-manager";
import type { AppEnv } from "./types";

export function attachSocketServer(
  server: HttpServer,
  env: AppEnv,
  terminals: TerminalManager,
): Server {
  const io = new Server(server);

  io.use((socket, next) => {
    const header = socket.handshake.headers.authorization;
    const authorized = isAuthorizedBasicHeader(
      Array.isArray(header) ? header[0] : header,
      env.adminUsername,
      env.adminPassword,
    );

    if (!authorized) {
      next(new Error("Unauthorized"));
      return;
    }

    next();
  });

  io.on("connection", (socket) => {
    let session = createSession(socket.id);

    const bindSession = (): void => {
      if (!session) {
        return;
      }

      session.onData((data) => socket.emit("terminal:output", data));
      session.onExit((exitCode) => socket.emit("terminal:exit", { exitCode }));
    };

    bindSession();

    socket.on("terminal:start", () => {
      session?.kill();
      session = createSession(socket.id);
      bindSession();
    });

    socket.on("terminal:input", (input: string) => {
      session?.write(input);
    });

    socket.on("terminal:resize", (size: { cols: number; rows: number }) => {
      session?.resize(size.cols, size.rows);
    });

    socket.on("disconnect", () => {
      setTimeout(() => terminals.close(socket.id), 500).unref();
    });

    function createSession(socketId: string) {
      try {
        return terminals.create(socketId);
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);
        socket.emit("terminal:output", `\r\n[failed to start bash: ${message}]\r\n`);
        socket.emit("terminal:exit", { exitCode: 1 });
        return null;
      }
    }
  });

  return io;
}
