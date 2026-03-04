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
const mockSandboxSnapshot = vi.fn().mockResolvedValue({ snapshotId: "snap_123" });

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

vi.mock("../../sandboxes/cloneMonorepoViaAgent", () => ({
  cloneMonorepoViaAgent: vi.fn(),
}));

vi.mock("../../sandboxes/runOpenClawAgent", () => ({
  runOpenClawAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "done", stderr: "" }),
}));

vi.mock("../../sandboxes/pushAndCreatePRsViaAgent", () => ({
  pushAndCreatePRsViaAgent: vi.fn().mockResolvedValue([
    {
      repo: "recoupable/recoup-api", number: 42,
      url: "https://github.com/recoupable/recoup-api/pull/42", baseBranch: "test",
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
  mockSandboxCreate.mockResolvedValue({
    sandboxId: "sbx-123",
    stop: mockSandboxStop,
    snapshot: mockSandboxSnapshot,
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
    const { runOpenClawAgent } = await import("../../sandboxes/runOpenClawAgent");
    const { pushAndCreatePRsViaAgent } = await import("../../sandboxes/pushAndCreatePRsViaAgent");

    await mockRun(basePayload);

    expect(mockSandboxCreate).toHaveBeenCalledOnce();
    expect(cloneMonorepoViaAgent).toHaveBeenCalledOnce();
    expect(runOpenClawAgent).toHaveBeenCalledOnce();
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
});
