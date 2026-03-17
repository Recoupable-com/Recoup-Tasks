import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
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

const mockTagPulseEmailId = vi.fn();
vi.mock("../../pulse/tagPulseEmailId", () => ({
  tagPulseEmailId: (...args: unknown[]) =>
    mockTagPulseEmailId(...args),
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
    mockTagPulseEmailId.mockResolvedValueOnce(undefined);

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

  it("calls tagPulseEmailId with sandboxId and accountId", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockTagPulseEmailId.mockResolvedValueOnce(undefined);

    await mockRun(basePayload);

    expect(mockTagPulseEmailId).toHaveBeenCalledWith("sbx-1", "acc_123");
  });
});
