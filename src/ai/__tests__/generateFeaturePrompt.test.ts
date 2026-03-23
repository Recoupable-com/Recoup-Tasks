import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { generateFeaturePrompt } = await import("../generateFeaturePrompt");

const mockCommits = [
  {
    submodule: "api",
    repo: "recoupable/api",
    commits: [
      { sha: "abc1234", message: "feat: add privy logins endpoint", author: "Dev", date: "2026-03-01T00:00:00Z" },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("generateFeaturePrompt", () => {
  it("returns the Claude-generated prompt on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Build a feature X in the api submodule." }],
      }),
    });

    const result = await generateFeaturePrompt(mockCommits);

    expect(result).toBe("Build a feature X in the api submodule.");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
  });

  it("returns fallback prompt when API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await generateFeaturePrompt(mockCommits);

    expect(result).toContain("PROGRESS.md");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fallback prompt when Anthropic API call fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await generateFeaturePrompt(mockCommits);

    expect(result).toContain("PROGRESS.md");
  });

  it("returns fallback prompt when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await generateFeaturePrompt(mockCommits);

    expect(result).toContain("PROGRESS.md");
  });
});
