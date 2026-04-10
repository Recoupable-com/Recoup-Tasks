import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

describe("callRecoupApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RECOUP_API_KEY = "test-key";
    process.env.RECOUP_API_BASE_URL = "https://api.test.com";
  });

  it("makes a POST request with api key and json body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: "https://example.com/img.png" }),
    });

    const { callRecoupApi } = await import("../callRecoupApi");
    const result = await callRecoupApi("/api/content/image", { prompt: "sunset" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/api/content/image",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ prompt: "sunset" }),
      }),
    );
    expect(result).toEqual({ imageUrl: "https://example.com/img.png" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
    });

    const { callRecoupApi } = await import("../callRecoupApi");
    await expect(callRecoupApi("/api/content/image", { prompt: "" }))
      .rejects.toThrow("API call failed");
  });

  it("logs the request and response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ imageUrl: "https://example.com/img.png" }),
    });

    const { logStep } = await import("../../sandboxes/logStep");
    const { callRecoupApi } = await import("../callRecoupApi");
    await callRecoupApi("/api/content/image", { prompt: "sunset" });

    expect(vi.mocked(logStep)).toHaveBeenCalledWith(
      expect.stringContaining("/api/content/image"),
      expect.any(Boolean),
      expect.objectContaining({ status: 200 }),
    );
  });

  it("handles non-JSON error responses (e.g. 502)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error("not json"); },
      text: async () => "Bad Gateway",
    });

    const { callRecoupApi } = await import("../callRecoupApi");
    await expect(callRecoupApi("/api/content/image", { prompt: "" }))
      .rejects.toThrow("502");
  });

  it("supports PATCH method", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run_123" }),
    });

    const { callRecoupApi } = await import("../callRecoupApi");
    await callRecoupApi("/api/content", { video_url: "https://example.com/v.mp4" }, "PATCH");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/api/content",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
