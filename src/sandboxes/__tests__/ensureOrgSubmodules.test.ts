import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const mockGetAccountOrgs = vi.fn();
vi.mock("../../recoup/getAccountOrgs", () => ({
  getAccountOrgs: (...args: unknown[]) => mockGetAccountOrgs(...args),
}));

const mockCreateOrgGithubRepo = vi.fn();
vi.mock("../../github/createOrgGithubRepo", () => ({
  createOrgGithubRepo: (...args: unknown[]) =>
    mockCreateOrgGithubRepo(...args),
}));

const mockRunGitCommand = vi.fn().mockResolvedValue(true);
vi.mock("../runGitCommand", () => ({
  runGitCommand: (...args: unknown[]) => mockRunGitCommand(...args),
}));

const { ensureOrgSubmodules } = await import("../ensureOrgSubmodules");

function createMockSandbox(overrides: Record<string, unknown> = {}) {
  const runCommand = vi.fn().mockResolvedValue({
    exitCode: 1,
    stdout: async () => "",
    stderr: async () => "",
  });

  const writeFiles = vi.fn().mockResolvedValue(undefined);

  return { runCommand, writeFiles, ...overrides } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("ensureOrgSubmodules", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await ensureOrgSubmodules(sandbox, "account-1");

    expect(mockGetAccountOrgs).not.toHaveBeenCalled();
  });

  it("skips when no orgs returned", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([]);
    const sandbox = createMockSandbox();

    await ensureOrgSubmodules(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();
  });

  it("skips when getAccountOrgs returns undefined", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce(undefined);
    const sandbox = createMockSandbox();

    await ensureOrgSubmodules(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();
  });

  it("adds new org as submodule when remote has refs", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/Recoupable-Com/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      // .gitmodules cat returns empty (no existing submodules)
      if (opts.cmd === "cat") {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      // git ls-remote returns a ref (non-empty repo)
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "ls-remote" &&
        opts.args?.[1] === "--heads"
      ) {
        return {
          exitCode: 0,
          stdout: async () => "abc123\trefs/heads/main\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledWith("Test Org", "org-1");

    // Should have called git submodule add
    const submoduleAddCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleAddCall).toBeDefined();

    // Should NOT have seeded (ls-remote returned refs)
    const initCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[1] === "init" &&
        call[0]?.args?.[0] === "-C"
    );
    expect(initCall).toBeUndefined();
  });

  it("seeds empty repo before adding as submodule", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/Recoupable-Com/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      // .gitmodules cat returns empty
      if (opts.cmd === "cat") {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      // git ls-remote returns empty (no refs)
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "ls-remote" &&
        opts.args?.[1] === "--heads"
      ) {
        return {
          exitCode: 0,
          stdout: async () => "",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    // Should have created a seed dir and pushed an empty commit
    const seedInitCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "-C" &&
        call[0]?.args?.[1]?.startsWith("/tmp/seed-") &&
        call[0]?.args?.[2] === "init"
    );
    expect(seedInitCall).toBeDefined();

    // Should have committed with --allow-empty
    const seedCommitCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "-C" &&
        call[0]?.args?.[1]?.startsWith("/tmp/seed-") &&
        call[0]?.args?.[2] === "commit" &&
        call[0]?.args?.[3] === "--allow-empty"
    );
    expect(seedCommitCall).toBeDefined();

    // Should have pushed the seed commit
    const seedPushCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "-C" &&
        call[0]?.args?.[1]?.startsWith("/tmp/seed-") &&
        call[0]?.args?.[2] === "push"
    );
    expect(seedPushCall).toBeDefined();

    // Should still have called git submodule add after seeding
    const submoduleAddCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleAddCall).toBeDefined();
  });

  it("skips existing submodule and runs update --init instead", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    const sandbox = createMockSandbox();
    // .gitmodules cat returns content with existing submodule
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "cat" && opts.args?.[0] === ".gitmodules") {
        return {
          exitCode: 0,
          stdout: async () =>
            '[submodule "orgs/test-org"]\n\tpath = orgs/test-org\n\turl = https://github.com/Recoupable-Com/org-test-org-org-1',
          stderr: async () => "",
        };
      }
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "submodule" &&
        opts.args?.[1] === "update"
      ) {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    // Should NOT create a new repo
    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();

    // Should have called submodule update --init
    const updateCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "update" &&
        call[0]?.args?.[2] === "--init"
    );
    expect(updateCall).toBeDefined();
  });

  // Regression: empty org repos caused "fatal: You are on a branch yet to be
  // born" and "fatal: unable to checkout submodule 'orgs/myco-wtf'"
  it("does not call git submodule add on an empty remote without seeding first", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Myco WTF" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-myco-wtf-org-1"
    );

    const commandLog: string[] = [];
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      const tag = `${opts.cmd} ${(opts.args || []).join(" ")}`;
      commandLog.push(tag);

      // .gitmodules does not exist
      if (opts.cmd === "cat" && opts.args?.[0] === ".gitmodules") {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      // Remote has no refs — this is the empty repo scenario
      if (opts.cmd === "git" && opts.args?.[0] === "ls-remote") {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    // The seed (git init in /tmp, commit --allow-empty, push) MUST happen
    // BEFORE git submodule add. Find indices of each in the command log.
    const seedPushIdx = commandLog.findIndex(
      (c) => c.includes("-C") && c.includes("/tmp/seed-") && c.includes("push")
    );
    const submoduleAddIdx = commandLog.findIndex(
      (c) => c.includes("submodule add")
    );

    expect(seedPushIdx).toBeGreaterThan(-1);
    expect(submoduleAddIdx).toBeGreaterThan(-1);
    expect(seedPushIdx).toBeLessThan(submoduleAddIdx);
  });

  // Regression: sandbox.writeFiles({key: value}) threw
  // "params.files is not iterable" — writeFiles expects an array, not object
  it("does not call sandbox.writeFiles during empty repo seeding", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "cat") {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      if (opts.cmd === "git" && opts.args?.[0] === "ls-remote") {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    // writeFiles must NOT be called — we use git commit --allow-empty instead
    expect(sandbox.writeFiles).not.toHaveBeenCalled();
  });

  it("continues with other orgs when one fails", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Failing Org" },
      { organizationId: "org-2", organizationName: "Working Org" },
    ]);

    // First org fails, second succeeds
    mockCreateOrgGithubRepo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        "https://github.com/Recoupable-Com/org-working-org-org-2"
      );

    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue({
      exitCode: 1,
      stdout: async () => "",
      stderr: async () => "",
    });

    await ensureOrgSubmodules(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledTimes(2);
  });
});
