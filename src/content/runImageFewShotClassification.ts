import { logStep } from "../sandboxes/logStep";

interface FewShotAgent {
  generate: (args: {
    messages: Array<{
      role: "user" | "assistant";
      content: Array<{ type: "image"; image: string } | { type: "text"; text: string }>;
    }>;
  }) => Promise<{ output: Record<string, boolean> | null | undefined }>;
}

/**
 * Runs a two-shot image classification: shows the model one example image with a
 * canned positive answer, then asks it to classify the target image.
 *
 * On any failure, logs and returns false (safe default for classification).
 */
export async function runImageFewShotClassification({
  agent,
  exampleImageUrl,
  examplePrompt,
  targetImageUrl,
  targetPrompt,
  outputKey,
  logLabel,
}: {
  agent: FewShotAgent;
  exampleImageUrl: string;
  examplePrompt: string;
  targetImageUrl: string;
  targetPrompt: string;
  outputKey: string;
  logLabel: string;
}): Promise<boolean> {
  try {
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: exampleImageUrl },
            { type: "text", text: examplePrompt },
          ],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: `{"${outputKey}":true}` }],
        },
        {
          role: "user",
          content: [
            { type: "image", image: targetImageUrl },
            { type: "text", text: targetPrompt },
          ],
        },
      ],
    });

    const result = output?.[outputKey] ?? false;
    logStep(`${logLabel} result`, false, { imageUrl: targetImageUrl, [outputKey]: result });
    return result;
  } catch (err) {
    logStep(`${logLabel} failed, assuming false`, false, {
      imageUrl: targetImageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
