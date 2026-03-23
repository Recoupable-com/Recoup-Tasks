import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { postToSlackChannel } = await import("../postToSlackChannel");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
});

describe("postToSlackChannel", () => {
  it("posts a message to the correct channel and returns true", async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ ok: true }) });

    const result = await postToSlackChannel("C08HN8RKJHZ", "Hello, world!");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xoxb-test-token",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.channel).toBe("C08HN8RKJHZ");
    expect(body.text).toBe("Hello, world!");
  });

  it("returns false when Slack API returns ok: false", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, error: "channel_not_found" }),
    });

    const result = await postToSlackChannel("CINVALID", "Test");

    expect(result).toBe(false);
  });

  it("returns false and logs error when SLACK_BOT_TOKEN is missing", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const { logger } = await import("@trigger.dev/sdk/v3");

    const result = await postToSlackChannel("C08HN8RKJHZ", "Test");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("SLACK_BOT_TOKEN"));
  });
});
