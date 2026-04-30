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
});
