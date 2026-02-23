import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { addOrgSubmodules } = await import("../addOrgSubmodules");

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

describe("addOrgSubmodules", () => {
  it("skips when no GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await addOrgSubmodules(sandbox);

    expect(sandbox.runCommand).not.toHaveBeenCalled();
  });

  it("skips when no org repos found", async () => {
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
          stdout: async () => "",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await addOrgSubmodules(sandbox);

    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule"
    );
    expect(submoduleCalls).toHaveLength(0);
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
      if (opts.cmd === "sh" && opts.args?.[1]?.includes("find")) {
        return {
          exitCode: 0,
          stdout: async () => "recoup\nmyco-wtf\n",
          stderr: async () => "",
        };
      }
      if (opts.cmd === "git" && opts.args?.includes("get-url")) {
        const orgPath = opts.args?.[1];
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
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await addOrgSubmodules(sandbox);

    const submoduleCalls = sandbox.runCommand.mock.calls.filter(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "submodule" &&
        call[0]?.args?.[1] === "add"
    );
    expect(submoduleCalls).toHaveLength(2);

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
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await addOrgSubmodules(sandbox);

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
      if (
        opts.cmd === "sh" &&
        opts.args?.[1]?.includes("git config --file .gitmodules")
      ) {
        return { exitCode: 1, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    await addOrgSubmodules(sandbox);

    const cleanupCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("git rm") &&
        call[0]?.args?.[1]?.includes("--cached")
    );
    expect(cleanupCall).toBeDefined();
  });
});
