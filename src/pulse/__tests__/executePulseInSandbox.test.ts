import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set env var before import so consts.ts picks it up at module load time
process.env.RECOUP_API_KEY = "test-api-key";

// Must import after mocks and env are set up
const { executePulseInSandbox } = await import("../executePulseInSandbox");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executePulseInSandbox", () => {
  const accountId = "account-123";
  const prompt = "Send a daily pulse email";

  it("returns sandboxId and runId on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [
          {
            sandboxId: "sbx-abc",
            sandboxStatus: "running",
            timeout: 600000,
            createdAt: "2026-02-24T09:00:00.000Z",
            runId: "run-xyz",
          },
        ],
      }),
    });

    const result = await executePulseInSandbox({ accountId, prompt });

    expect(result).toEqual({ sandboxId: "sbx-abc", runId: "run-xyz" });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain("/api/sandboxes");
    expect(mockFetch.mock.calls[0][0]).not.toContain("account_id");
    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.method).toBe("POST");
    expect(JSON.parse(fetchOptions.body)).toEqual({
      account_id: accountId,
      prompt,
    });
  });

  it("returns sandboxId with undefined runId when no command triggered", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [
          {
            sandboxId: "sbx-abc",
            sandboxStatus: "running",
            timeout: 600000,
            createdAt: "2026-02-24T09:00:00.000Z",
          },
        ],
      }),
    });

    const result = await executePulseInSandbox({ accountId, prompt });

    expect(result).toEqual({ sandboxId: "sbx-abc", runId: undefined });
  });

  it("returns undefined on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const result = await executePulseInSandbox({ accountId, prompt });

    expect(result).toBeUndefined();
  });

  it("returns undefined on invalid response schema", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ wrong: "schema" }),
    });

    const result = await executePulseInSandbox({ accountId, prompt });

    expect(result).toBeUndefined();
  });

  it("returns undefined on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await executePulseInSandbox({ accountId, prompt });

    expect(result).toBeUndefined();
  });

  it("throws when RECOUP_API_KEY is not configured", async () => {
    const original = process.env.RECOUP_API_KEY;
    delete process.env.RECOUP_API_KEY;

    vi.resetModules();
    vi.mock("@trigger.dev/sdk/v3", () => ({
      logger: { log: vi.fn(), error: vi.fn() },
    }));
    const mod = await import("../executePulseInSandbox");

    await expect(mod.executePulseInSandbox({ accountId, prompt })).rejects.toThrow(
      "RECOUP_API_KEY not configured",
    );

    process.env.RECOUP_API_KEY = original;
  });

  it("sends correct headers including x-api-key", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [
          {
            sandboxId: "sbx-abc",
            sandboxStatus: "running",
            timeout: 600000,
            createdAt: "2026-02-24T09:00:00.000Z",
            runId: "run-xyz",
          },
        ],
      }),
    });

    await executePulseInSandbox({ accountId, prompt });

    const fetchOptions = mockFetch.mock.calls[0][1];
    expect(fetchOptions.headers["Content-Type"]).toBe("application/json");
    expect(fetchOptions.headers["x-api-key"]).toBeDefined();
  });
});
