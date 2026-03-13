import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn(), append: vi.fn() },
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: vi.fn().mockResolvedValue({
      sandboxId: "sbx_123",
      status: "running",
    }),
  },
}));

vi.mock("../../recoup/createAccountSandbox", () => ({
  createAccountSandbox: vi.fn().mockResolvedValue({ sandboxId: "sbx_123" }),
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
const { createAccountSandbox } = await import("../../recoup/createAccountSandbox");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateSandbox", () => {
  it("calls createAccountSandbox with accountId", async () => {
    await getOrCreateSandbox("acc_1");

    expect(createAccountSandbox).toHaveBeenCalledWith("acc_1");
  });

  it("connects to sandbox via Sandbox.get with returned sandboxId", async () => {
    await getOrCreateSandbox("acc_1");

    expect(Sandbox.get).toHaveBeenCalledWith(expect.objectContaining({ sandboxId: "sbx_123" }));
  });

  it("returns sandboxId and sandbox instance", async () => {
    const result = await getOrCreateSandbox("acc_1");

    expect(result.sandboxId).toBe("sbx_123");
    expect(result.sandbox).toEqual(expect.objectContaining({ sandboxId: "sbx_123" }));
  });

  it("throws when createAccountSandbox returns undefined", async () => {
    vi.mocked(createAccountSandbox).mockResolvedValueOnce(undefined);

    await expect(getOrCreateSandbox("acc_1")).rejects.toThrow(
      "Failed to create sandbox for account acc_1",
    );
  });
});
