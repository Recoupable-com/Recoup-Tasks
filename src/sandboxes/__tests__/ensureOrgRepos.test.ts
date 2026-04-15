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
  const runCommand = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      exitCode: 0,
      stdout: async () => "/root",
      stderr: async () => "",
    });
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

  it("clones org repos deterministically via git clone", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();
    // git check returns 1 = no .git found, needs clone
    sandbox.runCommand.mockImplementation((opts: any) => {
      if (opts?.args?.[1]?.includes("test -d") || opts?.args?.[1]?.includes("test -f")) {
        return Promise.resolve({ exitCode: 1, stdout: async () => "", stderr: async () => "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: async () => "/root", stderr: async () => "" });
    });

    await ensureOrgRepos(sandbox, "account-1");

    const cloneCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.[0] === "clone"
    );
    expect(cloneCall).toBeDefined();
    expect(cloneCall![0].args[1]).toContain("org-test-org-org-1");
  });

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

  it("continues when one repo creation fails", async () => {
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
    sandbox.runCommand.mockImplementation((opts: any) => {
      if (opts?.args?.[1]?.includes("test -d") || opts?.args?.[1]?.includes("test -f")) {
        return Promise.resolve({ exitCode: 1, stdout: async () => "", stderr: async () => "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: async () => "/root", stderr: async () => "" });
    });

    await ensureOrgRepos(sandbox, "account-1");

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledTimes(2);

    const cloneCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.[0] === "clone"
    );
    expect(cloneCall).toBeDefined();
  });

  it("pulls instead of cloning when .git exists", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Test Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(
      "https://github.com/recoupable/org-test-org-org-1"
    );

    const sandbox = createMockSandbox();
    // git check returns 0 = .git found
    sandbox.runCommand.mockImplementation((opts: any) => {
      if (opts?.args?.[1]?.includes("test -d") || opts?.args?.[1]?.includes("test -f")) {
        return Promise.resolve({ exitCode: 0, stdout: async () => "", stderr: async () => "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: async () => "/root", stderr: async () => "" });
    });

    await ensureOrgRepos(sandbox, "account-1");

    const pullCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.includes("pull")
    );
    expect(pullCall).toBeDefined();

    const cloneCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.[0] === "clone"
    );
    expect(cloneCall).toBeUndefined();
  });

  it("skips clone when all repo creations fail", async () => {
    mockGetAccountOrgs.mockResolvedValueOnce([
      { organizationId: "org-1", organizationName: "Failing Org" },
    ]);

    mockCreateOrgGithubRepo.mockResolvedValueOnce(undefined);

    const sandbox = createMockSandbox();

    await ensureOrgRepos(sandbox, "account-1");

    const cloneCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" && call[0]?.args?.[0] === "clone"
    );
    expect(cloneCall).toBeUndefined();
  });
});
