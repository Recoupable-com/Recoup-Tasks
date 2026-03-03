import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

const { logStep } = await import("../logStep");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logStep", () => {
  it("sets metadata and logs the message", async () => {
    const { logger, metadata } = await import("@trigger.dev/sdk/v3");

    logStep("Installing deps");

    expect(metadata.set).toHaveBeenCalledWith("currentStep", "Installing deps");
    expect(metadata.append).toHaveBeenCalledWith("logs", "Installing deps");
    expect(logger.log).toHaveBeenCalledWith("Installing deps");
  });

  it("skips currentStep metadata when isStep is false", async () => {
    const { metadata } = await import("@trigger.dev/sdk/v3");

    logStep("debug info", false);

    expect(metadata.set).not.toHaveBeenCalled();
    expect(metadata.append).toHaveBeenCalledWith("logs", "debug info");
  });

  it("passes details to logger.log but not to metadata", async () => {
    const { logger, metadata } = await import("@trigger.dev/sdk/v3");

    logStep("Agent finished", true, { exitCode: 0, stdout: "done" });

    expect(logger.log).toHaveBeenCalledWith("Agent finished", {
      exitCode: 0,
      stdout: "done",
    });
    // metadata should NOT include the details object
    expect(metadata.append).toHaveBeenCalledWith("logs", "Agent finished");
  });

  it("logs without details when none provided", async () => {
    const { logger } = await import("@trigger.dev/sdk/v3");

    logStep("Simple step");

    expect(logger.log).toHaveBeenCalledWith("Simple step");
  });
});
