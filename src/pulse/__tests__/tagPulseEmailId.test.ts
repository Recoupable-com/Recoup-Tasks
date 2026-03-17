import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTagsAdd = vi.fn();
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
  tags: { add: (...args: unknown[]) => mockTagsAdd(...args) },
  wait: { for: vi.fn().mockResolvedValue(undefined) },
}));

const mockPollSandboxUntilStopped = vi.fn();
vi.mock("../pollSandboxUntilStopped", () => ({
  pollSandboxUntilStopped: (...args: unknown[]) =>
    mockPollSandboxUntilStopped(...args),
}));

const mockFetchLatestAccountEmailId = vi.fn();
vi.mock("../fetchLatestAccountEmailId", () => ({
  fetchLatestAccountEmailId: (...args: unknown[]) =>
    mockFetchLatestAccountEmailId(...args),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../../consts", () => ({
  RECOUP_API_KEY: "test-api-key",
}));

const { tagPulseEmailId } = await import("../tagPulseEmailId");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagPulseEmailId", () => {
  it("polls sandbox, fetches email, and adds tag", async () => {
    mockPollSandboxUntilStopped.mockResolvedValueOnce(undefined);
    mockFetchLatestAccountEmailId.mockResolvedValueOnce("resend-email-xyz");

    await tagPulseEmailId("sbx-1", "acc-123");

    expect(mockPollSandboxUntilStopped).toHaveBeenCalledWith("sbx-1", "test-api-key");
    expect(mockFetchLatestAccountEmailId).toHaveBeenCalledWith("acc-123", "test-api-key");
    expect(mockTagsAdd).toHaveBeenCalledWith("email:resend-email-xyz");
  });

  it("does not add tag when no email found", async () => {
    mockPollSandboxUntilStopped.mockResolvedValueOnce(undefined);
    mockFetchLatestAccountEmailId.mockResolvedValueOnce(null);

    await tagPulseEmailId("sbx-1", "acc-123");

    expect(mockTagsAdd).not.toHaveBeenCalled();
  });

  it("does not throw when polling fails", async () => {
    mockPollSandboxUntilStopped.mockRejectedValueOnce(new Error("Timeout"));

    await tagPulseEmailId("sbx-1", "acc-123");

    expect(mockFetchLatestAccountEmailId).not.toHaveBeenCalled();
    expect(mockTagsAdd).not.toHaveBeenCalled();
  });
});
