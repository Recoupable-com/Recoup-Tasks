import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { createOrgGithubRepo } = await import("../createOrgGithubRepo");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("createOrgGithubRepo", () => {
  it("creates repo with org- prefix and returns URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        html_url: "https://github.com/Recoupable-Com/org-test-org-uuid-123",
      }),
    });

    const result = await createOrgGithubRepo("Test Org", "uuid-123");

    expect(result).toBe(
      "https://github.com/Recoupable-Com/org-test-org-uuid-123"
    );
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify the request body has the right repo name and auto_init
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.name).toBe("org-test-org-uuid-123");
    expect(body.private).toBe(true);
    expect(body.auto_init).toBe(true);
  });

  it("fetches existing repo on 422", async () => {
    // First call: 422 (already exists)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "Validation Failed",
    });

    // Second call: GET existing repo
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        html_url: "https://github.com/Recoupable-Com/org-my-org-uuid-456",
      }),
    });

    const result = await createOrgGithubRepo("My Org", "uuid-456");

    expect(result).toBe(
      "https://github.com/Recoupable-Com/org-my-org-uuid-456"
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns undefined on other errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const result = await createOrgGithubRepo("Test", "uuid-789");

    expect(result).toBeUndefined();
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;

    const result = await createOrgGithubRepo("Test", "uuid-000");

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Regression: repos created without auto_init were empty (no commits),
  // causing "fatal: You are on a branch yet to be born" when used as submodules
  it("sends auto_init: true to prevent empty repos", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        html_url: "https://github.com/recoupable/org-test-uuid-auto",
      }),
    });

    await createOrgGithubRepo("Test", "uuid-auto");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("auto_init", true);
  });

  it("sanitizes org name for repo name", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        html_url:
          "https://github.com/Recoupable-Com/org-my-cool-org-uuid-111",
      }),
    });

    await createOrgGithubRepo("My Cool Org!!!", "uuid-111");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe("org-my-cool-org-uuid-111");
  });
});
