import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { updateAccountSnapshot } from "../recoup/updateAccountSnapshot";

/**
 * Persists sandbox metadata (github_repo) via the API.
 *
 * With the Vercel Sandbox names feature, sandbox state persists automatically
 * by name — explicit snapshots are no longer required for sandbox resumption.
 *
 * @param _sandbox - The Vercel Sandbox instance (unused with name-based persistence)
 * @param accountId - The account ID to update
 * @param githubRepo - Optional GitHub repo URL to persist
 */
export async function snapshotAndPersist(
  _sandbox: Sandbox,
  accountId: string,
  githubRepo?: string
) {
  logger.log("Persisting sandbox metadata (names replace snapshots)", {
    accountId,
    githubRepo,
  });

  await updateAccountSnapshot(accountId, undefined, githubRepo);
}
