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

const { assessPRFeedback } = await import("../assessPRFeedback");

const mockSandbox = {} as any;

const noFeedback = { reviews: [], comments: [] };
const withFeedback = {
  reviews: [
    {
      author: "reviewer",
      body: "Missing error handling in the route handler.",
      state: "CHANGES_REQUESTED",
      submittedAt: "2026-03-01T12:00:00Z",
    },
  ],
  comments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assessPRFeedback", () => {
  it("returns no actionable feedback when reviews and comments are empty", async () => {
    const result = await assessPRFeedback(mockSandbox, "recoupable/api", "Build feature X", noFeedback);

    expect(result.hasActionableFeedback).toBe(false);
    expect(mockRunClaudeCodeAgent).not.toHaveBeenCalled();
  });

  it("returns actionable feedback parsed from Claude Code response", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        hasActionableFeedback: true,
        feedbackSummary: "Add error handling",
        implementation: "Wrap the handler in a try/catch and return 500 on error",
      }),
      stderr: "",
    });

    const result = await assessPRFeedback(
      mockSandbox,
      "recoupable/api",
      "Build feature X",
      withFeedback,
    );

    expect(result.hasActionableFeedback).toBe(true);
    expect(result.feedbackSummary).toBe("Add error handling");
    expect(result.implementation).toContain("try/catch");
  });

  it("returns no actionable feedback when Claude Code exits non-zero", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "error",
    });

    const result = await assessPRFeedback(mockSandbox, "recoupable/api", "Feature", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
  });

  it("returns no actionable feedback when JSON parsing fails", async () => {
    mockRunClaudeCodeAgent.mockResolvedValueOnce({
      exitCode: 0,
      stdout: "not valid json",
      stderr: "",
    });

    const result = await assessPRFeedback(mockSandbox, "recoupable/api", "Feature", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
  });

  it("returns no actionable feedback when runClaudeCodeAgent throws", async () => {
    mockRunClaudeCodeAgent.mockRejectedValueOnce(new Error("Sandbox error"));

    const result = await assessPRFeedback(mockSandbox, "recoupable/api", "Feature", withFeedback);

    expect(result.hasActionableFeedback).toBe(false);
  });
});
