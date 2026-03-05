import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn().mockResolvedValue({
      sandboxId: "sbx_from_snap",
      status: "running",
    }),
    get: vi.fn().mockResolvedValue({
      sandboxId: "sbx_fresh",
      status: "running",
    }),
  },
}));

vi.mock("../../recoup/getAccountSandboxes", () => ({
  getAccountSandboxes: vi.fn().mockResolvedValue({
    snapshotId: "snap_existing",
    githubRepo: "https://github.com/org/repo",
  }),
}));

vi.mock("../../recoup/createAccountSandbox", () => ({
  createAccountSandbox: vi
    .fn()
    .mockResolvedValue({ sandboxId: "sbx_fresh" }),
}));

vi.mock("../getVercelSandboxCredentials", () => ({
  getVercelSandboxCredentials: vi.fn().mockReturnValue({
    token: "tok",
    teamId: "team",
    projectId: "proj",
  }),
}));

vi.mock("../logStep", () => ({
  logStep: vi.fn(),
}));

const { getOrCreateSandbox } = await import("../getOrCreateSandbox");
const { Sandbox } = await import("@vercel/sandbox");
const { getAccountSandboxes } = await import(
  "../../recoup/getAccountSandboxes"
);
const { createAccountSandbox } = await import(
  "../../recoup/createAccountSandbox"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateSandbox", () => {
  it("creates sandbox from snapshot when one exists", async () => {
    const result = await getOrCreateSandbox("acc_1");

    expect(getAccountSandboxes).toHaveBeenCalledWith("acc_1");
    expect(Sandbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: "snapshot", snapshotId: "snap_existing" },
      }),
    );
    expect(createAccountSandbox).not.toHaveBeenCalled();
    expect(result.sandboxId).toBe("sbx_from_snap");
  });

  it("falls back to fresh sandbox when no snapshot exists", async () => {
    vi.mocked(getAccountSandboxes).mockResolvedValueOnce({
      snapshotId: null,
      githubRepo: null,
    });

    const result = await getOrCreateSandbox("acc_1");

    expect(Sandbox.create).not.toHaveBeenCalled();
    expect(createAccountSandbox).toHaveBeenCalledWith("acc_1");
    expect(result.sandboxId).toBe("sbx_fresh");
  });

  it("falls back to fresh sandbox when getAccountSandboxes returns undefined", async () => {
    vi.mocked(getAccountSandboxes).mockResolvedValueOnce(undefined);

    const result = await getOrCreateSandbox("acc_1");

    expect(createAccountSandbox).toHaveBeenCalledWith("acc_1");
    expect(result.sandboxId).toBe("sbx_fresh");
  });

  it("falls back to fresh sandbox when Sandbox.create from snapshot throws", async () => {
    vi.mocked(Sandbox.create).mockRejectedValueOnce(new Error("bad snapshot"));

    const result = await getOrCreateSandbox("acc_1");

    expect(Sandbox.create).toHaveBeenCalled();
    expect(createAccountSandbox).toHaveBeenCalledWith("acc_1");
    expect(result.sandboxId).toBe("sbx_fresh");
  });

  it("throws when fresh sandbox creation also fails", async () => {
    vi.mocked(getAccountSandboxes).mockResolvedValueOnce({
      snapshotId: null,
      githubRepo: null,
    });
    vi.mocked(createAccountSandbox).mockResolvedValueOnce(undefined);

    await expect(getOrCreateSandbox("acc_1")).rejects.toThrow(
      "Failed to create sandbox for account acc_1",
    );
  });

  it("returns sandbox object with sandboxId and sandbox instance", async () => {
    const result = await getOrCreateSandbox("acc_1");

    expect(result).toHaveProperty("sandboxId");
    expect(result).toHaveProperty("sandbox");
  });
});
