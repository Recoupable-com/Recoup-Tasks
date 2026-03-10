import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const { syncMonorepoSubmodules } = await import("../git/syncMonorepoSubmodules");

function createMockSandbox() {
  const runCommand = vi.fn().mockResolvedValue({
    wait: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    }),
    exitCode: 0,
    stdout: async () => "",
    stderr: async () => "",
  });

  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncMonorepoSubmodules", () => {
  it("runs an openclaw agent prompt to sync submodules", async () => {
    const sandbox = createMockSandbox();

    await syncMonorepoSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    expect(openclawCall).toBeDefined();
  });

  it("instructs git fetch and checkout for each submodule", async () => {
    const sandbox = createMockSandbox();

    await syncMonorepoSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );

    expect(message).toContain("git fetch");
    expect(message).toContain("git checkout");
    expect(message).toContain("git reset --hard");
  });

  it("targets the Recoup-Monorepo directory", async () => {
    const sandbox = createMockSandbox();

    await syncMonorepoSubmodules(sandbox);

    const openclawCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "openclaw"
    );
    const args = openclawCall![0].args;
    const message = args.find(
      (a: string, i: number) => args[i - 1] === "--message"
    );

    expect(message).toContain("Recoup-Monorepo");
  });
});
