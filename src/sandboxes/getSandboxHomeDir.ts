import type { Sandbox } from "@vercel/sandbox";

/**
 * Resolves the home directory inside a Vercel Sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @returns The home directory path, defaults to "/root" if detection fails
 */
export async function getSandboxHomeDir(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.runCommand({ cmd: "sh", args: ["-c", "echo ~"] });
  return ((await result.stdout()) || "").trim() || "/root";
}
