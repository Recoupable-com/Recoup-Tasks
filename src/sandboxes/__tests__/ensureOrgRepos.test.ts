import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
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

const { ensureOrgRepos } = await import("../ensureOrgRepos");

function createMockSandbox() {
  const runCommand = vi.fn().mockImplementation((opts: any) => {
    const finished = {
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    };
    if (opts?.cmd === "openclaw") {
      return Promise.resolve({ wait: vi.fn().mockResolvedValue(finished) });
    }
    return Promise.resolve(finished);
  });

  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("ensureOrgRepos", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockGetAccountOrgs).not.toHaveBeenCalled();
  });

  it("skips when no orgs returned", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([]);
    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();
  });

  it("skips when getAccountOrgs returns undefined", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce(undefined);
    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();
  });

  it("creates GitHub repos for each org", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Org One" },
      { organizationId: "org-2", organizationName: "Org Two" },
    ]);

    mockCreateOrgGithubRepo
      .mockResolvedValueOnce("https://github.com/recoupable/org-org-one-org-1")
      .mockResolvedValueOnce("https://github.com/recoupable/org-org-two-org-2");

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledWith("Org One", "org-1");
    expect(mockCreateOrgGithubRepo).toHaveBeenCalledWith("Org Two", "org-2");
  });

  it("runs an openclaw command to clone org repos into workspace", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    // Should have called openclaw agent with a message about cloning
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeDefined();

    // The openclaw args should include the repo URL
    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );
    expect(message).toContain("org-test-org-org-1");

    // GITHUB_TOKEN is injected into openclaw.json by setupOpenClaw,
    // not passed via env on this runCommand call.
    expect(openclawCall![0].env).toBeUndefined();
  });

  // Should NOT use git submodule add — that's the old approach
  it("does not use git submodule add", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    const submoduleCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule"
    );
    expect(submoduleCall).toBeUndefined();
  });

  it("continues creating repos when one fails", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Failing Org" },
      { organizationId: "org-2", organizationName: "Working Org" },
    ]);

    mockCreateOrgGithubRepo
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        "https://github.com/recoupable/org-working-org-org-2"
      );

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledTimes(2);

    // Openclaw should still be called with the one that succeeded
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeDefined();
  });

  /**
   * Regression: submodules use a .git FILE (gitlink), not a .git DIRECTORY.
   * If the clone prompt only checks for a .git directory, it treats
   * submodule dirs as "not a git repo", removes them, and clones fresh —
   * destroying the submodule registration every re-run.
   */
  it("instructs OpenClaw to detect .git files (gitlinks) for submodules", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );

    // Message must handle .git as a file (submodule gitlink), not just directory
    expect(message).toContain(".git file");
  });

  it("skips openclaw when all repo creations fail", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Failing Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(undefined);

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeUndefined();
  });
});
