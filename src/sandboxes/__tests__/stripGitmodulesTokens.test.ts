import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { stripGitmodulesTokens } = await import("../git/stripGitmodulesTokens");

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

describe("stripGitmodulesTokens", () => {
  it("replaces x-access-token URLs with plain github URLs", async () => {
    const sandbox = createMockSandbox();

    await stripGitmodulesTokens(sandbox);

    const sedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes("x-access-token") &&
        call[0]?.args?.[1]?.includes(".gitmodules")
    );
    expect(sedCall).toBeDefined();

    const cmd = sedCall![0].args[1];
    expect(cmd).toContain("https://github.com/");
  });

  it("stages .gitmodules after stripping", async () => {
    const sandbox = createMockSandbox();

    await stripGitmodulesTokens(sandbox);

    const sedCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.cmd === "sh" &&
        call[0]?.args?.[1]?.includes(".gitmodules")
    );
    const cmd = sedCall![0].args[1];
    expect(cmd).toContain("git add .gitmodules");
  });
});
