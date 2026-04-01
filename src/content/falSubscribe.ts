import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Wraps fal.subscribe with structured error logging.
 * Logs model, status, and a safely-serialized body on failure, then rethrows.
 */
export async function falSubscribe(
  model: string,
  input: Record<string, unknown>,
): Promise<ReturnType<typeof fal.subscribe>> {
  try {
    return await fal.subscribe(model, { input, logs: true });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    let body: string;
    try {
      body = JSON.stringify(err.body ?? err).slice(0, 1000);
    } catch {
      body = String(err).slice(0, 1000);
    }
    logger.error("fal.ai request failed", {
      model,
      status: err.status,
      message: err.message,
      body,
    });
    throw error;
  }
}
