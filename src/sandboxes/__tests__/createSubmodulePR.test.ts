import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("../runGitCommand", () => ({
  runGitCommand: vi.fn().mockResolvedValue(true),
}));

const { createSubmodulePR } = await import("../createSubmodulePR");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

function successResult(stdout = "") {
  return {
    exitCode: 0,
    stdout: async () => stdout,
    stderr: async () => "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSubmodulePR", () => {
  it("creates a PR targeting the correct base branch", async () => {
    const sandbox = createMockSandbox();
    // gh pr create output
    sandbox.runCommand.mockResolvedValueOnce(
      successResult("https://github.com/recoupable/recoup-api/pull/42"),
    );

    const result = await createSubmodulePR(sandbox, {
      submodule: "api",
      branch: "agent/fix-bug-123",
      prompt: "Fix the login bug",
      monorepoDir: "/root/monorepo",
    });

    expect(result).toEqual({
      repo: "recoupable/recoup-api",
      number: 42,
      url: "https://github.com/recoupable/recoup-api/pull/42",
      baseBranch: "test",
    });
  });

  it("uses test branch for api and chat submodules", async () => {
    const { runGitCommand } = await import("../runGitCommand");
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      successResult("https://github.com/recoupable/chat/pull/1"),
    );

    await createSubmodulePR(sandbox, {
      submodule: "chat",
      branch: "agent/fix-123",
      prompt: "Fix something",
      monorepoDir: "/root/monorepo",
    });

    // Verify checkout -b uses the branch name
    expect(runGitCommand).toHaveBeenCalledWith(
      sandbox,
      expect.arrayContaining(["checkout", "-b", "agent/fix-123"]),
      expect.any(String),
      expect.any(String),
    );
  });

  it("uses main branch for tasks submodule", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      successResult("https://github.com/recoupable/tasks/pull/5"),
    );

    const result = await createSubmodulePR(sandbox, {
      submodule: "tasks",
      branch: "agent/fix-123",
      prompt: "Fix something",
      monorepoDir: "/root/monorepo",
    });

    expect(result?.baseBranch).toBe("main");
  });

  it("returns null when gh pr create fails", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: async () => "",
      stderr: async () => "error creating PR",
    });

    const result = await createSubmodulePR(sandbox, {
      submodule: "api",
      branch: "agent/fix-123",
      prompt: "Fix bug",
      monorepoDir: "/root/monorepo",
    });

    expect(result).toBeNull();
  });
});
