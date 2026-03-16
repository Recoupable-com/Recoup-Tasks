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

const mockSandboxStop = vi.fn();
const mockSandboxSnapshot = vi.fn().mockResolvedValue({ snapshotId: "snap_123" });
const mockGetOrCreateSandbox = vi.fn();

vi.mock("../../sandboxes/getOrCreateSandbox", () => ({
  getOrCreateSandbox: (...args: unknown[]) => mockGetOrCreateSandbox(...args),
}));

vi.mock("../../sandboxes/configureGitAuth", () => ({
  configureGitAuth: vi.fn(),
}));

vi.mock("../../sandboxes/cloneMonorepoViaAgent", () => ({
  cloneMonorepoViaAgent: vi.fn(),
}));

vi.mock("../../sandboxes/git/syncMonorepoSubmodules", () => ({
  syncMonorepoSubmodules: vi.fn(),
}));

vi.mock("../../sandboxes/runClaudeCodeAgent", () => ({
  runClaudeCodeAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "done", stderr: "" }),
}));

vi.mock("../../sandboxes/pushAndCreatePRsViaAgent", () => ({
  pushAndCreatePRsViaAgent: vi.fn().mockResolvedValue([
    {
      repo: "recoupable/api", number: 42,
      url: "https://github.com/recoupable/api/pull/42", baseBranch: "test",
    },
  ]),
}));

vi.mock("../../sandboxes/notifyCodingAgentCallback", () => ({
  notifyCodingAgentCallback: vi.fn(),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

// Import after mocks
await import("../codingAgentTask");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreateSandbox.mockResolvedValue({
    sandboxId: "sbx-123",
    sandbox: {
      sandboxId: "sbx-123",
      stop: mockSandboxStop,
      snapshot: mockSandboxSnapshot,
    },
  });
});

describe("codingAgentTask", () => {
  const basePayload = {
    prompt: "Fix the login bug",
    callbackThreadId: "slack:C123:123.456",
  };

  it("creates a sandbox, clones via agent, runs agent, creates PRs via agent, and notifies", async () => {
    const { notifyCodingAgentCallback } = await import("../../sandboxes/notifyCodingAgentCallback");
    const { cloneMonorepoViaAgent } = await import("../../sandboxes/cloneMonorepoViaAgent");
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");
    const { pushAndCreatePRsViaAgent } = await import("../../sandboxes/pushAndCreatePRsViaAgent");

    await mockRun(basePayload);

    expect(mockGetOrCreateSandbox).toHaveBeenCalledOnce();
    expect(cloneMonorepoViaAgent).toHaveBeenCalledOnce();
    expect(runClaudeCodeAgent).toHaveBeenCalledOnce();
    expect(pushAndCreatePRsViaAgent).toHaveBeenCalledOnce();
    expect(notifyCodingAgentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "slack:C123:123.456",
        status: "pr_created",
      }),
    );
  });

  it("notifies no_changes when no PRs are created", async () => {
    const { pushAndCreatePRsViaAgent } = await import("../../sandboxes/pushAndCreatePRsViaAgent");
    const { notifyCodingAgentCallback } = await import("../../sandboxes/notifyCodingAgentCallback");
    vi.mocked(pushAndCreatePRsViaAgent).mockResolvedValueOnce([]);

    await mockRun(basePayload);

    expect(notifyCodingAgentCallback).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_changes" }),
    );
  });

  it("stops sandbox in finally block", async () => {
    await mockRun(basePayload);
    expect(mockSandboxStop).toHaveBeenCalledOnce();
  });

  it("passes prompt and branch to pushAndCreatePRsViaAgent", async () => {
    const { pushAndCreatePRsViaAgent } = await import("../../sandboxes/pushAndCreatePRsViaAgent");

    await mockRun(basePayload);

    expect(pushAndCreatePRsViaAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        prompt: "Fix the login bug",
        branch: expect.stringContaining("agent/"),
      }),
    );
  });

  it("configures git auth before running agent", async () => {
    const { configureGitAuth } = await import("../../sandboxes/configureGitAuth");

    await mockRun(basePayload);

    expect(configureGitAuth).toHaveBeenCalledOnce();
  });

  it("sends failed callback when an error occurs during execution", async () => {
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");
    const { notifyCodingAgentCallback } = await import("../../sandboxes/notifyCodingAgentCallback");
    vi.mocked(runClaudeCodeAgent).mockRejectedValueOnce(new Error("Sandbox crashed"));

    await mockRun(basePayload);

    expect(notifyCodingAgentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "slack:C123:123.456",
        status: "failed",
        message: "Sandbox crashed",
      }),
    );
    expect(mockSandboxStop).toHaveBeenCalledOnce();
  });

  it("sends failed callback when cloneMonorepoViaAgent throws", async () => {
    const { cloneMonorepoViaAgent } = await import("../../sandboxes/cloneMonorepoViaAgent");
    const { notifyCodingAgentCallback } = await import("../../sandboxes/notifyCodingAgentCallback");
    vi.mocked(cloneMonorepoViaAgent).mockRejectedValueOnce(new Error("Clone failed"));

    await mockRun(basePayload);

    expect(notifyCodingAgentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "slack:C123:123.456",
        status: "failed",
        message: "Clone failed",
      }),
    );
  });

  it("syncs monorepo submodules after cloning and before running agent", async () => {
    const { cloneMonorepoViaAgent } = await import("../../sandboxes/cloneMonorepoViaAgent");
    const { syncMonorepoSubmodules } = await import("../../sandboxes/git/syncMonorepoSubmodules");
    const { runClaudeCodeAgent } = await import("../../sandboxes/runClaudeCodeAgent");

    await mockRun(basePayload);

    expect(cloneMonorepoViaAgent).toHaveBeenCalledOnce();
    expect(syncMonorepoSubmodules).toHaveBeenCalledOnce();
    expect(runClaudeCodeAgent).toHaveBeenCalledOnce();

    // Verify ordering: clone → sync → agent
    const cloneOrder = vi.mocked(cloneMonorepoViaAgent).mock.invocationCallOrder[0];
    const syncOrder = vi.mocked(syncMonorepoSubmodules).mock.invocationCallOrder[0];
    const agentOrder = vi.mocked(runClaudeCodeAgent).mock.invocationCallOrder[0];
    expect(cloneOrder).toBeLessThan(syncOrder);
    expect(syncOrder).toBeLessThan(agentOrder);
  });

});
