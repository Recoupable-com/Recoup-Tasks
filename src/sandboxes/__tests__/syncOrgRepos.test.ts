import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const mockGetSandboxHomeDir = vi.fn();
vi.mock("../getSandboxHomeDir", () => ({
  getSandboxHomeDir: (...args: unknown[]) => mockGetSandboxHomeDir(...args),
}));

const { syncOrgRepos } = await import("../git/syncOrgRepos");

function createMockSandbox(orgNames: string[] = []) {
  const runCommand = vi.fn().mockImplementation(async (opts: any) => {
    // find command — return org names
    if (opts.cmd === "sh") {
      return {
        exitCode: 0,
        stdout: async () => orgNames.join("\n"),
        stderr: async () => "",
      };
    }
    // git fetch / reset
    return {
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    };
  });

  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
  mockGetSandboxHomeDir.mockResolvedValue("/home/user");
});

describe("syncOrgRepos", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox(["org-one"]);

    await syncOrgRepos(sandbox);

    expect(sandbox.runCommand).not.toHaveBeenCalled();
  });

  it("skips when no org repos found", async () => {
    const sandbox = createMockSandbox([]);

    await syncOrgRepos(sandbox);

    // Only the find command should have been called
    expect(sandbox.runCommand).toHaveBeenCalledTimes(1);
  });

  it("fetches and resets each org repo to origin/main", async () => {
    const sandbox = createMockSandbox(["org-one", "org-two"]);

    await syncOrgRepos(sandbox);

    const gitCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => call[0]?.cmd === "git"
    );

    // 2 repos × 2 commands (fetch + reset) = 4 git calls
    expect(gitCalls).toHaveLength(4);

    // org-one fetch
    expect(gitCalls[0][0].args).toEqual([
      "-C",
      "/home/user/.openclaw/workspace/orgs/org-one",
      "fetch",
      "origin",
      "main",
    ]);

    // org-one reset
    expect(gitCalls[1][0].args).toEqual([
      "-C",
      "/home/user/.openclaw/workspace/orgs/org-one",
      "reset",
      "--hard",
      "origin/main",
    ]);

    // org-two fetch
    expect(gitCalls[2][0].args).toEqual([
      "-C",
      "/home/user/.openclaw/workspace/orgs/org-two",
      "fetch",
      "origin",
      "main",
    ]);

    // org-two reset
    expect(gitCalls[3][0].args).toEqual([
      "-C",
      "/home/user/.openclaw/workspace/orgs/org-two",
      "reset",
      "--hard",
      "origin/main",
    ]);
  });

  it("continues syncing remaining repos when one fetch fails", async () => {
    const sandbox = createMockSandbox(["failing-org", "working-org"]);

    let fetchCount = 0;
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh") {
        return {
          exitCode: 0,
          stdout: async () => "failing-org\nworking-org",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("fetch")) {
        fetchCount++;
        if (fetchCount === 1) {
          return {
            exitCode: 1,
            stdout: async () => "",
            stderr: async () => "fatal: could not read from remote",
          };
        }
      }
      return {
        exitCode: 0,
        stdout: async () => "",
        stderr: async () => "",
      };
    });

    await syncOrgRepos(sandbox);

    const gitCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => call[0]?.cmd === "git"
    );

    // failing-org: fetch only (no reset due to failure)
    // working-org: fetch + reset
    expect(gitCalls).toHaveLength(3);
  });

  it("skips reset when fetch fails for a repo", async () => {
    const sandbox = createMockSandbox(["bad-org"]);

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh") {
        return {
          exitCode: 0,
          stdout: async () => "bad-org",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("fetch")) {
        return {
          exitCode: 128,
          stdout: async () => "",
          stderr: async () => "fatal: remote error",
        };
      }
      return {
        exitCode: 0,
        stdout: async () => "",
        stderr: async () => "",
      };
    });

    await syncOrgRepos(sandbox);

    const resetCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.includes("reset")
    );
    expect(resetCalls).toHaveLength(0);
  });
});
