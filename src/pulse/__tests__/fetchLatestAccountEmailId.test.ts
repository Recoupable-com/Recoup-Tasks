import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchLatestAccountEmailId } = await import("../fetchLatestAccountEmailId");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchLatestAccountEmailId", () => {
  const accountId = "acc-123";
  const apiKey = "test-key";

  it("returns email_id from the most recent email", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        emails: [{ id: "resend-email-abc", created_at: "2026-03-16T10:00:00Z" }],
      }),
    });

    const result = await fetchLatestAccountEmailId(accountId, apiKey);

    expect(result).toBe("resend-email-abc");
  });

  it("returns null when no emails found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", emails: [] }),
    });

    const result = await fetchLatestAccountEmailId(accountId, apiKey);

    expect(result).toBeNull();
  });

  it("returns null when API returns error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const result = await fetchLatestAccountEmailId(accountId, apiKey);

    expect(result).toBeNull();
  });

  it("passes account_id and api key in request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", emails: [] }),
    });

    await fetchLatestAccountEmailId(accountId, apiKey);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("account_id=acc-123");
    expect(options.headers["x-api-key"]).toBe("test-key");
  });
});
