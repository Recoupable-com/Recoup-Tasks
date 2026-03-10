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
    // openclaw agent command
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
    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeUndefined();
  });

  it("runs an openclaw agent prompt to sync org repos", async () => {
    const sandbox = createMockSandbox(["org-one", "org-two"]);

    await syncOrgRepos(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeDefined();

    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );
    expect(message).toContain("git fetch origin main");
    expect(message).toContain("git reset --hard origin/main");
  });

  it("instructs OpenClaw to handle .git files (submodule gitlinks)", async () => {
    const sandbox = createMockSandbox(["org-one"]);

    await syncOrgRepos(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );
    expect(message).toContain(".git file");
  });
});
