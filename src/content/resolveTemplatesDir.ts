import path from "node:path";
import fs from "node:fs/promises";
import { logStep } from "../sandboxes/logStep";

/**
 * Resolves the templates directory. Tries multiple strategies because
 * esbuild changes __dirname at bundle time:
 *   1. __dirname-relative (works locally with tsx)
 *   2. process.cwd()-relative (works in Trigger.dev deployments where
 *      additionalFiles preserves source-root-relative paths)
 *
 * @param dirname - The __dirname of the calling module
 */
export async function resolveTemplatesDir(dirname: string): Promise<string> {
  const candidates = [
    path.resolve(dirname, "../content/templates"),
    path.resolve(process.cwd(), "src/content/templates"),
  ];

  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // not found, try next
    }
  }

  logStep("Template directory not found", true, {
    dirname,
    cwd: process.cwd(),
    candidates,
  });
  throw new Error(
    `Templates directory not found. Tried: ${candidates.join(", ")}`,
  );
}
