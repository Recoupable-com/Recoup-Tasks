import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { updateAccountSnapshot } from "../recoup/updateAccountSnapshot";

/**
 * Takes a sandbox snapshot and persists the snapshotId (and optional
 * github_repo) via the API.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID to update
 * @param githubRepo - Optional GitHub repo URL to persist alongside the snapshot
 * @returns The snapshot result with snapshotId and expiresAt
 */
export async function snapshotAndPersist(
  sandbox: Sandbox,
  accountId: string,
  githubRepo?: string
) {
  logger.log("Taking sandbox snapshot");
  const snapshotResult = await sandbox.snapshot();

  logger.log("Snapshot created", {
    snapshotId: snapshotResult.snapshotId,
    expiresAt: snapshotResult.expiresAt,
  });

  await updateAccountSnapshot(accountId, snapshotResult.snapshotId, githubRepo);

  return snapshotResult;
}
