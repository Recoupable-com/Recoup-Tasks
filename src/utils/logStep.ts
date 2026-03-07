import { logger } from "@trigger.dev/sdk/v3";

type LogLevel = "log" | "warn" | "error";

/**
 * Logs a step with a consistent format across tasks.
 * Wraps the Trigger.dev logger with a structured step name + detail pattern.
 *
 * @param step - Short label for the step (e.g. "poll-scraper")
 * @param message - What happened
 * @param detail - Optional structured metadata
 * @param level - Log level: "log" | "warn" | "error" (default: "log")
 */
export function logStep(
  step: string,
  message: string,
  detail?: Record<string, unknown>,
  level: LogLevel = "log"
): void {
  const payload = { step, ...detail };
  logger[level](message, payload);
}
