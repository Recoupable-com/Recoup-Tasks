import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @trigger.dev/sdk/v3
const mockRun = vi.fn();
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
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

const mockBatchTriggerAndWait = vi.fn();
vi.mock("../sendPulseTask", () => ({
  sendPulseTask: {
    batchTriggerAndWait: (...args: unknown[]) =>
      mockBatchTriggerAndWait(...args),
  },
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
    mockBatchTriggerAndWait.mockResolvedValueOnce({
      runs: [{ ok: true, output: { sandboxId: "sbx-1", runId: "run-1" } }],
    });

    const result = await mockRun({ ...basePayload, externalId: "account-1" });

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockFetchActivePulses).not.toHaveBeenCalled();
    expect(mockBatchTriggerAndWait).toHaveBeenCalledOnce();
    expect(mockBatchTriggerAndWait).toHaveBeenCalledWith([
      {
        payload: { accountId: "account-1", prompt: expect.any(String) },
        options: { tags: ["account:account-1"] },
      },
    ]);
  });

  it("fetches active pulses when no externalId", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([
      { account_id: "account-1" },
      { account_id: "account-2" },
    ]);
    mockBatchTriggerAndWait.mockResolvedValueOnce({
      runs: [
        { ok: true, output: { sandboxId: "sbx-1", runId: "run-1" } },
        { ok: true, output: { sandboxId: "sbx-2", runId: "run-2" } },
      ],
    });

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(mockFetchActivePulses).toHaveBeenCalledOnce();
    expect(mockBatchTriggerAndWait).toHaveBeenCalledOnce();
  });

  it("returns early when no active pulses", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([]);

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockBatchTriggerAndWait).not.toHaveBeenCalled();
  });

  it("counts failures when sub-task returns ok: false", async () => {
    mockBatchTriggerAndWait.mockResolvedValueOnce({
      runs: [{ ok: false, error: "Sandbox error" }],
    });

    const result = await mockRun({ ...basePayload, externalId: "account-1" });

    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  it("handles mixed success and failure", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([
      { account_id: "account-1" },
      { account_id: "account-2" },
      { account_id: "account-3" },
    ]);
    mockBatchTriggerAndWait.mockResolvedValueOnce({
      runs: [
        { ok: true, output: { sandboxId: "sbx-1", runId: "run-1" } },
        { ok: false, error: "Failed" },
        { ok: true, output: { sandboxId: "sbx-3", runId: "run-3" } },
      ],
    });

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sent: 2, failed: 1 });
  });

  it("tags each sub-task with account:<accountId>", async () => {
    mockFetchActivePulses.mockResolvedValueOnce([
      { account_id: "account-abc" },
      { account_id: "account-xyz" },
    ]);
    mockBatchTriggerAndWait.mockResolvedValueOnce({
      runs: [
        { ok: true, output: { sandboxId: "sbx-1", runId: "run-1" } },
        { ok: true, output: { sandboxId: "sbx-2", runId: "run-2" } },
      ],
    });

    await mockRun(basePayload);

    expect(mockBatchTriggerAndWait).toHaveBeenCalledWith([
      {
        payload: { accountId: "account-abc", prompt: expect.any(String) },
        options: { tags: ["account:account-abc"] },
      },
      {
        payload: { accountId: "account-xyz", prompt: expect.any(String) },
        options: { tags: ["account:account-xyz"] },
      },
    ]);
  });
});
