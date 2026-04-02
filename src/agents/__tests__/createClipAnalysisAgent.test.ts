import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => {
  class MockToolLoopAgent {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
  }
  return {
    ToolLoopAgent: MockToolLoopAgent,
    stepCountIs: vi.fn((n: number) => `step-count-${n}`),
  };
});

import { createClipAnalysisAgent } from "../createClipAnalysisAgent";

describe("createClipAnalysisAgent", () => {
  it("returns an agent configured with google/gemini-2.5-flash", () => {
    const agent = createClipAnalysisAgent();
    const config = (agent as unknown as { config: Record<string, unknown> }).config;
    expect(config.model).toBe("google/gemini-2.5-flash");
  });

  it("sets stopWhen to stepCountIs(1)", () => {
    const agent = createClipAnalysisAgent();
    const config = (agent as unknown as { config: Record<string, unknown> }).config;
    expect(config.stopWhen).toBe("step-count-1");
  });
});
