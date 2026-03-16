import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockTagsAdd = vi.fn();
const mockRunsPoll = vi.fn();

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
  tags: { add: (...args: unknown[]) => mockTagsAdd(...args) },
  runs: { poll: (...args: unknown[]) => mockRunsPoll(...args) },
  task: (config: { run: unknown }) => {
    mockRun.mockImplementation(config.run as (...args: unknown[]) => unknown);
    return config;
  },
}));

const mockExecutePulseInSandbox = vi.fn();
vi.mock("../../pulse/executePulseInSandbox", () => ({
  executePulseInSandbox: (...args: unknown[]) =>
    mockExecutePulseInSandbox(...args),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

// Import after mocks
await import("../sendPulseTask");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendPulseTask", () => {
  const basePayload = { accountId: "acc_123", prompt: "Send pulse" };

  it("executes pulse and returns result", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockRunsPoll.mockResolvedValueOnce({
      output: { stdout: "No room created" },
    });

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sandboxId: "sbx-1", runId: "child-run-1" });
    expect(mockExecutePulseInSandbox).toHaveBeenCalledOnce();
  });

  it("throws when executePulseInSandbox returns undefined", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce(undefined);

    await expect(mockRun(basePayload)).rejects.toThrow(
      "Failed to execute pulse in sandbox",
    );
  });

  it("adds room tag when PULSE_ROOM_ID is found in child run stdout", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockRunsPoll.mockResolvedValueOnce({
      output: { stdout: "Agent output...\nPULSE_ROOM_ID:room-abc-123\nDone" },
    });

    await mockRun(basePayload);

    expect(mockRunsPoll).toHaveBeenCalledWith("child-run-1", { pollIntervalMs: 10000 });
    expect(mockTagsAdd).toHaveBeenCalledWith("room:room-abc-123");
  });

  it("does not add room tag when no PULSE_ROOM_ID in stdout", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockRunsPoll.mockResolvedValueOnce({
      output: { stdout: "Agent output without room ID" },
    });

    await mockRun(basePayload);

    expect(mockTagsAdd).not.toHaveBeenCalled();
  });

  it("does not poll when runId is undefined", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: undefined,
    });

    await mockRun(basePayload);

    expect(mockRunsPoll).not.toHaveBeenCalled();
    expect(mockTagsAdd).not.toHaveBeenCalled();
  });
});
