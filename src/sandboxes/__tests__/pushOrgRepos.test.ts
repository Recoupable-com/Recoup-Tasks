import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../getSandboxHomeDir", () => ({
  getSandboxHomeDir: vi.fn().mockResolvedValue("/root"),
}));

vi.mock("../logStep", () => ({
  logStep: vi.fn(),
}));

const { pushOrgRepos } = await import("../git/pushOrgRepos");
const { logStep } = await import("../logStep");

/**
 *
 */
function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("pushOrgRepos", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await pushOrgRepos(sandbox);

    expect(sandbox.runCommand).not.toHaveBeenCalled();
  });

  it("skips when no org repos found in workspace", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // Should not call openclaw
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw",
    );
    expect(openclawCall).toBeUndefined();
  });

  it("calls OpenClaw with a push-only message", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\nmyco-wtf\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "openclaw" &&
        call[0]?.args?.[0] === "agent" &&
        call[0]?.args?.[1] === "--agent" &&
        call[0]?.args?.[2] === "main" &&
        call[0]?.args?.[3] === "--message",
    );
    expect(openclawCall).toBeDefined();

    const message = openclawCall![0].args[4];
    // Should mention commit and push
    expect(message).toContain("commit");
    expect(message).toContain("push");
  });

  /**
   * The simplified prompt should NOT contain submodule registration
   * instructions — that responsibility moved to copyOpenClawToRepo.
   */
  it("message does NOT contain submodule registration instructions", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw",
    );
    const message = openclawCall![0].args[4];

    // Should NOT contain submodule-related instructions
    expect(message).not.toContain("git submodule add");
    expect(message).not.toContain(".gitmodules");
    expect(message).not.toContain("x-access-token");
    expect(message).not.toContain("GITHUB_TOKEN");
    expect(message).not.toContain("git rm");
    expect(message).not.toContain("--cached");
    expect(message).not.toContain("STEP 2");
  });

  it("uses resolved home dir for workspace path (no tilde)", async () => {
    const { getSandboxHomeDir } = await import("../getSandboxHomeDir");
    vi.mocked(getSandboxHomeDir).mockResolvedValueOnce("/home/sandbox");

    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // The find command should use resolved path, not ~
    const findCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "sh" && call[0]?.args?.[1]?.includes("find"),
    );
    expect(findCall![0].args[1]).toContain("/home/sandbox/");
    expect(findCall![0].args[1]).not.toContain("~");
  });

  it("logs error when OpenClaw fails", async () => {
    const { logger } = await import("@trigger.dev/sdk/v3");
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      // OpenClaw fails
      if (opts.cmd === "openclaw") {
        return {
          exitCode: 1,
          stdout: async () => "",
          stderr: async () => "OpenClaw error\n",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    expect(logStep).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      false,
      expect.objectContaining({ stderr: expect.any(String) }),
    );
  });
});
