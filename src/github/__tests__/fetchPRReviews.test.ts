import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { warn: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchPRReviews } = await import("../fetchPRReviews");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("fetchPRReviews", () => {
  it("returns reviews and inline comments", async () => {
    const mockReview = {
      user: { login: "reviewer" },
      body: "Please fix the error handling.",
      state: "CHANGES_REQUESTED",
      submitted_at: "2026-03-01T12:00:00Z",
    };
    const mockComment = {
      user: { login: "reviewer" },
      body: "This variable name is unclear.",
      path: "lib/api/handler.ts",
      created_at: "2026-03-01T12:05:00Z",
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [mockReview] })
      .mockResolvedValueOnce({ ok: true, json: async () => [mockComment] });

    const result = await fetchPRReviews("recoupable/api", 42);

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].author).toBe("reviewer");
    expect(result.reviews[0].body).toBe("Please fix the error handling.");
    expect(result.reviews[0].state).toBe("CHANGES_REQUESTED");

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].author).toBe("reviewer");
    expect(result.comments[0].path).toBe("lib/api/handler.ts");
  });

  it("filters out reviews with empty bodies", async () => {
    const mockReview = { user: { login: "bot" }, body: "", state: "APPROVED", submitted_at: "" };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [mockReview] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchPRReviews("recoupable/api", 1);

    expect(result.reviews).toHaveLength(0);
  });

  it("returns empty arrays when fetches fail", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await fetchPRReviews("recoupable/api", 99);

    expect(result.reviews).toEqual([]);
    expect(result.comments).toEqual([]);
  });
});
