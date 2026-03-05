import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("../../recoup/updateAccountSnapshot", () => ({
  updateAccountSnapshot: vi.fn().mockResolvedValue({ success: true, snapshotId: "snap_123" }),
}));

const { snapshotAndPersist } = await import("../snapshotAndPersist");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function createMockSandbox() {
  return {
    snapshot: vi.fn().mockResolvedValue({
      snapshotId: "snap_123",
      expiresAt: new Date("2026-03-12T00:00:00Z"),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("snapshotAndPersist", () => {
  it("passes 7-day expiration to sandbox.snapshot()", async () => {
    const sandbox = createMockSandbox();
    await snapshotAndPersist(sandbox, "acc_456");
    expect(sandbox.snapshot).toHaveBeenCalledWith({ expiration: SEVEN_DAYS_MS });
  });

  it("returns the snapshot result", async () => {
    const sandbox = createMockSandbox();
    const result = await snapshotAndPersist(sandbox, "acc_456");
    expect(result.snapshotId).toBe("snap_123");
  });

  it("persists snapshot with github repo when provided", async () => {
    const sandbox = createMockSandbox();
    const { updateAccountSnapshot } = await import("../../recoup/updateAccountSnapshot");
    await snapshotAndPersist(sandbox, "acc_456", "https://github.com/org/repo");
    expect(updateAccountSnapshot).toHaveBeenCalledWith(
      "acc_456",
      "snap_123",
      "https://github.com/org/repo",
    );
  });
});
