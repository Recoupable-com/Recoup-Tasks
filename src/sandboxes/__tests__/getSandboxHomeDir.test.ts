import { describe, it, expect, vi } from "vitest";
import { getSandboxHomeDir } from "../getSandboxHomeDir";

function createMockSandbox(stdout = "/home/user") {
  return {
    runCommand: vi.fn().mockResolvedValue({
      stdout: async () => stdout,
    }),
  } as any;
}

describe("getSandboxHomeDir", () => {
  it("returns the home directory from the sandbox", async () => {
    const sandbox = createMockSandbox("/home/user");

    const result = await getSandboxHomeDir(sandbox);

    expect(result).toBe("/home/user");
    expect(sandbox.runCommand).toHaveBeenCalledWith({
      cmd: "sh",
      args: ["-c", "echo ~"],
    });
  });

  it("trims whitespace from the result", async () => {
    const sandbox = createMockSandbox("  /home/user\n");

    const result = await getSandboxHomeDir(sandbox);

    expect(result).toBe("/home/user");
  });

  it("falls back to /root when stdout is empty", async () => {
    const sandbox = createMockSandbox("");

    const result = await getSandboxHomeDir(sandbox);

    expect(result).toBe("/root");
  });

  it("falls back to /root when stdout is null", async () => {
    const sandbox = createMockSandbox(null as any);

    const result = await getSandboxHomeDir(sandbox);

    expect(result).toBe("/root");
  });
});
