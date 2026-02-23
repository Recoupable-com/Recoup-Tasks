import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const { registerOrgSubmodules } = await import("../registerOrgSubmodules");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("registerOrgSubmodules", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await registerOrgSubmodules(sandbox);

    expect(sandbox.runCommand).not.toHaveBeenCalled();
  });

  it("skips when no org repos found in workspace", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should not call openclaw
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeUndefined();
  });

  /**
   * Core test: registerOrgSubmodules delegates to OpenClaw to handle
   * submodule registration, avoiding brittle manual git plumbing.
   */
  it("delegates submodule registration to OpenClaw agent", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\nmyco-wtf\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should call openclaw agent with a message about registering submodules
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "openclaw" &&
        call[0]?.args?.[0] === "agent" &&
        call[0]?.args?.[1] === "--agent" &&
        call[0]?.args?.[2] === "main" &&
        call[0]?.args?.[3] === "--message"
    );
    expect(openclawCall).toBeDefined();

    // Message should contain org names
    const message = openclawCall![0].args[4];
    expect(message).toContain("recoup");
    expect(message).toContain("myco-wtf");
  });

  it("includes submodule path pattern in OpenClaw message", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const message = openclawCall![0].args[4];

    // Message should instruct OpenClaw about submodule paths
    expect(message).toContain(".openclaw/workspace/orgs/");
    // Message should mention stripping auth tokens from .gitmodules
    expect(message).toContain(".gitmodules");
    // Message should mention GITHUB_TOKEN for auth
    expect(message).toContain("GITHUB_TOKEN");
  });

  it("instructs OpenClaw to strip auth tokens from .gitmodules", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const message = openclawCall![0].args[4];

    // Message should instruct token stripping
    expect(message).toContain("x-access-token");
    expect(message).toContain("strip");
  });

  it("logs error when OpenClaw fails", async () => {
    const { logger } = await import("@trigger.dev/sdk/v3");
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
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

    await registerOrgSubmodules(sandbox);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      expect.objectContaining({ stderr: expect.any(String) })
    );
  });

  it("does not run manual git submodule commands", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should NOT run git submodule add directly
    const submoduleAddCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleAddCall).toBeUndefined();

    // Should NOT run git update-index directly
    const updateIndexCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "update-index"
    );
    expect(updateIndexCall).toBeUndefined();
  });

  it("instructs OpenClaw to commit and push org repos before registering submodules", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const message = openclawCall![0].args[4];

    // Message should instruct pushing org repos
    expect(message).toContain("commit");
    expect(message).toContain("push");
    expect(message).toContain("origin");
  });

  /**
   * Regression: if a previous run committed changes locally but failed
   * to push (e.g. .gitmodules error), the next run sees a clean working
   * tree (no staged changes) and skips the push. The unpushed commits
   * sit locally forever. Fix: also check for unpushed commits.
   */
  it("instructs OpenClaw to push unpushed commits, not just uncommitted changes", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const message = openclawCall![0].args[4];

    // Message must instruct to always push, even if no new changes to commit
    expect(message).toContain("unpushed");
    expect(message).toContain("git log");
  });

  /**
   * Regression: copyOpenClawToRepo strips .git dirs from org copies,
   * then git add -A stages them as 040000 plain trees. If the message
   * only says "clean up submodule state", OpenClaw sees no submodules
   * and skips cleanup. The 040000 entries persist, preventing
   * git submodule add from creating 160000 entries.
   *
   * Fix: message must instruct explicitly removing entries from the
   * git index (git rm --cached) for the org path, not just "clean up
   * submodule state".
   */
  it("instructs OpenClaw to remove org paths from git index before submodule add", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const message = openclawCall![0].args[4];

    // Must explicitly instruct removing from git index with --cached
    // (not just "clean up submodule state" which OpenClaw ignores for plain trees)
    expect(message).toContain("git rm");
    expect(message).toContain("--cached");
  });

  it("uses resolved home dir for workspace path (no tilde)", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/home/sandbox\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // The find command should use resolved path, not ~
    const findCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" && call[0]?.args?.[1]?.includes("find")
    );
    expect(findCall![0].args[1]).toContain("/home/sandbox/");
    expect(findCall![0].args[1]).not.toContain("~");
  });
});
