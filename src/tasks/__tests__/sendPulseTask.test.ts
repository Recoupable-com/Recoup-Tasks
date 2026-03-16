import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockTagsAdd = vi.fn();

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
  tags: { add: (...args: unknown[]) => mockTagsAdd(...args) },
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

const mockPollSandboxUntilStopped = vi.fn();
vi.mock("../../pulse/pollSandboxUntilStopped", () => ({
  pollSandboxUntilStopped: (...args: unknown[]) =>
    mockPollSandboxUntilStopped(...args),
}));

const mockFetchLatestAccountEmailId = vi.fn();
vi.mock("../../pulse/fetchLatestAccountEmailId", () => ({
  fetchLatestAccountEmailId: (...args: unknown[]) =>
    mockFetchLatestAccountEmailId(...args),
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
    mockPollSandboxUntilStopped.mockResolvedValueOnce(undefined);
    mockFetchLatestAccountEmailId.mockResolvedValueOnce(null);

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

  it("polls sandbox, fetches email, and adds email tag", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockPollSandboxUntilStopped.mockResolvedValueOnce(undefined);
    mockFetchLatestAccountEmailId.mockResolvedValueOnce("resend-email-xyz");

    await mockRun(basePayload);

    expect(mockPollSandboxUntilStopped).toHaveBeenCalledWith("sbx-1", expect.any(String));
    expect(mockFetchLatestAccountEmailId).toHaveBeenCalledWith("acc_123", expect.any(String));
    expect(mockTagsAdd).toHaveBeenCalledWith("email:resend-email-xyz");
  });

  it("does not add email tag when no email found", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockPollSandboxUntilStopped.mockResolvedValueOnce(undefined);
    mockFetchLatestAccountEmailId.mockResolvedValueOnce(null);

    await mockRun(basePayload);

    expect(mockTagsAdd).not.toHaveBeenCalled();
  });

  it("still succeeds if polling fails", async () => {
    mockExecutePulseInSandbox.mockResolvedValueOnce({
      sandboxId: "sbx-1",
      runId: "child-run-1",
    });
    mockPollSandboxUntilStopped.mockRejectedValueOnce(new Error("Timeout"));

    const result = await mockRun(basePayload);

    expect(result).toEqual({ sandboxId: "sbx-1", runId: "child-run-1" });
    expect(mockFetchLatestAccountEmailId).not.toHaveBeenCalled();
    expect(mockTagsAdd).not.toHaveBeenCalled();
  });
});
