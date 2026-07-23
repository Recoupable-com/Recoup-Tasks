export const NEW_API_BASE_URL = "https://recoup-api.vercel.app";
export const RECOUP_API_KEY = process.env.RECOUP_API_KEY;
export const CODING_AGENT_ACCOUNT_ID = "ccbed42f-4d91-4834-b954-2a64a77d8665";
export const OPENCLAW_DEFAULT_MODEL = "vercel-ai-gateway/anthropic/claude-sonnet-4.6";
// Scheduled customer tasks run headless with no user to catch a hallucinated report.
// Sonnet 5 was chosen because it respects the data-grounding rule (refuses to fabricate)
// where the prior default (haiku-4.5) did not — verified on the OneRPM/Apache benchmark
// (recoupable/chat#1833). Switching the default to Kimi K3 (cost/latency): its data-grounding
// behavior in headless runs has NOT yet been re-verified on that benchmark — re-run it before
// relying on this in production, and revert to anthropic/claude-sonnet-5 if it fabricates.
export const DEFAULT_TASK_MODEL = "moonshotai/kimi-k3";
