import { logger, schedules, wait } from "@trigger.dev/sdk/v3";
import { codingAgentTask } from "./codingAgentTask";
import { updatePRTask } from "./updatePRTask";
import { fetchRecentSubmoduleCommits } from "../github/fetchRecentSubmoduleCommits";
import { generateFeaturePrompt } from "../ai/generateFeaturePrompt";
import { waitForPRChecks } from "../github/waitForPRChecks";
import { fetchPRReviews } from "../github/fetchPRReviews";
import { assessPRFeedback } from "../ai/assessPRFeedback";
import { getVercelPreviewUrl } from "../github/getVercelPreviewUrl";
import { mergePR } from "../github/mergePR";
import { postToSlackChannel } from "../slack/postToSlackChannel";
import { logStep } from "../sandboxes/logStep";

const AGENT_DAY_SLACK_CHANNEL = "C08HN8RKJHZ";
const MAX_REVIEW_ITERATIONS = 3;
const PR_CHECK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Scheduled task that runs every Sunday at 10 AM ET and autonomously
 * implements a new feature end-to-end:
 *
 * 1. Gathers recent commits across all submodules
 * 2. Uses Claude to plan a focused feature based on recent work
 * 3. Triggers the coding-agent task to implement it and open PRs
 * 4. Reviews each PR: waits for checks, assesses human feedback, applies fixes
 * 5. Tests Vercel preview deployments (api/chat repos)
 * 6. Merges approved PRs
 * 7. Posts a summary to the #dev Slack channel
 */
export const agentDayTask = schedules.task({
  id: "agent-day",
  cron: { pattern: "0 10 * * 0", timezone: "America/New_York" }, // 10 AM ET every Sunday
  maxDuration: 60 * 120, // 2 hours
  run: async (payload) => {
    logStep("Agent Day task started", true, {
      timestamp: payload.timestamp,
      date: new Date(payload.timestamp).toDateString(),
    });

    // Step 1: Gather recent commits to understand what has been built recently
    logStep("Fetching recent commits from all submodules");
    const recentCommits = await fetchRecentSubmoduleCommits();
    logStep("Recent commits fetched", true, { submoduleCount: recentCommits.length });

    // Step 2: Use Claude to plan the next feature based on recent work
    logStep("Generating feature prompt from recent commits");
    const featurePrompt = await generateFeaturePrompt(recentCommits);
    logStep("Feature prompt generated", true, { preview: featurePrompt.slice(0, 300) });

    // Step 3 & 4: Trigger the coding agent to implement the feature and open PRs
    logStep("Triggering coding agent");
    const codingResult = await codingAgentTask.triggerAndWait({ prompt: featurePrompt });

    if (!codingResult.ok) {
      logger.error("Coding agent task failed", { error: codingResult.error });
      await postToSlackChannel(
        AGENT_DAY_SLACK_CHANNEL,
        `🤖 *Agent Day — ${new Date(payload.timestamp).toDateString()}*\n\nCoding agent failed. Check Trigger.dev for details.`,
      );
      return { success: false, error: "Coding agent failed" };
    }

    const { branch, snapshotId, prs } = codingResult.output;
    logStep("Coding agent completed", true, { branch, prCount: prs.length, prs });

    if (prs.length === 0) {
      await postToSlackChannel(
        AGENT_DAY_SLACK_CHANNEL,
        `🤖 *Agent Day — ${new Date(payload.timestamp).toDateString()}*\n\nNo changes were made — the agent found nothing to implement.`,
      );
      return { success: true, prs: [], featurePrompt };
    }

    // Step 5: Review each PR — wait for checks, implement feedback, test preview
    const mergedPRs: typeof prs = [];
    let currentSnapshotId = snapshotId;

    for (const pr of prs) {
      logStep(`Reviewing PR #${pr.number} in ${pr.repo}`);

      // Step 5a: Wait for all CI checks to complete
      logStep(`Waiting for checks on PR #${pr.number}`);
      const checkResult = await waitForPRChecks(pr.repo, pr.number, PR_CHECK_TIMEOUT_MS);
      logStep(`Checks complete for PR #${pr.number}`, true, {
        allPassed: checkResult.allPassed,
        failedChecks: checkResult.failedChecks,
      });

      let reviewSnapshotId = currentSnapshotId;

      // Step 5b-5c: PR review loop — assess feedback and implement if needed
      for (let iteration = 0; iteration < MAX_REVIEW_ITERATIONS; iteration++) {
        logStep(`Review iteration ${iteration + 1} for PR #${pr.number}`);

        const feedback = await fetchPRReviews(pr.repo, pr.number);
        const assessment = await assessPRFeedback(pr.repo, featurePrompt, feedback);

        logStep(`Feedback assessed for PR #${pr.number}`, true, {
          hasActionableFeedback: assessment.hasActionableFeedback,
          summary: assessment.feedbackSummary,
        });

        if (!assessment.hasActionableFeedback) {
          break; // Nothing to address — move on
        }

        // Step 5c: Apply the feedback via the update-pr task
        logStep(`Applying feedback for PR #${pr.number}: ${assessment.feedbackSummary}`);
        const updateResult = await updatePRTask.triggerAndWait({
          feedback: assessment.implementation,
          snapshotId: reviewSnapshotId,
          branch,
          repo: pr.repo,
        });

        if (!updateResult.ok) {
          logger.warn(`Failed to apply feedback for PR #${pr.number}`, {
            error: updateResult.error,
          });
          break;
        }

        reviewSnapshotId = updateResult.output.snapshotId;
        currentSnapshotId = reviewSnapshotId;

        // Wait for the new commit to be picked up by CI before re-checking
        await wait.for({ seconds: 30 });
      }

      // Step 5d: Test Vercel preview deployment for api and chat repos
      if (pr.repo === "recoupable/api" || pr.repo === "recoupable/chat") {
        const previewUrl = await getVercelPreviewUrl(pr.repo, pr.number);

        if (previewUrl) {
          logStep(`Testing Vercel preview for PR #${pr.number}`, true, { previewUrl });
          try {
            const healthRes = await fetch(`${previewUrl}/api/health`, {
              signal: AbortSignal.timeout(10_000),
            });
            logStep(`Preview health check for PR #${pr.number}`, true, {
              url: `${previewUrl}/api/health`,
              status: healthRes.status,
            });
          } catch (error) {
            logger.warn(`Preview health check failed for PR #${pr.number}`, { error });
          }
        } else {
          logStep(`No Vercel preview URL found for PR #${pr.number}`);
        }
      }

      // Step 6: Merge the PR
      logStep(`Merging PR #${pr.number} in ${pr.repo}`);
      const merged = await mergePR(pr.repo, pr.number);

      if (merged) {
        mergedPRs.push(pr);
        logStep(`Merged PR #${pr.number}`, true, { url: pr.url });
      } else {
        logger.warn(`Could not merge PR #${pr.number} in ${pr.repo}`);
      }
    }

    // Step 7: Post summary to Slack
    const date = new Date(payload.timestamp).toDateString();
    const prLines = mergedPRs.map((pr) => `• <${pr.url}|${pr.repo} #${pr.number}>`).join("\n");
    const unmergedCount = prs.length - mergedPRs.length;

    const slackLines = [
      `🤖 *Agent Day — ${date}*`,
      ``,
      `Implemented and merged *${mergedPRs.length}* PR${mergedPRs.length !== 1 ? "s" : ""}:`,
      prLines || "_(none)_",
      unmergedCount > 0 ? `\n_${unmergedCount} PR(s) could not be merged automatically._` : "",
      ``,
      `*Feature:* ${featurePrompt.slice(0, 280)}${featurePrompt.length > 280 ? "…" : ""}`,
    ];

    await postToSlackChannel(AGENT_DAY_SLACK_CHANNEL, slackLines.filter(Boolean).join("\n"));

    logStep("Agent Day task completed", true, {
      mergedPRs: mergedPRs.length,
      totalPRs: prs.length,
    });

    return { success: true, prs: mergedPRs, featurePrompt };
  },
});
