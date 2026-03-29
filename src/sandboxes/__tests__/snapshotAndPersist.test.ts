import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock("../../recoup/updateAccountSnapshot", () => ({
  updateAccountSnapshot: vi.fn().mockResolvedValue({ success: true }),
}));

const { snapshotAndPersist } = await import("../snapshotAndPersist");

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
  it("persists github repo without snapshotId", async () => {
    const sandbox = createMockSandbox();
    const { updateAccountSnapshot } = await import("../../recoup/updateAccountSnapshot");
    await snapshotAndPersist(sandbox, "acc_456", "https://github.com/org/repo");
    expect(updateAccountSnapshot).toHaveBeenCalledWith(
      "acc_456",
      undefined,
      "https://github.com/org/repo",
    );
  });

  it("does not take a sandbox snapshot", async () => {
    const sandbox = createMockSandbox();
    await snapshotAndPersist(sandbox, "acc_456");
    expect(sandbox.snapshot).not.toHaveBeenCalled();
  });

  it("persists without snapshotId when no github repo", async () => {
    const sandbox = createMockSandbox();
    const { updateAccountSnapshot } = await import("../../recoup/updateAccountSnapshot");
    await snapshotAndPersist(sandbox, "acc_456");
    expect(updateAccountSnapshot).toHaveBeenCalledWith(
      "acc_456",
      undefined,
      undefined,
    );
  });
});
