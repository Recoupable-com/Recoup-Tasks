import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { copyOpenClawToRepo } = await import("../copyOpenClawToRepo");

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

describe("copyOpenClawToRepo", () => {
  it("copies .openclaw excluding workspace/orgs/", async () => {
    const sandbox = createMockSandbox();

    // Mock home dir and find to return no orgs (simplest path)
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await copyOpenClawToRepo(sandbox);

    // The copy command should remove orgs/ after copying
    const copyCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("cp -r") &&
        call[0]?.args?.[1]?.includes(".openclaw")
    );
    expect(copyCall).toBeDefined();

    const cmd = copyCall![0].args[1];
    // Must remove workspace/orgs after copy
    expect(cmd).toContain("rm -rf /vercel/sandbox/.openclaw/workspace/orgs");
  });

  it("runs git submodule add for each org repo", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      // find org repos
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\nmyco-wtf\n",
          stderr: async () => "",
        };
      }
      // git remote get-url
      if (opts.cmd === "git" && opts.args?.includes("get-url")) {
        const orgPath = opts.args?.[1]; // -C path
        if (orgPath?.includes("recoup")) {
          return {
            exitCode: 0,
            stdout: async () => "https://github.com/recoupable/recoup.git\n",
            stderr: async () => "",
          };
        }
        if (orgPath?.includes("myco-wtf")) {
          return {
            exitCode: 0,
            stdout: async () => "https://github.com/myco-wtf/myco-wtf.git\n",
            stderr: async () => "",
          };
        }
      }
      // submodule already registered check — not registered
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await copyOpenClawToRepo(sandbox);

    // Should run git submodule add for each org
    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(2);

    // Check paths
    const paths = submoduleCalls.map((call: any[]) => call[0].args[3]);
    expect(paths).toContain(".openclaw/workspace/orgs/recoup");
    expect(paths).toContain(".openclaw/workspace/orgs/myco-wtf");
  });

  it("skips already-registered submodules (idempotent)", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("get-url")) {
        return {
          exitCode: 0,
          stdout: async () => "https://github.com/recoupable/recoup.git\n",
          stderr: async () => "",
        };
      }
      // Already registered — check returns success
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await copyOpenClawToRepo(sandbox);

    // Should NOT run git submodule add
    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(0);
  });

  it("strips auth tokens from .gitmodules", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("get-url")) {
        return {
          exitCode: 0,
          stdout: async () => "https://github.com/recoupable/recoup.git\n",
          stderr: async () => "",
        };
      }
      // Not already registered
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await copyOpenClawToRepo(sandbox);

    // Should strip x-access-token from .gitmodules
    const sedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("x-access-token") &&
        call[0]?.args?.[1]?.includes(".gitmodules")
    );
    expect(sedCall).toBeDefined();
  });

  it("skips submodule registration when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await copyOpenClawToRepo(sandbox);

    // Should still copy .openclaw (the basic copy)
    const copyCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" && call[0]?.args?.[1]?.includes("cp -r")
    );
    expect(copyCall).toBeDefined();

    // Should NOT run git submodule add
    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(0);
  });

  it("cleans stale entries before submodule add", async () => {
    const sandbox = createMockSandbox();

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "sh" && opts.args?.[1] === "echo ~") {
        return {
          exitCode: 0,
          stdout: async () => "/root\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("get-url")) {
        return {
          exitCode: 0,
          stdout: async () => "https://github.com/recoupable/recoup.git\n",
          stderr: async () => "",
        };
      }
      // Not already registered
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await copyOpenClawToRepo(sandbox);

    // Should clean stale git index entries before submodule add
    const cleanupCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("git rm") &&
        call[0]?.args?.[1]?.includes("--cached")
    );
    expect(cleanupCall).toBeDefined();
  });
});
