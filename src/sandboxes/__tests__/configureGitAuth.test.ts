import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
}));

const { configureGitAuth } = await import("../configureGitAuth");

function createMockSandbox() {
  const runCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
  return { runCommand } as any;
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test123";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("configureGitAuth", () => {
  it("configures git url.insteadOf with the auth prefix", async () => {
    const sandbox = createMockSandbox();

    await configureGitAuth(sandbox);

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: [
        "config",
        "--global",
        "url.https://x-access-token:ghp_test123@github.com/.insteadOf",
        "https://github.com/",
      ],
    });
  });

  it("configures git user email and name", async () => {
    const sandbox = createMockSandbox();

    await configureGitAuth(sandbox);

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: ["config", "--global", "user.email", "agent@recoupable.com"],
    });

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: ["config", "--global", "user.name", "Recoup Agent"],
    });
  });

  it("skips url.insteadOf when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await configureGitAuth(sandbox);

    const insteadOfCall = sandbox.runCommand.mock.calls.find(
      (call: any[]) =>
        call[0]?.args?.some?.((a: string) => a.includes("insteadOf"))
    );
    expect(insteadOfCall).toBeUndefined();
  });

  it("still configures git user when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const sandbox = createMockSandbox();

    await configureGitAuth(sandbox);

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: ["config", "--global", "user.email", "agent@recoupable.com"],
    });
  });
});
