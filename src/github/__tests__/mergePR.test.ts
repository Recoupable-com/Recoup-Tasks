import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { mergePR } = await import("../mergePR");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("mergePR", () => {
  it("merges the PR and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await mergePR("recoupable/api", 42);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/pulls/42/merge",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "token test-token",
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.merge_method).toBe("squash");
  });

  it("returns false when merge fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 405,
      text: async () => "Pull Request is not mergeable",
    });

    const result = await mergePR("recoupable/api", 42);

    expect(result).toBe(false);
  });
});
