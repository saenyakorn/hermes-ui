import { describe, expect, it } from "vitest";
import { parseLogStreamFrames } from "../src/client/api-fetcher";

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
