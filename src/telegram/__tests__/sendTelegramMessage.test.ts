import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { sendTelegramMessage } = await import("../sendTelegramMessage");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
  process.env.TELEGRAM_CHAT_ID = "456";
});

describe("sendTelegramMessage", () => {
  it("sends a message and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ ok: true }) });

    const result = await sendTelegramMessage("Hello!");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:ABC/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe("456");
    expect(body.text).toBe("Hello!");
    expect(body.parse_mode).toBe("HTML");
  });

  it("returns false when Telegram API returns ok: false", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, description: "Bad Request" }),
    });

    const result = await sendTelegramMessage("Test");

    expect(result).toBe(false);
  });

  it("returns false when TELEGRAM_BOT_TOKEN is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const result = await sendTelegramMessage("Test");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false when TELEGRAM_CHAT_ID is missing", async () => {
    delete process.env.TELEGRAM_CHAT_ID;

    const result = await sendTelegramMessage("Test");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
