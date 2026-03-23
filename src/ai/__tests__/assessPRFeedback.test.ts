import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { assessPRFeedback } = await import("../assessPRFeedback");

const noFeedback = { reviews: [], comments: [] };
const withFeedback = {
  reviews: [
    {
      author: "reviewer",
      body: "Missing error handling in the route handler.",
      state: "CHANGES_REQUESTED",
      submittedAt: "2026-03-01T12:00:00Z",
    },
  ],
  comments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("assessPRFeedback", () => {
  it("returns no actionable feedback when reviews and comments are empty", async () => {
    const result = await assessPRFeedback("recoupable/api", "Build feature X", noFeedback);

    expect(result.hasActionableFeedback).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns actionable feedback parsed from Claude response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              hasActionableFeedback: true,
              feedbackSummary: "Add error handling",
              implementation: "Wrap the handler in a try/catch and return 500 on error",
            }),
          },
        ],
      }),
    });

    const result = await assessPRFeedback(
      "recoupable/api",
      "Build feature X",
      withFeedback,
    );

    expect(result.hasActionableFeedback).toBe(true);
    expect(result.feedbackSummary).toBe("Add error handling");
    expect(result.implementation).toContain("try/catch");
  });

  it("returns no actionable feedback when API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await assessPRFeedback("recoupable/api", "Build feature X", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns no actionable feedback when API call fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await assessPRFeedback("recoupable/api", "Feature", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
  });

  it("returns no actionable feedback when JSON parsing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "not valid json" }],
      }),
    });

    const result = await assessPRFeedback("recoupable/api", "Feature", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
  });
});
