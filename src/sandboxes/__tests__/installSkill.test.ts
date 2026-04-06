import { describe, it, expect, vi, beforeEach } from "vitest";
import { installSkill } from "../installSkill";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("installSkill", () => {
  const mockStdout = vi.fn();
  const mockStderr = vi.fn();
  const mockRunCommand = vi.fn();

  const sandbox = { runCommand: mockRunCommand } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStdout.mockResolvedValue("");
    mockStderr.mockResolvedValue("");
  });

  it("should not throw when skill copy fails", async () => {
    // Install succeeds
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    // Copy fails
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: mockStdout,
      stderr: vi.fn().mockResolvedValue("cp: no such file or directory"),
    });

    await expect(installSkill(sandbox, "recoupable/setup-artist")).resolves.not.toThrow();
  });

  it("should not throw when skill install fails", async () => {
    // Install fails
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: mockStdout,
      stderr: vi.fn().mockResolvedValue("npm ERR! 404 Not Found"),
    });

    await expect(installSkill(sandbox, "recoupable/setup-artist")).resolves.not.toThrow();
  });

  it("should succeed when both install and copy succeed", async () => {
    // Install succeeds
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    // Copy succeeds
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });

    await expect(installSkill(sandbox, "recoupable/setup-artist")).resolves.not.toThrow();
  });
});
