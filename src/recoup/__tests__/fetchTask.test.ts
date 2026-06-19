import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Shared logger object the mocked module returns; assertions run against it.
const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
vi.mock("@trigger.dev/sdk/v3", () => ({ logger }));

const ORIGINAL_KEY = process.env.RECOUP_API_KEY;

const validTask = {
  id: "t1",
  title: "Daily check-in",
  prompt: "Draft a check-in",
  schedule: "0 9 * * *",
  account_id: "acc_owner",
  artist_account_id: "artist_1",
  enabled: true,
};

describe("fetchTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.RECOUP_API_KEY = "test-key";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.RECOUP_API_KEY;
    else process.env.RECOUP_API_KEY = ORIGINAL_KEY;
  });

  it("sends the x-api-key header from RECOUP_API_KEY on the GET request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", tasks: [validTask] }),
    });

    const { fetchTask } = await import("../fetchTask");
    const result = await fetchTask("351fc5b2");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://recoup-api.vercel.app/api/tasks?id=351fc5b2",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "test-key",
        }),
      }),
    );
    expect(result).toEqual({
      prompt: "Draft a check-in",
      accountId: "acc_owner",
      artistId: "artist_1",
      model: undefined,
    });
  });

  it("returns undefined and logs an error when RECOUP_API_KEY is missing", async () => {
    delete process.env.RECOUP_API_KEY;

    const { fetchTask } = await import("../fetchTask");
    const result = await fetchTask("351fc5b2");

    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("logs an auth failure (not a generic error) when the API responds 401", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const { fetchTask } = await import("../fetchTask");
    const result = await fetchTask("351fc5b2");

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("auth"),
      expect.objectContaining({ status: 401 }),
    );
  });
});
