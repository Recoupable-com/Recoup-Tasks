import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Must import after mocks are set up
const { getAccountOrgs } = await import("../getAccountOrgs");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAccountOrgs", () => {
  it("returns org info on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        organizations: [
          {
            organization_id: "org-123",
            organization_name: "Test Org",
          },
          {
            organization_id: "org-456",
            organization_name: "Another Org",
          },
        ],
      }),
    });

    const result = await getAccountOrgs("account-1");

    expect(result).toEqual([
      { organizationId: "org-123", organizationName: "Test Org" },
      { organizationId: "org-456", organizationName: "Another Org" },
    ]);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain(
      "/api/organizations?account_id=account-1"
    );
  });

  it("returns empty array when account has no orgs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        organizations: [],
      }),
    });

    const result = await getAccountOrgs("account-1");

    expect(result).toEqual([]);
  });

  it("returns undefined on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const result = await getAccountOrgs("account-1");

    expect(result).toBeUndefined();
  });

  it("returns undefined on invalid response schema", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wrong: "schema" }),
    });

    const result = await getAccountOrgs("account-1");

    expect(result).toBeUndefined();
  });

  it("returns undefined on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getAccountOrgs("account-1");

    expect(result).toBeUndefined();
  });
});
