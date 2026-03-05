import { logger, metadata } from "@trigger.dev/sdk/v3";

/**
 * Logs a task step to both metadata (account-facing observability)
 * and the internal logger.
 *
 * @param message - The step message
 * @param isStep - If true, also sets currentStep metadata (default: true)
 */
export function logStep(
  message: string,
  isStep = true,
  extra?: Record<string, unknown>,
): void {
  if (isStep) {
    metadata.set("currentStep", message);
  }
  metadata.append("logs", message);
  logger.log(message, extra);
}
