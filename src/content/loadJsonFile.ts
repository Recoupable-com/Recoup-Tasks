import fs from "node:fs/promises";
import { logStep } from "../sandboxes/logStep";

/**
 * Load a JSON file. Returns null if the file doesn't exist.
 * Rethrows parse errors and unexpected I/O failures so callers surface real bugs.
 *
 * @param filePath
 * @param label
 */
export async function loadJsonFile<T>(filePath: string, label: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as T;
    logStep(`loadTemplate: loaded ${label}`, false, {
      path: filePath,
      sizeBytes: raw.length,
    });
    return parsed;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    logStep(`loadTemplate: FAILED to load ${label}`, true, {
      path: filePath,
      error: String(err),
    });
    throw err;
  }
}
