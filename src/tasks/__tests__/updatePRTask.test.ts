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

vi.mock("../../sandboxes/runOpenClawAgent", () => ({
  runOpenClawAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "done", stderr: "" }),
}));

vi.mock("../../sandboxes/runGitCommand", () => ({
  runGitCommand: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../sandboxes/notifyCodingAgentCallback", () => ({
  notifyCodingAgentCallback: vi.fn(),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

// Import after mocks
await import("../updatePRTask");

beforeEach(() => {
  vi.clearAllMocks();
  mockSandboxCreate.mockResolvedValue({
    sandboxId: "sbx-456",
    stop: mockSandboxStop,
    snapshot: mockSandboxSnapshot,
    runCommand: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    }),
  });
});

describe("updatePRTask", () => {
  const basePayload = {
    feedback: "Make the button blue instead",
    snapshotId: "snap_old",
    branch: "agent/fix-bug-123",
    prs: [
      { repo: "recoupable/recoup-api", number: 42, url: "url", baseBranch: "test" },
    ],
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
    const { runOpenClawAgent } = await import("../../sandboxes/runOpenClawAgent");

    await mockRun(basePayload);

    expect(runOpenClawAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: expect.stringContaining("Make the button blue instead"),
      }),
    );
  });

  it("pushes changes to existing branch", async () => {
    const { runGitCommand } = await import("../../sandboxes/runGitCommand");

    await mockRun(basePayload);

    expect(runGitCommand).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(["push"]),
      expect.any(String),
      expect.any(String),
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
      }),
    );
  });

  it("stops sandbox in finally block", async () => {
    await mockRun(basePayload);
    expect(mockSandboxStop).toHaveBeenCalledOnce();
  });
});
