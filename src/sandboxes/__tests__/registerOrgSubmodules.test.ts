import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
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
      // echo ~ returns home dir
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      // find returns empty
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

    // Should not call git submodule add
    const submoduleCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.[0] === "submodule"
    );
    expect(submoduleCall).toBeUndefined();
  });

  /**
   * Core test: after copyOpenClawToRepo copies org dirs as plain directories,
   * registerOrgSubmodules should convert them to submodule references.
   *
   * Production issue: .openclaw/workspace/orgs/{name} shows as 040000 tree
   * (plain directory) instead of 160000 commit (submodule) in the account repo.
   */
  it("converts org dirs to submodules via git submodule add", async () => {
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
      // git remote get-url origin
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        const path = opts.args[1]; // -C path
        if (path.includes("recoup")) {
          return {
            exitCode: 0,
            stdout: async () =>
              "https://x-access-token:tok@github.com/recoupable/org-recoup-abc123\n",
            stderr: async () => "",
          };
        }
        return {
          exitCode: 0,
          stdout: async () =>
            "https://x-access-token:tok@github.com/recoupable/org-myco-wtf-def456\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should call git submodule add for each org
    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(2);

    // URLs in submodule add should be PUBLIC (no token)
    for (const call of submoduleCalls) {
      const url = call[0].args[2];
      expect(url).not.toContain("x-access-token");
      expect(url).toMatch(/^https:\/\/github\.com\//);
    }

    // Paths should be .openclaw/workspace/orgs/{name}
    const paths = submoduleCalls.map((c: any[]) => c[0].args[3]);
    expect(paths).toContain(".openclaw/workspace/orgs/recoup");
    expect(paths).toContain(".openclaw/workspace/orgs/myco-wtf");
  });

  it("sets up git URL rewriting for auth (no tokens in .gitmodules)", async () => {
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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should set up URL rewriting in git config
    const configCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "config" &&
        call[0]?.args?.[1]?.includes("insteadOf")
    );
    expect(configCall).toBeDefined();
  });

  it("cleans up existing submodule state for idempotency", async () => {
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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should clean up submodule state before adding
    const deinitCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1]?.includes("submodule deinit") ||
          (call[0]?.cmd === "git" && args?.[0] === "submodule" && args?.[1] === "deinit");
      }
    );
    expect(deinitCall).toBeDefined();

    // Should remove plain dir from index before submodule add
    const rmCachedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1]?.includes("git rm -r --cached");
      }
    );
    expect(rmCachedCall).toBeDefined();
  });

  /**
   * Regression for production error:
   * "fatal: please make sure that the .gitmodules file is in the working tree"
   *
   * rm -f .gitmodules only removes from the working tree, not the git index.
   * git submodule add then fails because .gitmodules is tracked but missing.
   * Must use git rm to remove from BOTH index and working tree.
   */
  it("removes .gitmodules from git index, not just working tree", async () => {
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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should use "git rm" for .gitmodules, not bare "rm -f"
    const gitRmGitmodules = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1]?.includes("git rm") && args?.[1]?.includes(".gitmodules");
      }
    );
    expect(gitRmGitmodules).toBeDefined();

    // Should NOT use bare rm -f .gitmodules (only removes working tree, not index)
    const bareRmGitmodules = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1] === "rm -f .gitmodules 2>/dev/null || true";
      }
    );
    expect(bareRmGitmodules).toBeUndefined();
  });

  /**
   * Regression for production error (persists after git rm fix):
   * "fatal: please make sure that the .gitmodules file is in the working tree"
   *
   * git rm of a submodule gitlink (e.g. orgs/recoup) automatically updates
   * .gitmodules. If .gitmodules was already deleted, git rm re-stages it
   * in the index, causing the mismatch. Fix: remove stale orgs/ gitlinks
   * BEFORE removing .gitmodules so git rm can update it properly.
   */
  it("removes stale orgs/ gitlinks BEFORE removing .gitmodules", async () => {
    const sandbox = createMockSandbox();
    const callOrder: string[] = [];

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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }

      // Track cleanup call order
      const arg = opts.args?.[1] || "";
      if (typeof arg === "string") {
        if (arg.includes("git rm") && arg.includes("orgs ")) {
          callOrder.push("rm-orgs");
        }
        if (arg.includes("git rm") && arg.includes(".gitmodules")) {
          callOrder.push("rm-gitmodules");
        }
      }

      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Both calls should exist
    expect(callOrder).toContain("rm-orgs");
    expect(callOrder).toContain("rm-gitmodules");

    // rm-orgs MUST come before rm-gitmodules
    const orgsIdx = callOrder.indexOf("rm-orgs");
    const gitmodulesIdx = callOrder.indexOf("rm-gitmodules");
    expect(orgsIdx).toBeLessThan(gitmodulesIdx);
  });

  /**
   * Regression: stale orgs/ submodule entries from the old approach
   * exist at the repo root (160000 commit orgs/recoup, etc.) and a
   * stale .gitmodules with path = orgs/{name}.
   * registerOrgSubmodules must remove these before adding new ones
   * at .openclaw/workspace/orgs/{name}.
   */
  it("removes stale orgs/ submodules at repo root from old approach", async () => {
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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Should remove stale orgs/ at repo root from index
    const rmStaleCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        // Looking for: sh -c "git rm -r --cached orgs ..."
        return args?.[1]?.includes("git rm") && args?.[1]?.includes("orgs 2>");
      }
    );
    expect(rmStaleCall).toBeDefined();
  });

  it("uses resolved home dir for git -C paths (no tilde)", async () => {
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
      if (
        opts.cmd === "git" &&
        opts.args?.includes("remote") &&
        opts.args?.includes("get-url")
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://github.com/recoupable/org-recoup-abc123\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await registerOrgSubmodules(sandbox);

    // Every git -C call should use /home/sandbox, not ~
    const gitCCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => call[0]?.cmd === "git" && call[0]?.args?.includes("-C")
    );

    for (const call of gitCCalls) {
      const cIndex = call[0].args.indexOf("-C");
      const path = call[0].args[cIndex + 1];
      expect(path).not.toContain("~");
      expect(path).toMatch(/^\/home\/sandbox\//);
    }
  });
});
