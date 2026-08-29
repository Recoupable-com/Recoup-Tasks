import type { Sandbox } from "@vercel/sandbox";
import type { PRFeedback } from "../github/fetchPRReviews";
import { runClaudeCodeAgent } from "../sandboxes/runClaudeCodeAgent";
import { logStep } from "../sandboxes/logStep";

export interface FeedbackAssessment {
  hasActionableFeedback: boolean;
  feedbackSummary: string;
  implementation: string;
}

/**
 * Uses Claude Code in a sandbox to assess PR review feedback and determine
 * whether any changes should be implemented by the coding agent.
 *
 * Ignores automated bot comments and approvals without substantive feedback.
 * Returns a structured assessment with what (if anything) should be changed.
 */
export async function assessPRFeedback(
  sandbox: Sandbox,
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

  const reviewsText = feedback.reviews
    .map((r) => `Review by ${r.author} (${r.state}): ${r.body}`)
    .join("\n");

  const commentsText = feedback.comments
    .map((c) => `Comment by ${c.author} on ${c.path}: ${c.body}`)
    .join("\n");

  const feedbackText = [reviewsText, commentsText].filter(Boolean).join("\n\n");

  const message = [
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
  ].join("\n");

  try {
    const result = await runClaudeCodeAgent(sandbox, {
      label: `Assess PR feedback for ${repo}`,
      message,
    });

    if (result.exitCode !== 0) {
      logStep("Claude Code failed to assess PR feedback", false, {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-500),
      });
      return noFeedback;
    }

    const text = result.stdout.trim();

    try {
      const parsed = JSON.parse(text) as FeedbackAssessment;
      logStep("PR feedback assessment complete", false, {
        repo,
        hasActionableFeedback: parsed.hasActionableFeedback,
        summary: parsed.feedbackSummary,
      });
      return parsed;
    } catch {
      logStep("Failed to parse feedback assessment JSON", false, { text: text.slice(0, 200) });
      return noFeedback;
    }
  } catch (error) {
    logStep("Failed to assess PR feedback", false, { error: String(error) });
    return noFeedback;
  }
}
