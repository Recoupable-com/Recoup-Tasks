import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../runOpenClawAgent", () => ({
  runOpenClawAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
}));

const { cloneMonorepoViaAgent } = await import("../cloneMonorepoViaAgent");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cloneMonorepoViaAgent", () => {
  it("calls runOpenClawAgent with clone instructions", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    expect(runOpenClawAgent).toHaveBeenCalledOnce();
    expect(runOpenClawAgent).toHaveBeenCalledWith(
      sandbox,
      expect.objectContaining({
        label: "Clone monorepo via agent",
        message: expect.stringContaining("Recoup-Monorepo"),
      }),
    );
  });

  it("instructs agent not to use --recursive", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    const message = vi.mocked(runOpenClawAgent).mock.calls[0][1].message;
    expect(message).toContain("do NOT use --recursive");
  });

  it("does not include git user config (handled by configureGitAuth)", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    const sandbox = {} as any;

    await cloneMonorepoViaAgent(sandbox);

    const message = vi.mocked(runOpenClawAgent).mock.calls[0][1].message;
    expect(message).not.toContain("git config");
  });

  it("forwards env to runOpenClawAgent when provided", async () => {
    const { runOpenClawAgent } = await import("../runOpenClawAgent");
    const sandbox = {} as any;
    const env = { GITHUB_TOKEN: "tok", RECOUP_API_KEY: "key", RECOUP_ACCOUNT_ID: "acc" };

    await cloneMonorepoViaAgent(sandbox, env);

    expect(runOpenClawAgent).toHaveBeenCalledWith(
      sandbox,
      expect.objectContaining({ env }),
    );
  });
});
