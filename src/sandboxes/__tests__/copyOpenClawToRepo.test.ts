import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { copyOpenClawToRepo } = await import("../copyOpenClawToRepo");

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
});

describe("copyOpenClawToRepo", () => {
  it("copies .openclaw excluding workspace/orgs/", async () => {
    const sandbox = createMockSandbox();

    await copyOpenClawToRepo(sandbox);

    const copyCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("cp -r") &&
        call[0]?.args?.[1]?.includes(".openclaw"),
    );
    expect(copyCall).toBeDefined();

    const cmd = copyCall![0].args[1];
    expect(cmd).toContain("rm -rf /vercel/sandbox/.openclaw/workspace/orgs");
  });

  it("strips nested .git directories from the copy", async () => {
    const sandbox = createMockSandbox();

    await copyOpenClawToRepo(sandbox);

    const copyCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "sh" && call[0]?.args?.[1]?.includes("cp -r"),
    );
    const cmd = copyCall![0].args[1];
    expect(cmd).toContain("find /vercel/sandbox/.openclaw -name .git");
    expect(cmd).toContain("-exec rm -rf");
  });

  it("does NOT run git submodule add", async () => {
    const sandbox = createMockSandbox();

    await copyOpenClawToRepo(sandbox);

    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) => call[0]?.cmd === "git" && call[0]?.args?.[0] === "submodule",
    );
    expect(submoduleCalls).toHaveLength(0);
  });

  it("does NOT strip .gitmodules tokens", async () => {
    const sandbox = createMockSandbox();

    await copyOpenClawToRepo(sandbox);

    const sedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) => call[0]?.cmd === "sh" && call[0]?.args?.[1]?.includes("x-access-token"),
    );
    expect(sedCall).toBeUndefined();
  });
});
