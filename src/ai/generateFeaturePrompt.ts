import type { Sandbox } from "@vercel/sandbox";
import type { SubmoduleCommit } from "../github/fetchRecentSubmoduleCommits";
import { runClaudeCodeAgent } from "../sandboxes/runClaudeCodeAgent";
import { logStep } from "../sandboxes/logStep";
import { getFallbackPrompt } from "./getFallbackPrompt";

const SYSTEM_CONTEXT = `You are a senior software engineer on the Recoupable platform — a music industry management tool for record labels and artist managers.

The platform has these main components:
- chat: Next.js frontend where music managers chat with their AI agent
- api: Backend API (Next.js) with AI/MCP tools, Supabase DB, Slack bot integration
- tasks: Trigger.dev background jobs (pulse emails, content creation, coding agent)
- admin: Internal admin dashboard (Next.js)
- cli: Command-line interface for power users
- docs: API documentation (Mintlify)

Your task: analyze recent commits and propose the single most valuable small feature to implement next.

Rules:
- Pick something that builds naturally on recent work
- Keep it focused — a single, shippable improvement
- Favor real user value (music managers need to manage artists, track metrics, send communications)
- DO NOT suggest refactors, tests, or documentation updates

Respond with ONLY an implementation prompt for an AI coding agent. The prompt should:
- Say exactly what to build and in which submodule(s)
- Reference specific files/routes/components when relevant
- Include clear acceptance criteria
- NOT ask for planning or approval — just direct the agent to implement it`;

/**
 * Uses Claude Code in a sandbox to generate an actionable feature implementation prompt
 * based on the recent commit history across monorepo submodules.
 *
 * Falls back to a generic improvement prompt if the sandbox call fails.
 */
export async function generateFeaturePrompt(
  sandbox: Sandbox,
  recentCommits: SubmoduleCommit[],
): Promise<string> {
  const commitsContext = recentCommits
    .map(
      ({ submodule, commits }) =>
        `### ${submodule}\n${commits.map((c) => `- ${c.sha} ${c.message} (${c.date.slice(0, 10)})`).join("\n")}`,
    )
    .join("\n\n");

  const message = `${SYSTEM_CONTEXT}

Here are the most recent commits across the Recoupable monorepo:

${commitsContext}

Based on this recent work, write a specific implementation prompt for an AI coding agent to implement the next most valuable feature.`;

  try {
    const result = await runClaudeCodeAgent(sandbox, {
      label: "Generate feature prompt",
      message,
    });

    const text = result.stdout.trim();

    if (result.exitCode !== 0 || !text) {
      logStep("Claude Code failed to generate feature prompt", false, {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-500),
      });
      return getFallbackPrompt();
    }

    logStep("Generated Agent Day feature prompt", false, { preview: text.slice(0, 200) });
    return text;
  } catch (error) {
    logStep("Failed to generate feature prompt", false, { error: String(error) });
    return getFallbackPrompt();
  }
}
