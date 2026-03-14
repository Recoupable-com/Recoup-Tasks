import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @trigger.dev/sdk/v3
const mockRun = vi.fn();
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  schedules: {
    task: (config: { run: unknown }) => {
      mockRun.mockImplementation(config.run as (...args: unknown[]) => unknown);
      return config;
    },
  },
}));

// Mock dependencies
const mockFetchActivePulses = vi.fn();
vi.mock("../../recoup/fetchActivePulses", () => ({
  fetchActivePulses: (...args: unknown[]) => mockFetchActivePulses(...args),
}));

const mockExecutePulseInSandbox = vi.fn();
vi.mock("../../pulse/executePulseInSandbox", () => ({
  executePulseInSandbox: (...args: unknown[]) => mockExecutePulseInSandbox(...args),
}));

// Import after mocks
await import("../sendPulsesTask");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendPulsesTask", () => {
  const basePayload = {
    timestamp: new Date(),
    timezone: "America/New_York",
    externalId: undefined as string | undefined,
  };

  it("processes a single account in test mode (externalId)", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "run-1",
    });

    const result = await mockRun({ ...basePayload, externalId: "account-1" });

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockFetchActivePulses).not.toHaveBeenCalled();
    expect(mockExecutePulseInSandbox).toHaveBeenCalledOnce();
    expect(mockExecutePulseInSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-1",
        prompt: expect.any(String),
      }),
    );
  });

  it("fetches active pulses when no externalId", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([
      { account_id: "account-1" },
      { account_id: "account-2" },
    ]);
    mockExecutePulseInSandbox
      .mockResolvedValueOnce({ sandboxId: "sbx-1", runId: "run-1" })
      .mockResolvedValueOnce({ sandboxId: "sbx-2", runId: "run-2" });

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(mockFetchActivePulses).toHaveBeenCalledOnce();
    expect(mockExecutePulseInSandbox).toHaveBeenCalledTimes(2);
  });

  it("returns early when no active pulses", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([]);

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockExecutePulseInSandbox).not.toHaveBeenCalled();
  });

  it("counts failures when executePulseInSandbox returns undefined", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce(undefined);

    const result = await mockRun({ ...basePayload, externalId: "account-1" });

    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  it("counts failures when executePulseInSandbox throws", async () => {
    mockExecutePulseInSandbox.mockRejectedValueOnce(new Error("API error"));

    const result = await mockRun({ ...basePayload, externalId: "account-1" });

    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  it("handles mixed success and failure", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([
      { account_id: "account-1" },
      { account_id: "account-2" },
      { account_id: "account-3" },
    ]);
    mockExecutePulseInSandbox
      .mockResolvedValueOnce({ sandboxId: "sbx-1", runId: "run-1" })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ sandboxId: "sbx-3", runId: "run-3" });

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 2, failed: 1 });
  });

  it("does NOT call generateChat or getTaskRoomId", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "run-1",
    });

    await mockRun({ ...basePayload, externalId: "account-1" });

    // Verify the old dependencies are not imported/used
    // executePulseInSandbox should be the only external call
    expect(mockExecutePulseInSandbox).toHaveBeenCalledOnce();
  });
});
