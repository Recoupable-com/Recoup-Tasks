import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../runOpenClawAgent", () => ({
  runOpenClawAgent: vi.fn(),
}));

const { pushAndCreatePRsViaAgent } = await import("../pushAndCreatePRsViaAgent");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushAndCreatePRsViaAgent", () => {
  it("parses PR_CREATED lines from agent stdout", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    vi.mocked(runOpenClawAgent).mockResolvedValueOnce({
      exitCode: 0,
      stdout: [
        "Creating branch...",
        "PR_CREATED: https://github.com/recoupable/recoup-api/pull/42",
        "Creating another PR...",
        "PR_CREATED: https://github.com/recoupable/tasks/pull/10",
        "",
      ].join("\n"),
      stderr: "",
    });

    const sandbox = {} as any;
    const result = await pushAndCreatePRsViaAgent(sandbox, {
      prompt: "Fix the login bug",
      branch: "agent/fix-the-login-bug-123",
    });

    expect(result).toEqual([
      {
        repo: "recoupable/recoup-api",
        number: 42,
        url: "https://github.com/recoupable/recoup-api/pull/42",
        baseBranch: "test",
      },
      {
        repo: "recoupable/tasks",
        number: 10,
        url: "https://github.com/recoupable/tasks/pull/10",
        baseBranch: "main",
      },
    ]);
  });

  it("returns empty array when no PRs are created", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    vi.mocked(runOpenClawAgent).mockResolvedValueOnce({
      exitCode: 0,
      stdout: "No changes detected in any submodule.\n",
      stderr: "",
    });

    const sandbox = {} as any;
    const result = await pushAndCreatePRsViaAgent(sandbox, {
      prompt: "Fix bug",
      branch: "agent/fix-bug-123",
    });

    expect(result).toEqual([]);
  });

  it("includes branch and prompt in the agent message", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    vi.mocked(runOpenClawAgent).mockResolvedValueOnce({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    const sandbox = {} as any;
    await pushAndCreatePRsViaAgent(sandbox, {
      prompt: "Add dark mode support",
      branch: "agent/add-dark-mode-123",
    });

    const message = vi.mocked(runOpenClawAgent).mock.calls[0][1].message;
    expect(message).toContain("agent/add-dark-mode-123");
    expect(message).toContain("Add dark mode support");
  });

  it("includes submodule config in the agent message", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    vi.mocked(runOpenClawAgent).mockResolvedValueOnce({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    const sandbox = {} as any;
    await pushAndCreatePRsViaAgent(sandbox, {
      prompt: "Fix bug",
      branch: "agent/fix-123",
    });

    const message = vi.mocked(runOpenClawAgent).mock.calls[0][1].message;
    expect(message).toContain("recoupable/recoup-api");
    expect(message).toContain("base branch=test");
    expect(message).toContain("recoupable/tasks");
    expect(message).toContain("base branch=main");
  });
});
