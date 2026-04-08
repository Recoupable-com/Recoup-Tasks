import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { detectFace } from "../detectFace";

function mockChatResponse(text: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ text }),
  };
}

describe("detectFace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RECOUP_API_KEY = "test-key";
  });

  it("returns true when the model says the image contains a face", async () => {
    mockFetch.mockResolvedValue(mockChatResponse("true"));

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
  });

  it("returns false when the model says no face is present", async () => {
    mockFetch.mockResolvedValue(mockChatResponse("false"));

    const result = await detectFace("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("sends the image URL in the prompt to the chat API", async () => {
    mockFetch.mockResolvedValue(mockChatResponse("true"));

    await detectFace("https://example.com/photo.png");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/chat/generate");
    const body = JSON.parse(options.body);
    expect(body.prompt).toContain("https://example.com/photo.png");
  });

  it("returns false when API call fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });

  it("returns false when API returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });

  it("logs the error when detection fails", async () => {
    const { logStep } = await import("../../sandboxes/logStep");
    mockFetch.mockRejectedValue(new Error("Rate limit exceeded"));

    await detectFace("https://example.com/broken.png");

    expect(logStep).toHaveBeenCalledWith(
      "Face detection failed, assuming no face",
      false,
      expect.objectContaining({ error: "Rate limit exceeded" }),
    );
  });

  it("handles whitespace and casing in model response", async () => {
    mockFetch.mockResolvedValue(mockChatResponse("  True  "));

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
  });
});
