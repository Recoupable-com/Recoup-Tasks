import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Must import after mocks are set up
const { fetchTask } = await import("../fetchTask");

beforeEach(() => {
  vi.clearAllMocks();
});

const makeTaskResponse = (overrides = {}) => ({
  status: "success",
  tasks: [
    {
      id: "task-123",
      title: "Test Task",
      prompt: "Do something",
      schedule: "0 21 * * 0",
      account_id: "account-123",
      artist_account_id: "artist-456",
      enabled: true,
      model: null,
      ...overrides,
    },
  ],
});

describe("fetchTask", () => {
  it("returns task config for enabled task", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTaskResponse(),
    });

    const result = await fetchTask("task-123");

    expect(result).toEqual({
      prompt: "Do something",
      accountId: "account-123",
      artistId: "artist-456",
      model: undefined,
    });
  });

  it("returns undefined for disabled task (enabled: false)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTaskResponse({ enabled: false }),
    });

    const result = await fetchTask("task-123");

    expect(result).toBeUndefined();
  });

  it("returns task config when enabled is null (legacy data)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTaskResponse({ enabled: null }),
    });

    const result = await fetchTask("task-123");

    expect(result).toBeDefined();
    expect(result?.prompt).toBe("Do something");
  });

  it("returns undefined when no externalId provided", async () => {
    const result = await fetchTask(undefined);
    expect(result).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns undefined when API returns error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await fetchTask("task-123");
    expect(result).toBeUndefined();
  });

  it("returns undefined when no tasks in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", tasks: [] }),
    });

    const result = await fetchTask("task-123");
    expect(result).toBeUndefined();
  });
});
