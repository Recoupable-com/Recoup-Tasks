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

    // Should call git submodule add for each org with authed URL for cloning
    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(2);

    // URLs in submodule add should contain auth token for cloning
    for (const call of submoduleCalls) {
      const url = call[0].args[2];
      expect(url).toContain("x-access-token");
    }

    // Paths should be .openclaw/workspace/orgs/{name}
    const paths = submoduleCalls.map((c: any[]) => c[0].args[3]);
    expect(paths).toContain(".openclaw/workspace/orgs/recoup");
    expect(paths).toContain(".openclaw/workspace/orgs/myco-wtf");

    // Should strip tokens from .gitmodules after submodule add
    const sedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1]?.includes("sed") && args?.[1]?.includes(".gitmodules");
      }
    );
    expect(sedCall).toBeDefined();
  });

  it("adds auth token to public URLs for cloning", async () => {
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
        // Remote URL without auth token (public URL)
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

    // Even though remote had a public URL, submodule add should use authed URL
    const submoduleCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCall).toBeDefined();
    const url = submoduleCall![0].args[2];
    expect(url).toContain("x-access-token");
    expect(url).toContain("test-token");
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

    // Should use git update-index --force-remove (plumbing, no .gitmodules side effects)
    // instead of git rm (which auto-updates .gitmodules and causes index mismatches)
    const updateIndexCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          call[0]?.cmd === "git" &&
          args?.[0] === "update-index" &&
          args?.[1] === "--force-remove"
        );
      }
    );
    expect(updateIndexCall).toBeDefined();

    // Should NOT use git rm for cleanup (causes .gitmodules side effects)
    const gitRmCleanupCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          args?.[1]?.includes("git rm -rf orgs") ||
          args?.[1]?.includes("git rm -rf .openclaw") ||
          args?.[1]?.includes("git rm -f .gitmodules")
        );
      }
    );
    expect(gitRmCleanupCall).toBeUndefined();
  });

  /**
   * Regression for production error:
   * "fatal: please make sure that the .gitmodules file is in the working tree"
   *
   * git rm of submodule entries auto-updates .gitmodules, causing index/working
   * tree mismatches. Fix: use git update-index --force-remove (plumbing command)
   * which removes from the index with zero side effects.
   */
  it("removes .gitmodules from git index via update-index, not git rm", async () => {
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

    // Should use git update-index --force-remove for .gitmodules
    const updateIndexGitmodules = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          call[0]?.cmd === "git" &&
          args?.[0] === "update-index" &&
          args?.[1] === "--force-remove" &&
          args?.[2] === ".gitmodules"
        );
      }
    );
    expect(updateIndexGitmodules).toBeDefined();

    // Should NOT use git rm for .gitmodules (causes side effects)
    const gitRmGitmodules = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return args?.[1]?.includes("git rm") && args?.[1]?.includes(".gitmodules");
      }
    );
    expect(gitRmGitmodules).toBeUndefined();
  });

  /**
   * Regression for production error (persists after git rm fix):
   * "fatal: please make sure that the .gitmodules file is in the working tree"
   *
   * Root cause: git rm of submodule entries auto-updates .gitmodules,
   * causing index/working-tree mismatches regardless of ordering.
   * Fix: use git update-index --force-remove for ALL cleanup — a plumbing
   * command that has zero .gitmodules side effects, eliminating ordering issues.
   */
  it("uses update-index for .openclaw/workspace/orgs cleanup (no ordering issues)", async () => {
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

    // Should use git update-index pipeline to remove .openclaw/workspace/orgs/ entries
    const openclawUpdateIndex = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          args?.[1]?.includes("git ls-files") &&
          args?.[1]?.includes(".openclaw/workspace/orgs/") &&
          args?.[1]?.includes("update-index --force-remove")
        );
      }
    );
    expect(openclawUpdateIndex).toBeDefined();
  });

  /**
   * Regression: stale orgs/ submodule entries from the old approach
   * exist at the repo root (160000 commit orgs/recoup, etc.) and a
   * stale .gitmodules with path = orgs/{name}.
   * registerOrgSubmodules must remove these via update-index before
   * adding new ones at .openclaw/workspace/orgs/{name}.
   */
  it("removes stale orgs/ submodules at repo root via update-index", async () => {
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

    // Should remove stale orgs/ at repo root from index via update-index pipeline
    const rmStaleCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          args?.[1]?.includes("git ls-files") &&
          args?.[1]?.includes("orgs/") &&
          args?.[1]?.includes("update-index --force-remove")
        );
      }
    );
    expect(rmStaleCall).toBeDefined();
  });

  /**
   * Regression for production error on second run (idempotency):
   * "fatal: please make sure that the .gitmodules file is in the working tree"
   *
   * Root cause: git rm of submodule entries auto-updates .gitmodules.
   * No ordering of git rm calls can fix this reliably.
   * Fix: use git update-index --force-remove for ALL cleanup.
   * This is a plumbing command with zero .gitmodules interaction.
   */
  it("never uses git rm for cleanup (update-index only)", async () => {
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

    // Should NOT use git rm anywhere in cleanup
    const gitRmCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => {
        const args = call[0]?.args;
        return (
          args?.[1]?.includes("git rm") ||
          (call[0]?.cmd === "git" && args?.[0] === "rm")
        );
      }
    );
    expect(gitRmCalls).toHaveLength(0);
  });

  /**
   * Regression: git submodule add stages .gitmodules in the index.
   * sed only modifies the working tree. Without re-staging, the
   * committed .gitmodules still contains auth tokens.
   */
  it("re-stages .gitmodules after stripping tokens via sed", async () => {
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

    // Should re-stage .gitmodules after sed (git add .gitmodules)
    const addGitmodules = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "add" &&
        call[0]?.args?.[1] === ".gitmodules"
    );
    expect(addGitmodules).toBeDefined();
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
