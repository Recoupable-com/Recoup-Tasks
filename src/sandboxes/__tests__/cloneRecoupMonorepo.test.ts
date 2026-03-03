import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("../getSandboxHomeDir", () => ({
  getSandboxHomeDir: vi.fn().mockResolvedValue("/home/user"),
}));

const { cloneRecoupMonorepo } = await import("../cloneRecoupMonorepo");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

function successResult(stdout = "") {
  return {
    exitCode: 0,
    stdout: async () => stdout,
    stderr: async () => "",
  };
}

function failResult(stderr = "error") {
  return {
    exitCode: 1,
    stdout: async () => "",
    stderr: async () => stderr,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test123";
});

describe("cloneRecoupMonorepo", () => {
  it("clones the monorepo and returns the clone directory", async () => {
    const sandbox = createMockSandbox();
    // git clone
    sandbox.runCommand.mockResolvedValueOnce(successResult());
    // git config user.email
    sandbox.runCommand.mockResolvedValueOnce(successResult());
    // git config user.name
    sandbox.runCommand.mockResolvedValueOnce(successResult());
    // git config url rewrite
    sandbox.runCommand.mockResolvedValueOnce(successResult());

    const result = await cloneRecoupMonorepo(sandbox);

    expect(result).toBe("/home/user/monorepo");
    // First call should be git clone with --recurse-submodules
    const cloneCall = sandbox.runCommand.mock.calls[0][0];
    expect(cloneCall.cmd).toBe("git");
    expect(cloneCall.args).toContain("clone");
    expect(cloneCall.args).toContain("--recurse-submodules");
  });

  it("configures git user as Recoup Agent", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    await cloneRecoupMonorepo(sandbox);

    const emailCall = sandbox.runCommand.mock.calls.find((call: any[]) =>
      call[0]?.args?.includes("user.email"),
    );
    expect(emailCall).toBeDefined();
    expect(emailCall![0].args).toContain("agent@recoupable.com");
  });

  it("returns null when clone fails", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce(failResult("auth failed"));

    const result = await cloneRecoupMonorepo(sandbox);

    expect(result).toBeNull();
  });

  it("returns null when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    const result = await cloneRecoupMonorepo(sandbox);

    expect(result).toBeNull();
  });

  it("uses authenticated URL with GITHUB_TOKEN", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    await cloneRecoupMonorepo(sandbox);

    const cloneCall = sandbox.runCommand.mock.calls[0][0];
    const urlArg = cloneCall.args.find((a: string) =>
      a.includes("x-access-token"),
    );
    expect(urlArg).toContain("ghp_test123");
  });
});
