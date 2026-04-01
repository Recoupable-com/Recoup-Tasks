import fs from "node:fs/promises";
import { logStep } from "../sandboxes/logStep";

/**
 * Logs the contents of a template directory for diagnostic purposes.
 *
 * @param templateDir - Path to the template directory
 */
export async function logTemplateContents(templateDir: string): Promise<void> {
  const MAX_SAMPLE_FILES = 10;
  try {
    const entries = await fs.readdir(templateDir, { recursive: true });
    logStep("loadTemplate: directory contents", false, {
      templateDir,
      totalFiles: entries.length,
      sampleFiles: entries.slice(0, MAX_SAMPLE_FILES),
      ...(entries.length > MAX_SAMPLE_FILES && { hasMore: true }),
    });
  } catch (err) {
    logStep("loadTemplate: failed to list directory", true, {
      templateDir,
      error: String(err),
    });
  }
}
