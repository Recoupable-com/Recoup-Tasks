import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { pushOrgSubmodules } = await import("../pushOrgSubmodules");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushOrgSubmodules", () => {
  it("skips when .gitmodules does not exist", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 1, // test -f .gitmodules fails
    });

    await pushOrgSubmodules(sandbox);

    // Only called once for the test -f check
    expect(sandbox.runCommand).toHaveBeenCalledTimes(1);
  });

  it("skips when no org submodule paths found", async () => {
    const sandbox = createMockSandbox();
    // test -f .gitmodules succeeds
    sandbox.runCommand.mockResolvedValueOnce({ exitCode: 0 });
    // git config --get-regexp path returns non-org paths
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "submodule.lib/shared.path lib/shared\n",
    });

    await pushOrgSubmodules(sandbox);

    expect(sandbox.runCommand).toHaveBeenCalledTimes(2);
  });

  it("pushes changes for org submodule with changes", async () => {
    const sandbox = createMockSandbox();

    // test -f .gitmodules succeeds
    sandbox.runCommand.mockResolvedValueOnce({ exitCode: 0 });

    // git config --get-regexp returns org paths
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () =>
        "submodule.orgs/my-org.path orgs/my-org\n",
    });

    // git -C config email
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C config name
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C add -A
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C diff --cached --quiet (exit 1 = has changes)
    sandbox.runCommand.mockResolvedValueOnce({ exitCode: 1 });

    // git -C commit
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C push
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    await pushOrgSubmodules(sandbox);

    // Verify push was called with the right args
    const pushCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.includes("push")
    );
    expect(pushCall).toBeDefined();
    expect(pushCall![0].args).toContain("orgs/my-org");
  });

  it("skips push when no changes in submodule", async () => {
    const sandbox = createMockSandbox();

    // test -f .gitmodules
    sandbox.runCommand.mockResolvedValueOnce({ exitCode: 0 });

    // git config --get-regexp
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () =>
        "submodule.orgs/my-org.path orgs/my-org\n",
    });

    // git -C config email
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C config name
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C add -A
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    // git -C diff --cached --quiet (exit 0 = no changes)
    sandbox.runCommand.mockResolvedValueOnce({ exitCode: 0 });

    await pushOrgSubmodules(sandbox);

    // No commit or push should happen
    const pushCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.includes("push")
    );
    expect(pushCall).toBeUndefined();
  });
});
