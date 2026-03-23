import { logger } from "@trigger.dev/sdk/v3";
import type { PRFeedback } from "../github/fetchPRReviews";

export interface FeedbackAssessment {
  hasActionableFeedback: boolean;
  feedbackSummary: string;
  implementation: string;
}

/**
 * Uses the Anthropic API to assess PR review feedback and determine
 * whether any changes should be implemented by the coding agent.
 *
 * Ignores automated bot comments and approvals without substantive feedback.
 * Returns a structured assessment with what (if anything) should be changed.
 */
export async function assessPRFeedback(
  repo: string,
  featureDescription: string,
  feedback: PRFeedback,
): Promise<FeedbackAssessment> {
  const noFeedback: FeedbackAssessment = {
    hasActionableFeedback: false,
    feedbackSummary: "No feedback",
    implementation: "",
  };

  if (feedback.reviews.length === 0 && feedback.comments.length === 0) {
    return noFeedback;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn("Missing ANTHROPIC_API_KEY — skipping feedback assessment");
    return noFeedback;
  }

  const reviewsText = feedback.reviews
    .map((r) => `Review by ${r.author} (${r.state}): ${r.body}`)
    .join("\n");

  const commentsText = feedback.comments
    .map((c) => `Comment by ${c.author} on ${c.path}: ${c.body}`)
    .join("\n");

  const feedbackText = [reviewsText, commentsText].filter(Boolean).join("\n\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              `You are reviewing PR feedback for the repo "${repo}".`,
              ``,
              `Feature that was implemented: ${featureDescription.slice(0, 500)}`,
              ``,
              `PR feedback received:`,
              feedbackText,
              ``,
              `Determine if there is actionable feedback that the coding agent should implement.`,
              `Ignore: automated bot comments, approval messages, "LGTM", CI failure notices.`,
              `Focus on: code quality issues, bugs, missing functionality, style violations.`,
              ``,
              `Respond with JSON only (no markdown):`,
              `{"hasActionableFeedback": boolean, "feedbackSummary": "brief summary", "implementation": "specific changes to make, or empty string"}`,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      logger.error("Anthropic API error assessing PR feedback", { status: response.status });
      return noFeedback;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content.find((c) => c.type === "text")?.text?.trim() ?? "";

    try {
      const parsed = JSON.parse(text) as FeedbackAssessment;
      logger.log("PR feedback assessment complete", {
        repo,
        hasActionableFeedback: parsed.hasActionableFeedback,
        summary: parsed.feedbackSummary,
      });
      return parsed;
    } catch {
      logger.warn("Failed to parse feedback assessment JSON", { text: text.slice(0, 200) });
      return noFeedback;
    }
  } catch (error) {
    logger.error("Failed to assess PR feedback", { error });
    return noFeedback;
  }
}
