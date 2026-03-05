import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../../recoup/getAccountSandboxes", () => ({
  getAccountSandboxes: vi.fn(),
}));

vi.mock("../../recoup/getAccount", () => ({
  getAccount: vi.fn(),
}));

vi.mock("../../github/createGithubRepo", () => ({
  createGithubRepo: vi.fn(),
}));

vi.mock("../../recoup/updateAccountSnapshot", () => ({
  updateAccountSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../runGitCommand", () => ({
  runGitCommand: vi.fn().mockResolvedValue(true),
}));

const { ensureGithubRepo } = await import("../ensureGithubRepo");
const { getAccountSandboxes } = await import(
  "../../recoup/getAccountSandboxes"
);
const { getAccount } = await import("../../recoup/getAccount");
const { createGithubRepo } = await import("../../github/createGithubRepo");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "test-token";
});

describe("ensureGithubRepo", () => {
  it("updates origin remote when .git exists but points to wrong repo", async () => {
    const sandbox = createMockSandbox();

    vi.mocked(getAccountSandboxes).mockResolvedValueOnce({
      githubRepo: "https://github.com/recoupable/correct-repo",
      snapshotId: null,
      sandboxId: null,
    });

    // .git exists
    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "test" && opts.args?.[0] === "-d") {
        return { exitCode: 0 };
      }
      // git remote get-url origin returns WRONG repo
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "remote" &&
        opts.args?.[1] === "get-url" &&
        opts.args?.[2] === "origin"
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://x-access-token:old@github.com/recoupable/wrong-repo\n",
          stderr: async () => "",
        };
      }
      // git remote set-url
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "remote" &&
        opts.args?.[1] === "set-url"
      ) {
        return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    const result = await ensureGithubRepo(sandbox, "acc_1");

    expect(result).toBe("https://github.com/recoupable/correct-repo");

    // Should have called set-url to fix the remote
    const setUrlCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "remote" &&
        call[0]?.args?.[1] === "set-url",
    );
    expect(setUrlCall).toBeDefined();
    expect(setUrlCall![0].args[3]).toContain("recoupable/correct-repo");
  });

  it("skips remote update when origin already points to correct repo", async () => {
    const sandbox = createMockSandbox();

    vi.mocked(getAccountSandboxes).mockResolvedValueOnce({
      githubRepo: "https://github.com/recoupable/correct-repo",
      snapshotId: null,
      sandboxId: null,
    });

    sandbox.runCommand.mockImplementation(async (opts: any) => {
      if (opts.cmd === "test" && opts.args?.[0] === "-d") {
        return { exitCode: 0 };
      }
      if (
        opts.cmd === "git" &&
        opts.args?.[0] === "remote" &&
        opts.args?.[1] === "get-url"
      ) {
        return {
          exitCode: 0,
          stdout: async () =>
            "https://x-access-token:tok@github.com/recoupable/correct-repo\n",
          stderr: async () => "",
        };
      }
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    });

    const result = await ensureGithubRepo(sandbox, "acc_1");

    expect(result).toBe("https://github.com/recoupable/correct-repo");

    const setUrlCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "git" &&
        call[0]?.args?.[0] === "remote" &&
        call[0]?.args?.[1] === "set-url",
    );
    expect(setUrlCall).toBeUndefined();
  });
});
