import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { pushOrgRepos } = await import("../pushOrgRepos");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushOrgRepos", () => {
  it("skips when no org dirs found in workspace", async () => {
    const sandbox = createMockSandbox();
    // echo ~ returns home dir
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "/root\n",
      stderr: async () => "",
    });
    // find returns empty
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    await pushOrgRepos(sandbox);

    // Only the home resolve + find commands should have been called
    expect(sandbox.runCommand).toHaveBeenCalledTimes(2);
  });

  // Regression: pushOrgSubmodules used .gitmodules which doesn't exist
  // in the new approach. pushOrgRepos should scan ~/.openclaw/workspace/orgs/
  it("scans ~/.openclaw/workspace/orgs/ for git repos, not .gitmodules", async () => {
    const sandbox = createMockSandbox();

    const commandLog: string[] = [];
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      const tag = `${opts.cmd} ${(opts.args || []).join(" ")}`;
      commandLog.push(tag);

      // echo ~ returns home dir
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      // find returns one org dir with .git
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "my-org\n",
          stderr: async () => "",
        };
      }
      // diff --cached --quiet returns 1 (has changes)
      if (
        opts.cmd === "git" &&
        opts.args?.includes("diff") &&
        opts.args?.includes("--cached")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // Should NOT reference .gitmodules
    const gitmodulesCall = commandLog.find((c) => c.includes(".gitmodules"));
    expect(gitmodulesCall).toBeUndefined();

    // Should scan workspace for git repos
    const findCall = commandLog.find(
      (c) => c.includes("find") && c.includes(".openclaw/workspace/orgs")
    );
    expect(findCall).toBeDefined();
  });

  it("pushes changes for org repo with changes", async () => {
    const sandbox = createMockSandbox();

    // find returns one org
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      // echo ~ returns home dir
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
          stdout: async () => "my-org\n",
          stderr: async () => "",
        };
      }
      // diff --cached --quiet returns 1 (has changes)
      if (
        opts.cmd === "git" &&
        opts.args?.includes("diff") &&
        opts.args?.includes("--cached")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // Should have called git push for the org
    const pushCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.includes("push")
    );
    expect(pushCall).toBeDefined();
  });

  /**
   * Regression test for production error:
   * "fatal: cannot change to '~/.openclaw/workspace/orgs/recoup': No such file or directory"
   *
   * The ~ tilde is NOT expanded when passed as an argument to git -C via
   * sandbox.runCommand(). It only expands in shell context (sh -c).
   * All git -C paths must use the resolved home directory, not ~.
   */
  it("uses resolved home directory for git -C, not literal tilde", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      // Resolve home dir
      if (
        opts.cmd === "sh" &&
        opts.args?.[1] === "echo ~"
      ) {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      // find returns one org
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      // diff --cached --quiet returns 1 (has changes)
      if (
        opts.cmd === "git" &&
        opts.args?.includes("diff") &&
        opts.args?.includes("--cached")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // Every git -C call should use /root/... not ~/.../
    const gitCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => call[0]?.cmd === "git" && call[0]?.args?.includes("-C")
    );

    expect(gitCalls.length).toBeGreaterThan(0);

    for (const call of gitCalls) {
      const cIndex = call[0].args.indexOf("-C");
      const path = call[0].args[cIndex + 1];
      expect(path).not.toContain("~");
      expect(path).toMatch(/^\/root\//);
    }
  });

  it("skips push when no changes in org repo", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      // echo ~ returns home dir
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
          stdout: async () => "my-org\n",
          stderr: async () => "",
        };
      }
      // diff --cached --quiet returns 0 (no changes)
      if (
        opts.cmd === "git" &&
        opts.args?.includes("diff") &&
        opts.args?.includes("--cached")
      ) {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await pushOrgRepos(sandbox);

    // Should NOT have called git push
    const pushCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.includes("push")
    );
    expect(pushCall).toBeUndefined();
  });
});
