import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  schemaTask: vi.fn((config) => config),
}));

const mockStop = vi.fn().mockResolvedValue(undefined);

vi.mock("../../sandboxes/getOrCreateSandbox", () => ({
  getOrCreateSandbox: vi.fn().mockResolvedValue({
    sandboxId: "sbx_123",
    sandbox: {
      sandboxId: "sbx_123",
      status: "running",
      stop: mockStop,
    },
  }),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../../sandboxes/provisionSandbox", () => ({
  provisionSandbox: vi
    .fn()
    .mockResolvedValue({ githubRepo: "https://github.com/org/repo" }),
}));

vi.mock("../../sandboxes/pushSandboxToGithub", () => ({
  pushSandboxToGithub: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../sandboxes/snapshotAndPersist", () => ({
  snapshotAndPersist: vi.fn().mockResolvedValue({
    snapshotId: "snap_abc",
    expiresAt: new Date("2026-03-12"),
  }),
}));

const { setupSandboxTask } = await import("../setupSandboxTask");
const { getOrCreateSandbox } = await import(
  "../../sandboxes/getOrCreateSandbox"
);
const { provisionSandbox } = await import(
  "../../sandboxes/provisionSandbox"
);
const { pushSandboxToGithub } = await import(
  "../../sandboxes/pushSandboxToGithub"
);
const { snapshotAndPersist } = await import(
  "../../sandboxes/snapshotAndPersist"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setupSandboxTask", () => {
  const run = setupSandboxTask.run;

  it("calls getOrCreateSandbox with accountId", async () => {
    await run({ accountId: "acc_1" });

    expect(getOrCreateSandbox).toHaveBeenCalledWith("acc_1");
  });

  it("calls provisionSandbox with sandbox, sandboxId, and accountId", async () => {
    await run({ accountId: "acc_1" });

    expect(provisionSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxId: "sbx_123" }),
      "sbx_123",
      "acc_1",
    );
  });

  it("calls snapshotAndPersist with githubRepo from provisionSandbox", async () => {
    await run({ accountId: "acc_1" });

    expect(snapshotAndPersist).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxId: "sbx_123" }),
      "acc_1",
      "https://github.com/org/repo",
    );
  });

  it("returns snapshotId and githubRepo on success", async () => {
    const result = await run({ accountId: "acc_1" });

    expect(result).toEqual({
      githubRepo: "https://github.com/org/repo",
      snapshotId: "snap_abc",
    });
  });

  it("stops the sandbox even when provisionSandbox throws", async () => {
    vi.mocked(provisionSandbox).mockRejectedValueOnce(new Error("boom"));

    await expect(run({ accountId: "acc_1" })).rejects.toThrow("boom");

    expect(mockStop).toHaveBeenCalled();
  });

  it("pushes to GitHub after provisioning and before snapshot", async () => {
    await run({ accountId: "acc_1" });

    expect(pushSandboxToGithub).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxId: "sbx_123" }),
    );
  });

  it("has maxDuration of 15 minutes", () => {
    expect(setupSandboxTask.maxDuration).toBe(60 * 15);
  });
});
