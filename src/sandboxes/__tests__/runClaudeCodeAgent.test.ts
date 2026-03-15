import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../logStep", () => ({
  logStep: vi.fn(),
}));

const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
const { logStep } = await import("../logStep");

const originalEnv = { ...process.env };

function mockDetachedCommand(finished: {
  exitCode: number;
  stdout: () => Promise<string>;
  stderr: () => Promise<string>;
}) {
  return { wait: vi.fn().mockResolvedValue(finished) };
}

function createMockSandbox() {
  return { runCommand: vi.fn() } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-oauth-token";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("runClaudeCodeAgent", () => {
  it("calls claude --print with the message and injects CLAUDE_CODE_OAUTH_TOKEN", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "done\n",
        stderr: async () => "",
      }),
    );

    await runClaudeCodeAgent(sandbox, {
      label: "Coding agent",
      message: "Fix the bug",
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "claude",
      args: ["-p", "--dangerously-skip-permissions", "Fix the bug"],
      cwd: "/vercel/sandbox/mono",
      detached: true,
      env: { CLAUDE_CODE_OAUTH_TOKEN: "test-oauth-token" },
    });
  });

  it("merges CLAUDE_CODE_OAUTH_TOKEN into provided env", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "",
        stderr: async () => "",
      }),
    );

    await runClaudeCodeAgent(sandbox, {
      label: "Apply feedback",
      message: "Update the README",
      env: { GITHUB_TOKEN: "ghp_test" },
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "claude",
      args: ["-p", "--dangerously-skip-permissions", "Update the README"],
      cwd: "/vercel/sandbox/mono",
      detached: true,
      env: {
        GITHUB_TOKEN: "ghp_test",
        CLAUDE_CODE_OAUTH_TOKEN: "test-oauth-token",
      },
    });
  });

  it("uses detached mode and waits for completion", async () => {
    const sandbox = createMockSandbox();
    const waitMock = vi.fn().mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "done\n",
      stderr: async () => "",
    });
    sandbox.runCommand.mockResolvedValueOnce({ wait: waitMock });

    await runClaudeCodeAgent(sandbox, { label: "Test", message: "Do something" });

    expect(sandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({ detached: true }),
    );
    expect(waitMock).toHaveBeenCalled();
  });

  it("returns stdout, stderr, and exitCode", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "PR_CREATED: https://github.com/org/repo/pull/1\n",
        stderr: async () => "warning\n",
      }),
    );

    const result = await runClaudeCodeAgent(sandbox, {
      label: "Create PRs",
      message: "Push changes",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("PR_CREATED: https://github.com/org/repo/pull/1\n");
    expect(result.stderr).toBe("warning\n");
  });

  it("logs completion via logStep", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "output\n",
        stderr: async () => "",
      }),
    );

    await runClaudeCodeAgent(sandbox, { label: "Clone repos", message: "Clone" });

    expect(logStep).toHaveBeenCalledWith("Clone repos completed", false, {
      exitCode: 0,
      stdout: "output\n",
      stderr: "",
    });
  });

  it("always sets cwd to /vercel/sandbox/mono", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "",
        stderr: async () => "",
      }),
    );

    await runClaudeCodeAgent(sandbox, {
      label: "Coding agent",
      message: "Fix the bug",
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/vercel/sandbox/mono" }),
    );
  });

  it("logs failure on non-zero exit code", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 1,
        stdout: async () => "",
        stderr: async () => "fatal error\n",
      }),
    );

    await runClaudeCodeAgent(sandbox, { label: "Clone repos", message: "Clone" });

    expect(logStep).toHaveBeenCalledWith("Clone repos failed", false, {
      stderr: "fatal error\n",
    });
  });
});
