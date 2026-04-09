import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Execute ffmpeg with the given arguments.
 *
 * @param args - Array of ffmpeg CLI arguments.
 * @throws Error if ffmpeg exits with a non-zero code.
 */
export async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", args);
}
