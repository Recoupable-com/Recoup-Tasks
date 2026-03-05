import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("../installOpenClaw", () => ({
  installOpenClaw: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../setupOpenClaw", () => ({
  setupOpenClaw: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ensureGithubRepo", () => ({
  ensureGithubRepo: vi.fn().mockResolvedValue("https://github.com/org/repo"),
}));

vi.mock("../writeReadme", () => ({
  writeReadme: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ensureOrgRepos", () => ({
  ensureOrgRepos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ensureSetupSandbox", () => ({
  ensureSetupSandbox: vi.fn().mockResolvedValue(undefined),
}));

const { provisionSandbox } = await import("../provisionSandbox");
const { installOpenClaw } = await import("../installOpenClaw");
const { setupOpenClaw } = await import("../setupOpenClaw");
const { ensureGithubRepo } = await import("../ensureGithubRepo");
const { writeReadme } = await import("../writeReadme");
const { ensureOrgRepos } = await import("../ensureOrgRepos");
const { ensureSetupSandbox } = await import("../ensureSetupSandbox");

const mockSandbox = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("provisionSandbox", () => {
  it("calls all setup steps in order", async () => {
    const result = await provisionSandbox(mockSandbox, "sbx_123", "acc_456");

    expect(installOpenClaw).toHaveBeenCalledWith(mockSandbox);
    expect(setupOpenClaw).toHaveBeenCalledWith(mockSandbox, "acc_456");
    expect(ensureGithubRepo).toHaveBeenCalledWith(mockSandbox, "acc_456");
    expect(writeReadme).toHaveBeenCalledWith(
      mockSandbox,
      "sbx_123",
      "acc_456",
      "https://github.com/org/repo",
    );
    expect(ensureOrgRepos).toHaveBeenCalledWith(mockSandbox, "acc_456");
    expect(ensureSetupSandbox).toHaveBeenCalledWith(mockSandbox, "acc_456");
  });

  it("returns the github repo URL", async () => {
    const result = await provisionSandbox(mockSandbox, "sbx_123", "acc_456");
    expect(result.githubRepo).toBe("https://github.com/org/repo");
  });

  it("returns undefined githubRepo when ensureGithubRepo returns null", async () => {
    vi.mocked(ensureGithubRepo).mockResolvedValueOnce(null);
    const result = await provisionSandbox(mockSandbox, "sbx_123", "acc_456");
    expect(result.githubRepo).toBeUndefined();
  });
});
