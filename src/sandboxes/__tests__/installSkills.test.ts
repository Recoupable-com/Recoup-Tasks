import { describe, it, expect, vi, beforeEach } from "vitest";
import { installSkills } from "../installSkills";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("installSkills", () => {
  const mockStdout = vi.fn();
  const mockStderr = vi.fn();
  const mockRunCommand = vi.fn();

  const sandbox = { runCommand: mockRunCommand } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStdout.mockResolvedValue("");
    mockStderr.mockResolvedValue("");
  });

  it("should not throw when skills copy fails", async () => {
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: mockStdout,
      stderr: vi.fn().mockResolvedValue("cp: no such file or directory"),
    });

    await expect(installSkills(sandbox, "recoupable/skills")).resolves.not.toThrow();
  });

  it("should not throw when skills install fails", async () => {
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: mockStdout,
      stderr: vi.fn().mockResolvedValue("npm ERR! 404 Not Found"),
    });

    await expect(installSkills(sandbox, "recoupable/skills")).resolves.not.toThrow();
  });

  it("should succeed when both install and copy succeed", async () => {
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });

    await expect(installSkills(sandbox, "recoupable/skills")).resolves.not.toThrow();
  });

  it("should copy all skills to OpenClaw workspace", async () => {
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });

    await installSkills(sandbox, "recoupable/skills");

    const copyCall = mockRunCommand.mock.calls[1];
    const copyArgs = copyCall[0].args[1];
    expect(copyArgs).toContain("cp -r .agents/skills/* ~/.openclaw/workspace/skills/");
  });
});
