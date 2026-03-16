import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  wait: { for: vi.fn().mockResolvedValue(undefined) },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks
const { pollSandboxUntilStopped } = await import("../pollSandboxUntilStopped");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pollSandboxUntilStopped", () => {
  const sandboxId = "sbx-123";
  const apiKey = "test-key";

  it("returns immediately when sandbox is already stopped", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [{ sandboxId, sandboxStatus: "stopped" }],
      }),
    });

    await pollSandboxUntilStopped(sandboxId, apiKey);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("polls until sandbox transitions to stopped", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          sandboxes: [{ sandboxId, sandboxStatus: "running" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          sandboxes: [{ sandboxId, sandboxStatus: "stopped" }],
        }),
      });

    await pollSandboxUntilStopped(sandboxId, apiKey);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max attempts", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [{ sandboxId, sandboxStatus: "running" }],
      }),
    });

    await expect(
      pollSandboxUntilStopped(sandboxId, apiKey, { maxAttempts: 2 }),
    ).rejects.toThrow("Sandbox sbx-123 did not stop");
  });

  it("passes sandbox_id and api key in request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        sandboxes: [{ sandboxId, sandboxStatus: "stopped" }],
      }),
    });

    await pollSandboxUntilStopped(sandboxId, apiKey);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("sandbox_id=sbx-123");
    expect(options.headers["x-api-key"]).toBe("test-key");
  });
});
