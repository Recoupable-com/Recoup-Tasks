import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { warn: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchRecentSubmoduleCommits } = await import("../fetchRecentSubmoduleCommits");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("fetchRecentSubmoduleCommits", () => {
  it("fetches commits for all submodules and formats them", async () => {
    const mockCommit = {
      sha: "abc1234def5678",
      commit: {
        message: "feat: add new feature\n\nLonger description",
        author: { name: "Dev", date: "2026-03-01T10:00:00Z" },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [mockCommit],
    });

    const results = await fetchRecentSubmoduleCommits();

    expect(results.length).toBeGreaterThan(0);

    const apiResult = results.find((r) => r.submodule === "api");
    expect(apiResult).toBeDefined();
    expect(apiResult!.repo).toBe("recoupable/api");
    expect(apiResult!.commits[0].sha).toBe("abc1234"); // first 7 chars
    expect(apiResult!.commits[0].message).toBe("feat: add new feature"); // first line only
    expect(apiResult!.commits[0].author).toBe("Dev");
  });

  it("skips repos where the fetch fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 }) // api fails
      .mockResolvedValue({ ok: true, json: async () => [] }); // rest succeed

    const results = await fetchRecentSubmoduleCommits();

    const apiResult = results.find((r) => r.submodule === "api");
    expect(apiResult).toBeUndefined();
  });

  it("skips repos where fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    const results = await fetchRecentSubmoduleCommits();
    // Should not throw, just skip the errored repo
    expect(Array.isArray(results)).toBe(true);
  });

  it("uses Authorization header with GITHUB_TOKEN", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await fetchRecentSubmoduleCommits();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "token test-token",
        }),
      }),
    );
  });
});
