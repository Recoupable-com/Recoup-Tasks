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
    // find returns empty
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    await pushOrgRepos(sandbox);

    // Only the find command should have been called
    expect(sandbox.runCommand).toHaveBeenCalledTimes(1);
  });

  // Regression: pushOrgSubmodules used .gitmodules which doesn't exist
  // in the new approach. pushOrgRepos should scan ~/.openclaw/workspace/orgs/
  it("scans ~/.openclaw/workspace/orgs/ for git repos, not .gitmodules", async () => {
    const sandbox = createMockSandbox();

    const commandLog: string[] = [];
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      const tag = `${opts.cmd} ${(opts.args || []).join(" ")}`;
      commandLog.push(tag);

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

  it("skips push when no changes in org repo", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
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
