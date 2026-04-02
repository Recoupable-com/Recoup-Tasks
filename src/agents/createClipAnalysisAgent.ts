import { ToolLoopAgent, stepCountIs } from "ai";

/**
 * Creates a ToolLoopAgent configured for analyzing song clips.
 *
 * @returns A configured ToolLoopAgent using Google Gemini via AI Gateway.
 */
export function createClipAnalysisAgent() {
  return new ToolLoopAgent({
    model: "google/gemini-2.5-flash",
    stopWhen: stepCountIs(1),
  });
}
