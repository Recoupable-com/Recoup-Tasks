import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("../onboardOpenClaw", () => ({
  onboardOpenClaw: vi.fn().mockResolvedValue(undefined),
}));

const { setupOpenClaw } = await import("../setupOpenClaw");

/**
 *
 */
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
  process.env.RECOUP_API_KEY = "test-recoup-key";
  process.env.GITHUB_TOKEN = "test-github-token";
});

describe("setupOpenClaw", () => {
  it("throws when RECOUP_API_KEY is missing", async () => {
    delete process.env.RECOUP_API_KEY;
    const sandbox = createMockSandbox();

    await expect(setupOpenClaw(sandbox, "account-1")).rejects.toThrow("Missing RECOUP_API_KEY");
  });

  it("injects RECOUP_API_KEY and RECOUP_ACCOUNT_ID into openclaw.json", async () => {
    const sandbox = createMockSandbox();

    await setupOpenClaw(sandbox, "account-1");

    // Find the node -e call that injects env vars
    const injectCall = sandbox.runCommand.mock.calls.find((call: any[]) => {
      const args = call[0]?.args;
      return args?.[0] === "-c" && args?.[1]?.includes("openclaw.json");
    });

    expect(injectCall).toBeDefined();
    const script = injectCall![0].args[1];
    expect(script).toContain("RECOUP_API_KEY");
    expect(script).toContain("RECOUP_ACCOUNT_ID");
    expect(script).toContain("test-recoup-key");
    expect(script).toContain("account-1");
  });

  /**
   * Regression test for production error:
   * "All 6 clones failed — GITHUB_TOKEN is not set in the environment"
   *
   * The env param on sandbox.runCommand() only sets vars for that process,
   * NOT for OpenClaw's agent subprocesses. GITHUB_TOKEN must be injected
   * into openclaw.json's env block so OpenClaw agents can access it.
   */
  it("injects GITHUB_TOKEN into openclaw.json when available", async () => {
    const sandbox = createMockSandbox();

    await setupOpenClaw(sandbox, "account-1");

    // Find the node -e call that injects env vars
    const injectCall = sandbox.runCommand.mock.calls.find((call: any[]) => {
      const args = call[0]?.args;
      return args?.[0] === "-c" && args?.[1]?.includes("openclaw.json");
    });

    expect(injectCall).toBeDefined();
    const script = injectCall![0].args[1];
    expect(script).toContain("GITHUB_TOKEN");
    expect(script).toContain("test-github-token");
  });

  it("works without GITHUB_TOKEN (does not crash)", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    // Should not throw
    await setupOpenClaw(sandbox, "account-1");

    // Env injection call should still run (for RECOUP vars)
    const injectCall = sandbox.runCommand.mock.calls.find((call: any[]) => {
      const args = call[0]?.args;
      return args?.[0] === "-c" && args?.[1]?.includes("openclaw.json");
    });
    expect(injectCall).toBeDefined();
  });

  it("sets coding tools profile in openclaw.json", async () => {
    const sandbox = createMockSandbox();

    await setupOpenClaw(sandbox, "account-1");

    const injectCall = sandbox.runCommand.mock.calls.find((call: any[]) => {
      const args = call[0]?.args;
      return args?.[0] === "-c" && args?.[1]?.includes("openclaw.json");
    });

    expect(injectCall).toBeDefined();
    const script = injectCall![0].args[1];
    expect(script).toContain("tools");
    expect(script).toContain("coding");
  });

  it("starts the openclaw gateway after env injection", async () => {
    const sandbox = createMockSandbox();

    await setupOpenClaw(sandbox, "account-1");

    // Find the gateway start call
    const gatewayCall = sandbox.runCommand.mock.calls.find((call: any[]) => {
      const args = call[0]?.args;
      return args?.[1]?.includes("gateway");
    });

    expect(gatewayCall).toBeDefined();
  });

  it("throws when env injection fails", async () => {
    const sandbox = createMockSandbox();

    // Make the second runCommand call (env injection) fail
    // First call is onboardOpenClaw (mocked), so first runCommand is env injection
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: async () => "",
      stderr: async () => "node script failed",
    });

    await expect(setupOpenClaw(sandbox, "account-1")).rejects.toThrow("Failed to inject env vars");
  });
});
