import { afterEach, describe, expect, it } from "vitest";
import { ApiFetcher, parseLogStreamFrames } from "../src/client/api-fetcher";

type TestWindow = {
  location: {
    href: string;
    origin: string;
  };
  __HERMES_AUTHORIZATION__?: string;
};

function setTestWindow(windowValue: TestWindow): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowValue,
  });
}

describe("parseLogStreamFrames", () => {
  it("extracts log lines from SSE data messages", () => {
    const lines = parseLogStreamFrames('event: log\ndata: {"line":"hello"}');
    expect(lines).toEqual(["hello"]);
  });

  it("ignores malformed payloads and non-line messages", () => {
    const lines = parseLogStreamFrames(
      'data: {"line":"ok"}\ndata: {"nope":1}\ndata: not-json\n:keepalive',
    );
    expect(lines).toEqual(["ok"]);
  });
});

describe("ApiFetcher auth token resolution", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("prefers credentials embedded in current URL", () => {
    setTestWindow({
      location: {
        href: "https://admin:secret@example.test/",
        origin: "https://example.test",
      },
      __HERMES_AUTHORIZATION__: "Basic ignored",
    });
    const api = new ApiFetcher("https://example.test");
    expect(api.getBasicAuthToken()).toBe("Basic YWRtaW46c2VjcmV0");
  });

  it("falls back to bootstrap auth token when URL has no credentials", () => {
    setTestWindow({
      location: {
        href: "https://example.test/",
        origin: "https://example.test",
      },
      __HERMES_AUTHORIZATION__: "Basic dGVzdDp0b2tlbg==",
    });
    const api = new ApiFetcher("https://example.test");
    expect(api.getBasicAuthToken()).toBe("Basic dGVzdDp0b2tlbg==");
  });

  it("adds bootstrap auth token header in authenticatedFetch", async () => {
    setTestWindow({
      location: {
        href: "https://example.test/",
        origin: "https://example.test",
      },
      __HERMES_AUTHORIZATION__: "Basic dGVzdDp0b2tlbg==",
    });

    const originalFetch = globalThis.fetch;
    let authHeaderValue: string | null = null;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      authHeaderValue = headers.get("Authorization");
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const api = new ApiFetcher("https://example.test");
      await api.authenticatedFetch("https://example.test/env");
      expect(authHeaderValue).toBe("Basic dGVzdDp0b2tlbg==");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("encodes non-ascii URL credentials and still sends request", async () => {
    setTestWindow({
      location: {
        href: "https://admin:p%C3%A4ss@example.test/",
        origin: "https://example.test",
      },
    });

    const originalFetch = globalThis.fetch;
    let called = false;
    let authHeaderValue: string | null = null;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      called = true;
      const headers = new Headers(init?.headers);
      authHeaderValue = headers.get("Authorization");
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const api = new ApiFetcher("https://example.test");
      await api.authenticatedFetch("https://example.test/env");
      expect(called).toBe(true);
      expect(authHeaderValue).toBe("Basic YWRtaW46cMOkc3M=");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
