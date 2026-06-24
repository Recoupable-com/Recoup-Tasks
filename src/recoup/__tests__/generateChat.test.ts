import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// RECOUP_API_KEY is read at consts import time, so set it before importing.
process.env.RECOUP_API_KEY = "test-key";

const { generateChat } = await import("../generateChat");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateChat (fire-and-forget)", () => {
  it("returns { runId } from a 202 without awaiting generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ runId: "wrun_123" }),
    });

    const result = await generateChat({ prompt: "hi", accountId: "acc-1", roomId: "room-1" });

    expect(result).toEqual({ runId: "wrun_123" });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/chat/runs");
    expect(opts.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(opts.body);
    expect(body.accountId).toBe("acc-1");
    expect(body.messages[0].parts[0].text).toBe("hi");
  });

  it("returns undefined on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "boom",
    });

    const result = await generateChat({ prompt: "hi", accountId: "acc-1", roomId: "room-1" });

    expect(result).toBeUndefined();
  });

  it("returns undefined when an ok response carries no runId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({}),
    });

    const result = await generateChat({ prompt: "hi", accountId: "acc-1", roomId: "room-1" });

    expect(result).toBeUndefined();
  });

  it("forwards artistId and model when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ runId: "wrun_x" }),
    });

    await generateChat({
      prompt: "hi",
      accountId: "acc-1",
      roomId: "r",
      artistId: "art-1",
      model: "anthropic/claude-haiku-4.5",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.artistId).toBe("art-1");
    expect(body.model).toBe("anthropic/claude-haiku-4.5");
  });
});
