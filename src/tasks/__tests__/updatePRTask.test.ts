import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
  tags: { add: vi.fn() },
  schemaTask: (config: { run: unknown }) => {
    mockRun.mockImplementation(config.run as (...args: unknown[]) => unknown);
    return config;
  },
}));

const mockSandboxCreate = vi.fn();
const mockSandboxStop = vi.fn();
const mockSandboxSnapshot = vi.fn().mockResolvedValue({ snapshotId: "snap_new" });

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockSandboxCreate(...args),
  },
}));

vi.mock("../../sandboxes/getVercelSandboxCredentials", () => ({
  getVercelSandboxCredentials: vi.fn().mockReturnValue({
    token: "tok", teamId: "team", projectId: "proj",
  }),
}));

vi.mock("../../sandboxes/installOpenClaw", () => ({
  installOpenClaw: vi.fn(),
}));

vi.mock("../../sandboxes/setupOpenClaw", () => ({
  setupOpenClaw: vi.fn(),
}));

vi.mock("../../sandboxes/runClaudeCodeAgent", () => ({
  runClaudeCodeAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "done", stderr: "" }),
}));

vi.mock("../../sandboxes/notifyCodingAgentCallback", () => ({
  notifyCodingAgentCallback: vi.fn(),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../../sandboxes/configureGitAuth", () => ({
  configureGitAuth: vi.fn(),
}));

vi.mock("../../sandboxes/getSandboxEnv", () => ({
  getSandboxEnv: vi.fn().mockReturnValue({
    RECOUP_API_KEY: "test-key",
    RECOUP_ACCOUNT_ID: "coding-agent",
    GITHUB_TOKEN: "test-gh-token",
  }),
}));

// Import after mocks
await import("../updatePRTask");

beforeEach(() => {
  vi.clearAllMocks();
  mockSandboxCreate.mockResolvedValue({
    sandboxId: "sbx-456",
    stop: mockSandboxStop,
    snapshot: mockSandboxSnapshot,
  });
});

describe("updatePRTask", () => {
  const basePayload = {
    feedback: "Make the button blue instead",
    snapshotId: "snap_old",
    branch: "agent/fix-bug-123",
    repo: "recoupable/api",
    callbackThreadId: "slack:C123:123.456",
  };

  it("resumes sandbox from snapshot", async () => {
    await mockRun(basePayload);

    expect(mockSandboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: "snapshot", snapshotId: "snap_old" },
      }),
    );
  });

  it("runs OpenClaw agent with feedback prompt", async () => {
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");

    await mockRun(basePayload);

    expect(runClaudeCodeAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: expect.stringContaining("Make the button blue instead"),
      }),
    );
  });

  it("delegates push to agent instead of using runGitCommand", async () => {
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");

    await mockRun(basePayload);

    // Should be called twice: once for feedback, once for push
    expect(runClaudeCodeAgent).toHaveBeenCalledTimes(2);
    expect(runClaudeCodeAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: "Push feedback changes",
        message: expect.stringContaining("git push"),
      }),
    );
  });

  it("notifies callback with updated status and new snapshot", async () => {
    const { notifyCodingAgentCallback } = await import("../../sandboxes/notifyCodingAgentCallback");

    await mockRun(basePayload);

    expect(notifyCodingAgentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "slack:C123:123.456",
        status: "updated",
        snapshotId: "snap_new",
        stdout: "done",
        stderr: "",
      }),
    );
  });

  it("stops sandbox in finally block", async () => {
    await mockRun(basePayload);
    expect(mockSandboxStop).toHaveBeenCalledOnce();
  });

  it("configures git auth before running agent", async () => {
    const { configureGitAuth } = await import("../../sandboxes/configureGitAuth");

    await mockRun(basePayload);

    expect(configureGitAuth).toHaveBeenCalledOnce();
  });

  it("creates sandbox with correct timeout param (not timeoutMs)", async () => {
    await mockRun(basePayload);

    expect(mockSandboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30 * 60 * 1000,
      }),
    );
    // Ensure the wrong param name is NOT used
    const callArgs = mockSandboxCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("timeoutMs");
  });

  it("passes sandbox env to both agent calls", async () => {
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");
    const { getSandboxEnv } = await import("../../sandboxes/getSandboxEnv");

    await mockRun(basePayload);

    expect(getSandboxEnv).toHaveBeenCalledWith("04e3aba9-c130-4fb8-8b92-34e95d43e66b");

    const expectedEnv = {
      RECOUP_API_KEY: "test-key",
      RECOUP_ACCOUNT_ID: "coding-agent",
      GITHUB_TOKEN: "test-gh-token",
    };

    // Both agent calls should receive env
    const calls = vi.mocked(runClaudeCodeAgent).mock.calls;
    expect(calls[0][1]).toEqual(expect.objectContaining({ env: expectedEnv }));
    expect(calls[1][1]).toEqual(expect.objectContaining({ env: expectedEnv }));
  });
});
