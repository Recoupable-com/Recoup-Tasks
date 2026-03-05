import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  schemaTask: vi.fn((config) => config),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: vi.fn().mockResolvedValue({
      sandboxId: "sbx_123",
      status: "running",
      stop: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("../../recoup/createAccountSandbox", () => ({
  createAccountSandbox: vi
    .fn()
    .mockResolvedValue({ sandboxId: "sbx_123" }),
}));

vi.mock("../../sandboxes/getVercelSandboxCredentials", () => ({
  getVercelSandboxCredentials: vi.fn().mockReturnValue({
    token: "tok",
    teamId: "team",
    projectId: "proj",
  }),
}));

vi.mock("../../sandboxes/provisionSandbox", () => ({
  provisionSandbox: vi
    .fn()
    .mockResolvedValue({ githubRepo: "https://github.com/org/repo" }),
}));

vi.mock("../../sandboxes/snapshotAndPersist", () => ({
  snapshotAndPersist: vi.fn().mockResolvedValue({
    snapshotId: "snap_abc",
    expiresAt: new Date("2026-03-12"),
  }),
}));

const { setupSandboxTask } = await import("../setupSandboxTask");
const { createAccountSandbox } = await import(
  "../../recoup/createAccountSandbox"
);
const { provisionSandbox } = await import(
  "../../sandboxes/provisionSandbox"
);
const { snapshotAndPersist } = await import(
  "../../sandboxes/snapshotAndPersist"
);
const { Sandbox } = await import("@vercel/sandbox");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setupSandboxTask", () => {
  const run = setupSandboxTask.run;

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

  it("throws when createAccountSandbox returns null", async () => {
    vi.mocked(createAccountSandbox).mockResolvedValueOnce(null);

    await expect(run({ accountId: "acc_1" })).rejects.toThrow(
      "Failed to create sandbox for account acc_1",
    );
  });

  it("stops the sandbox even when provisionSandbox throws", async () => {
    vi.mocked(provisionSandbox).mockRejectedValueOnce(new Error("boom"));
    const mockSandbox = await Sandbox.get({} as any);

    await expect(run({ accountId: "acc_1" })).rejects.toThrow("boom");

    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("has maxDuration of 15 minutes", () => {
    expect(setupSandboxTask.maxDuration).toBe(60 * 15);
  });
});
