import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const { syncOrgRepos } = await import("../git/syncOrgRepos");

function createMockSandbox() {
  const runCommand = vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: async () => "",
    stderr: async () => "",
  });

  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("syncOrgRepos", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await syncOrgRepos(sandbox);

    expect(sandbox.runCommand).not.toHaveBeenCalled();
  });

  it("runs an openclaw agent prompt to sync org repos", async () => {
    const sandbox = createMockSandbox();

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
    const sandbox = createMockSandbox();

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
