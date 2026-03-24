import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const mockRunClaudeCodeAgent = vi.fn();
vi.mock("../../sandboxes/runClaudeCodeAgent", () => ({
  runClaudeCodeAgent: (...args: unknown[]) => mockRunClaudeCodeAgent(...args),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const { generateFeaturePrompt } = await import("../generateFeaturePrompt");

const mockSandbox = {} as any;

const mockCommits = [
  {
    submodule: "api",
    repo: "recoupable/api",
    commits: [
      { sha: "abc1234", message: "feat: add privy logins endpoint", author: "Dev", date: "2026-03-01T00:00:00Z" },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateFeaturePrompt", () => {
  it("returns the Claude Code generated prompt on success", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 0,
      stdout: "Build a feature X in the api submodule.",
      stderr: "",
    });

    const result = await generateFeaturePrompt(mockSandbox, mockCommits);

    expect(result).toBe("Build a feature X in the api submodule.");
    expect(mockRunClaudeCodeAgent).toHaveBeenCalledWith(
      mockSandbox,
      expect.objectContaining({
        label: "Generate feature prompt",
        message: expect.stringContaining("abc1234"),
      }),
    );
  });

  it("returns fallback prompt when Claude Code exits non-zero", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "error",
    });

    const result = await generateFeaturePrompt(mockSandbox, mockCommits);

    expect(result).toContain("PROGRESS.md");
  });

  it("returns fallback prompt when Claude Code returns empty stdout", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });

    const result = await generateFeaturePrompt(mockSandbox, mockCommits);

    expect(result).toContain("PROGRESS.md");
  });

  it("returns fallback prompt when runClaudeCodeAgent throws", async () => {
    mockRunClaudeCodeAgent.mockRejectedValueOnce(new Error("Sandbox error"));

    const result = await generateFeaturePrompt(mockSandbox, mockCommits);

    expect(result).toContain("PROGRESS.md");
  });
});
