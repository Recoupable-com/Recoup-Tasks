import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../logStep", () => ({
  logStep: vi.fn(),
}));

const { runOpenClawAgent } = await import("../runOpenClawAgent");
const { logStep } = await import("../logStep");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

function mockDetachedCommand(finished: {
  exitCode: number;
  stdout: () => Promise<string>;
  stderr: () => Promise<string>;
}) {
  return {
    wait: vi.fn().mockResolvedValue(finished),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runOpenClawAgent", () => {
  it("calls openclaw agent with correct args in detached mode", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "done\n",
        stderr: async () => "",
      }),
    );

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "Clone these repos"],
      detached: true,
    });
  });

  it("passes env vars when provided", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "",
        stderr: async () => "",
      }),
    );

    await runOpenClawAgent(sandbox, {
      label: "Setup sandbox",
      message: "Run setup",
      env: { RECOUP_API_KEY: "key123" },
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "Run setup"],
      detached: true,
      env: { RECOUP_API_KEY: "key123" },
    });
  });

  it("logs command start with cmd and args via logStep", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "output here\n",
        stderr: async () => "warning\n",
      }),
    );

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(logStep).toHaveBeenCalledWith("Clone org repos", true, {
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "Clone these repos"],
    });
  });

  it("logs completion with exitCode, stdout, stderr via logStep", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "output here\n",
        stderr: async () => "warning\n",
      }),
    );

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(logStep).toHaveBeenCalledWith("Clone org repos completed", false, {
      exitCode: 0,
      stdout: "output here\n",
      stderr: "warning\n",
    });
  });

  it("logs error on non-zero exit code via logStep", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 1,
        stdout: async () => "",
        stderr: async () => "fatal error\n",
      }),
    );

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(logStep).toHaveBeenCalledWith("Clone org repos failed", false, {
      stderr: "fatal error\n",
    });
  });

  it("returns stdout and stderr", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(
      mockDetachedCommand({
        exitCode: 0,
        stdout: async () => "output\n",
        stderr: async () => "warn\n",
      }),
    );

    const result = await runOpenClawAgent(sandbox, {
      label: "Test",
      message: "Do something",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("output\n");
    expect(result.stderr).toBe("warn\n");
  });

  it("uses detached mode to avoid HTTP streaming timeout", async () => {
    const sandbox = createMockSandbox();
    const waitMock = vi.fn().mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "done\n",
      stderr: async () => "",
    });
    sandbox.runCommand.mockResolvedValueOnce({
      wait: waitMock,
    });

    await runOpenClawAgent(sandbox, {
      label: "Coding agent",
      message: "Make changes",
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        detached: true,
      }),
    );
    expect(waitMock).toHaveBeenCalled();
  });

});
