export const NO_COMMIT_INSTRUCTION = "do not commit your changes.";

/**
 * Hotfix guardrail: ensure the `--message` value passed to `openclaw agent`
 * (or any tool that takes `--message <prompt>`) ends with the
 * {@link NO_COMMIT_INSTRUCTION} text. The task runs in a sandbox that is
 * git-aware, and we push sandbox changes to GitHub after the command — we
 * do NOT want the agent itself creating commits during the run.
 *
 * @param args - The `args` payload passed to `sandbox.runCommand`.
 * @returns A new args array with the instruction appended to the `--message`
 *   value if one is present and the instruction isn't already there.
 *   Otherwise the input is returned unchanged (as a copy).
 */
export function appendNoCommitInstruction(args: readonly string[]): string[] {
  const out = [...args];
  const messageIdx = out.indexOf("--message");
  if (messageIdx === -1) return out;

  const valueIdx = messageIdx + 1;
  if (valueIdx >= out.length) return out;

  const current = out[valueIdx];
  if (current.includes(NO_COMMIT_INSTRUCTION)) return out;

  out[valueIdx] = `${current} ${NO_COMMIT_INSTRUCTION}`;
  return out;
}
