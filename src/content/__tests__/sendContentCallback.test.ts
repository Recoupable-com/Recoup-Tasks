import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

import { sendContentCallback } from "../sendContentCallback";
import type { ContentRunResult } from "../pollContentRuns";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, CODING_AGENT_CALLBACK_SECRET: "test-secret" };
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("sendContentCallback", () => {
  it("throws when CODING_AGENT_CALLBACK_SECRET is missing", async () => {
    delete process.env.CODING_AGENT_CALLBACK_SECRET;

    await expect(
      sendContentCallback("thread-1", "completed", []),
    ).rejects.toThrow("CODING_AGENT_CALLBACK_SECRET is required");
  });

  it("sends correct payload to callback endpoint", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const results: ContentRunResult[] = [
      { runId: "run-1", status: "completed", videoUrl: "https://v.mp4" },
    ];

    await sendContentCallback("thread-1", "completed", results);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://recoup-api.vercel.app/api/content-agent/callback");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({
      threadId: "thread-1",
      status: "completed",
      results,
    });
    expect((options?.headers as Record<string, string>)["x-callback-secret"]).toBe("test-secret");
  });

  it("uses CONTENT_AGENT_CALLBACK_URL env var when set", async () => {
    process.env.CONTENT_AGENT_CALLBACK_URL = "https://preview.example.com/api/content-agent/callback";
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await sendContentCallback("thread-1", "completed", []);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://preview.example.com/api/content-agent/callback");
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal error", { status: 500 }),
    );

    await expect(
      sendContentCallback("thread-1", "completed", []),
    ).rejects.toThrow("Callback failed with status 500");
  });
});
