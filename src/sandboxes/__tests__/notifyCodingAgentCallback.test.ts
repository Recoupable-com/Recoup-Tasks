import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { notifyCodingAgentCallback } = await import("../notifyCodingAgentCallback");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CODING_AGENT_CALLBACK_URL = "https://recoup-api.vercel.app/api/coding-agent/callback";
  process.env.CODING_AGENT_CALLBACK_SECRET = "test-secret";
});

describe("notifyCodingAgentCallback", () => {
  it("posts callback with correct headers and body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifyCodingAgentCallback({
      threadId: "slack:C123:123",
      status: "pr_created",
      branch: "agent/fix-123",
      snapshotId: "snap_abc",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://recoup-api.vercel.app/api/coding-agent/callback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-callback-secret": "test-secret",
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.threadId).toBe("slack:C123:123");
    expect(body.status).toBe("pr_created");
  });

  it("logs error when callback URL is not set", async () => {
    delete process.env.CODING_AGENT_CALLBACK_URL;
    const { logger } = await import("@trigger.dev/sdk/v3");

    await notifyCodingAgentCallback({
      threadId: "slack:C123:123",
      status: "no_changes",
    });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("CODING_AGENT_CALLBACK_URL"));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
