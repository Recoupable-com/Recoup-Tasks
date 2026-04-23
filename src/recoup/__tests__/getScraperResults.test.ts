import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../consts", () => ({
  NEW_API_BASE_URL: "https://recoup-api.vercel.app",
  RECOUP_API_KEY: "test-key",
}));

describe("getScraperResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET /api/apify/runs/{runId} with x-api-key header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "RUNNING", dataset_id: "ds_1" }),
    });

    const { getScraperResults } = await import("../getScraperResults");
    await getScraperResults("run_123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://recoup-api.vercel.app/api/apify/runs/run_123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("returns in-progress payload with nullable dataset_id", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "RUNNING", dataset_id: null }),
    });
    const { getScraperResults } = await import("../getScraperResults");
    const result = await getScraperResults("run_1");
    expect(result).toEqual({ status: "RUNNING", dataset_id: null });
  });

  it("returns completed payload with data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "SUCCEEDED",
        dataset_id: "ds_1",
        data: [{ foo: 1 }],
      }),
    });
    const { getScraperResults } = await import("../getScraperResults");
    const result = await getScraperResults("run_1");
    expect(result).toEqual({
      status: "SUCCEEDED",
      dataset_id: "ds_1",
      data: [{ foo: 1 }],
    });
  });

  it("returns undefined on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "err" });
    const { getScraperResults } = await import("../getScraperResults");
    expect(await getScraperResults("run_1")).toBeUndefined();
  });

  it("returns undefined when runId is empty", async () => {
    const { getScraperResults } = await import("../getScraperResults");
    expect(await getScraperResults("")).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("url-encodes runId", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "RUNNING", dataset_id: null }),
    });
    const { getScraperResults } = await import("../getScraperResults");
    await getScraperResults("run/with?special");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://recoup-api.vercel.app/api/apify/runs/run%2Fwith%3Fspecial",
      expect.anything()
    );
  });
});
