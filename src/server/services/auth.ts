import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isAuthorizedBasicHeader(
  header: string | null | undefined,
  username: string,
  password: string,
): boolean {
  if (!header?.startsWith("Basic ")) {
    return false;
  }

  const encoded = header.slice("Basic ".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const actualUsername = decoded.slice(0, separatorIndex);
  const actualPassword = decoded.slice(separatorIndex + 1);

  return safeEqual(actualUsername, username) && safeEqual(actualPassword, password);
}

export function basicAuthMiddleware(username: string, password: string): MiddlewareHandler {
  return async (context, next) => {
    const authorized = isAuthorizedBasicHeader(
      context.req.header("authorization"),
      username,
      password,
    );

    if (!authorized) {
      return context.text("Unauthorized", 401, {
        "WWW-Authenticate": 'Basic realm="Hermes Agent"',
      });
    }

    await next();
  };
}
