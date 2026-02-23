import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const { runOpenClawAgent } = await import("../runOpenClawAgent");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runOpenClawAgent", () => {
  it("calls openclaw agent with correct args", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "done\n",
      stderr: async () => "",
    });

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "Clone these repos"],
    });
  });

  it("passes env vars when provided", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    await runOpenClawAgent(sandbox, {
      label: "Setup sandbox",
      message: "Run setup",
      env: { RECOUP_API_KEY: "key123" },
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "Run setup"],
      env: { RECOUP_API_KEY: "key123" },
    });
  });

  it("logs result with label, exitCode, stdout, stderr", async () => {
    const { logger } = await import("@trigger.dev/sdk/v3");
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "output here\n",
      stderr: async () => "warning\n",
    });

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(logger.log).toHaveBeenCalledWith("Clone org repos", {
      exitCode: 0,
      stdout: "output here\n",
      stderr: "warning\n",
    });
  });

  it("updates metadata with label", async () => {
    const { metadata } = await import("@trigger.dev/sdk/v3");
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(metadata.set).toHaveBeenCalledWith("currentStep", "Clone org repos");
    expect(metadata.append).toHaveBeenCalledWith("logs", "Clone org repos");
  });

  it("logs error on non-zero exit code", async () => {
    const { logger } = await import("@trigger.dev/sdk/v3");
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: async () => "",
      stderr: async () => "fatal error\n",
    });

    await runOpenClawAgent(sandbox, {
      label: "Clone org repos",
      message: "Clone these repos",
    });

    expect(logger.error).toHaveBeenCalledWith("Clone org repos failed", {
      stderr: "fatal error\n",
    });
  });

  it("returns stdout and stderr", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "output\n",
      stderr: async () => "warn\n",
    });

    const result = await runOpenClawAgent(sandbox, {
      label: "Test",
      message: "Do something",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("output\n");
    expect(result.stderr).toBe("warn\n");
  });
});
