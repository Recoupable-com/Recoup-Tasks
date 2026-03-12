import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../runClaudeCodeAgent", () => ({
  runClaudeCodeAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
}));

const { syncMonorepoSubmodules } = await import("../git/syncMonorepoSubmodules");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncMonorepoSubmodules", () => {
  it("runs a claude code agent prompt to sync submodules", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await syncMonorepoSubmodules(sandbox);

    expect(runClaudeCodeAgent).toHaveBeenCalledOnce();
  });

  it("instructs git fetch and checkout for each submodule", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await syncMonorepoSubmodules(sandbox);

    const message = vi.mocked(runClaudeCodeAgent).mock.calls[0][1].message;

    expect(message).toContain("git fetch");
    expect(message).toContain("git checkout");
    expect(message).toContain("git reset --hard");
  });

  it("targets the mono directory", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await syncMonorepoSubmodules(sandbox);

    const message = vi.mocked(runClaudeCodeAgent).mock.calls[0][1].message;

    expect(message).toContain("mono");
  });
});
