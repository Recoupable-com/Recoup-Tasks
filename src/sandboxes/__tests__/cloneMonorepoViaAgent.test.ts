import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../runClaudeCodeAgent", () => ({
  runClaudeCodeAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
}));

const { cloneMonorepoViaAgent } = await import("../cloneMonorepoViaAgent");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cloneMonorepoViaAgent", () => {
  it("calls runClaudeCodeAgent with clone instructions", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    expect(runClaudeCodeAgent).toHaveBeenCalledOnce();
    expect(runClaudeCodeAgent).toHaveBeenCalledWith(
      sandbox,
      expect.objectContaining({
        label: "Clone monorepo via agent",
        message: expect.stringContaining("recoupable/mono"),
      }),
    );
  });

  it("instructs agent not to use --recursive", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    const message = vi.mocked(runClaudeCodeAgent).mock.calls[0][1].message;
    expect(message).toContain("do NOT use --recursive");
  });

  it("does not include git user config (handled by configureGitAuth)", async () => {
    const { runClaudeCodeAgent } = await import("../runClaudeCodeAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    const message = vi.mocked(runClaudeCodeAgent).mock.calls[0][1].message;
    expect(message).not.toContain("git config");
  });
});
