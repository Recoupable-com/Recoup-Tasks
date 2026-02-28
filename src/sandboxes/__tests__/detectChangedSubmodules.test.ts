import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { detectChangedSubmodules } = await import("../detectChangedSubmodules");

function createMockSandbox() {
  const runCommand = vi.fn();
  return { runCommand } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectChangedSubmodules", () => {
  it("returns changed submodule names", async () => {
    const sandbox = createMockSandbox();
    // ls returns all submodule directories
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "api\nchat\ntasks\ndocs\n",
      stderr: async () => "",
    });
    // git status for api — has changes
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => " M src/lib/something.ts\n",
      stderr: async () => "",
    });
    // git status for chat — no changes
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });
    // git status for tasks — has changes
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "?? src/new-file.ts\n",
      stderr: async () => "",
    });
    // git status for docs — no changes
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    const result = await detectChangedSubmodules(sandbox, "/root/monorepo");

    expect(result).toEqual(["api", "tasks"]);
  });

  it("returns empty array when no submodules have changes", async () => {
    const sandbox = createMockSandbox();
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "api\nchat\n",
      stderr: async () => "",
    });
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });
    sandbox.runCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => "",
      stderr: async () => "",
    });

    const result = await detectChangedSubmodules(sandbox, "/root/monorepo");

    expect(result).toEqual([]);
  });
});
