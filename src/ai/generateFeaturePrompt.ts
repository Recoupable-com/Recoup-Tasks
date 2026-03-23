import { logger } from "@trigger.dev/sdk/v3";
import type { SubmoduleCommit } from "../github/fetchRecentSubmoduleCommits";

const SYSTEM_PROMPT = `You are a senior software engineer on the Recoupable platform — a music industry management tool for record labels and artist managers.

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
 * Uses the Anthropic API to generate an actionable feature implementation prompt
 * based on the recent commit history across monorepo submodules.
 *
 * Falls back to a generic improvement prompt if the API call fails.
 */
export async function generateFeaturePrompt(
  recentCommits: SubmoduleCommit[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn("Missing ANTHROPIC_API_KEY — using fallback feature prompt");
    return getFallbackPrompt();
  }

  const commitsContext = recentCommits
    .map(
      ({ submodule, commits }) =>
        `### ${submodule}\n${commits.map((c) => `- ${c.sha} ${c.message} (${c.date.slice(0, 10)})`).join("\n")}`,
    )
    .join("\n\n");

  const userMessage = `Here are the most recent commits across the Recoupable monorepo:

${commitsContext}

Based on this recent work, write a specific implementation prompt for an AI coding agent to implement the next most valuable feature.`;

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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      logger.error("Anthropic API error generating feature prompt", { status: response.status });
      return getFallbackPrompt();
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content.find((c) => c.type === "text")?.text?.trim();

    if (!text) {
      logger.warn("Empty response from Anthropic API");
      return getFallbackPrompt();
    }

    logger.log("Generated Agent Day feature prompt", { preview: text.slice(0, 200) });
    return text;
  } catch (error) {
    logger.error("Failed to generate feature prompt", { error });
    return getFallbackPrompt();
  }
}

function getFallbackPrompt(): string {
  return [
    "Read PROGRESS_USAGE.md and PROGRESS.md in the mono repo codebase first.",
    "",
    "Review the last 10 commits across the api, chat, admin, and tasks submodules.",
    "Identify the single most impactful small improvement that builds on recent work",
    "— a bug fix, a missing endpoint, a UI polish, or a small new feature.",
    "",
    "Implement it end-to-end (API route + frontend if needed), write any relevant tests,",
    "then update PROGRESS.md with what you built.",
  ].join("\n");
}
