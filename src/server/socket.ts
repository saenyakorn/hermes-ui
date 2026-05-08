import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { isAuthorizedBasicHeader } from "./services/auth";
import { isValidProfileName } from "./services/paths";
import type { TerminalManager } from "./services/terminal-manager";
import type { AppEnv } from "./types";

type SocketHandshake = {
  headers: Record<string, string | string[] | undefined>;
  auth?: Record<string, unknown>;
};

export function isSocketAuthorized(
  handshake: SocketHandshake,
  username: string,
  password: string,
): boolean {
  const header = handshake.headers.authorization;
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (isAuthorizedBasicHeader(headerValue, username, password)) {
    return true;
  }

  const authToken = handshake.auth?.token;
  if (typeof authToken === "string") {
    return isAuthorizedBasicHeader(authToken, username, password);
  }

  return false;
}

/** Coerces an arbitrary handshake/payload value into a profile slug or null. */
function readProfileFromUnknown(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || value === "default") {
    return null;
  }
  return isValidProfileName(value) ? value : null;
}

export function attachSocketServer(
  server: HttpServer,
  env: AppEnv,
  terminals: TerminalManager,
): Server {
  const io = new Server(server);

  io.use((socket, next) => {
    const authorized = isSocketAuthorized(socket.handshake, env.adminUsername, env.adminPassword);

    if (!authorized) {
      next(new Error("Unauthorized"));
      return;
    }

    next();
  });

  io.on("connection", (socket) => {
    let activeProfile: string | null = readProfileFromUnknown(socket.handshake.auth?.profile);

    let session = createSession(socket.id, activeProfile);

    const bindSession = (): void => {
      if (!session) {
        return;
      }

      session.onData((data) => socket.emit("terminal:output", data));
      session.onExit((exitCode) => socket.emit("terminal:exit", { exitCode }));
    };

    bindSession();

    socket.on("terminal:start", (payload?: { profile?: unknown }) => {
      session?.kill();
      const requested = readProfileFromUnknown(payload?.profile);
      activeProfile = requested;
      session = createSession(socket.id, activeProfile);
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

    function createSession(socketId: string, profile: string | null) {
      try {
        return terminals.create(socketId, profile);
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
