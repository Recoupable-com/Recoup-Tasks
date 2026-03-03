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
  it("sets up global URL rewriting before cloning", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    await cloneRecoupMonorepo(sandbox);

    // URL rewrite calls should come BEFORE the clone call
    const calls = sandbox.runCommand.mock.calls.map((c: any[]) => c[0]);
    const cloneIdx = calls.findIndex(
      (c: any) => c.cmd === "git" && c.args?.includes("clone"),
    );
    const httpsRewriteIdx = calls.findIndex(
      (c: any) =>
        c.cmd === "git" &&
        c.args?.some((a: string) => a.includes("insteadOf")) &&
        c.args?.includes("https://github.com/"),
    );
    const sshRewriteIdx = calls.findIndex(
      (c: any) =>
        c.cmd === "git" &&
        c.args?.some((a: string) => a.includes("insteadOf")) &&
        c.args?.includes("git@github.com:"),
    );

    expect(httpsRewriteIdx).toBeLessThan(cloneIdx);
    expect(sshRewriteIdx).toBeLessThan(cloneIdx);
  });

  it("uses --global flag for URL rewriting", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    await cloneRecoupMonorepo(sandbox);

    const calls = sandbox.runCommand.mock.calls.map((c: any[]) => c[0]);
    const rewriteCalls = calls.filter(
      (c: any) =>
        c.cmd === "git" &&
        c.args?.some((a: string) => a.includes("insteadOf")),
    );
    for (const call of rewriteCalls) {
      expect(call.args).toContain("--global");
    }
  });

  it("clones the monorepo and returns the clone directory", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    const result = await cloneRecoupMonorepo(sandbox);

    expect(result).toBe("/home/user/monorepo");
    const calls = sandbox.runCommand.mock.calls.map((c: any[]) => c[0]);
    const cloneCall = calls.find(
      (c: any) => c.cmd === "git" && c.args?.includes("clone"),
    );
    expect(cloneCall).toBeDefined();
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
    // URL rewrites succeed
    sandbox.runCommand.mockResolvedValueOnce(successResult());
    sandbox.runCommand.mockResolvedValueOnce(successResult());
    // Clone fails
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

    const calls = sandbox.runCommand.mock.calls.map((c: any[]) => c[0]);
    const cloneCall = calls.find(
      (c: any) => c.cmd === "git" && c.args?.includes("clone"),
    );
    const urlArg = cloneCall.args.find((a: string) =>
      a.includes("x-access-token"),
    );
    expect(urlArg).toContain("ghp_test123");
  });

  it("rewrites both HTTPS and SSH GitHub URLs", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValue(successResult());

    await cloneRecoupMonorepo(sandbox);

    const calls = sandbox.runCommand.mock.calls.map((c: any[]) => c[0]);
    const rewriteCalls = calls.filter(
      (c: any) =>
        c.cmd === "git" &&
        c.args?.some((a: string) => a.includes("insteadOf")),
    );
    const sources = rewriteCalls.map((c: any) => c.args[c.args.length - 1]);
    expect(sources).toContain("https://github.com/");
    expect(sources).toContain("git@github.com:");
  });
});
