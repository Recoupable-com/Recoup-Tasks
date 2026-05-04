import { Sandbox } from "@vercel/sandbox";
import { createAccountSandbox } from "../recoup/createAccountSandbox";
import { getVercelSandboxCredentials } from "./getVercelSandboxCredentials";
import { logStep } from "./logStep";

interface GetOrCreateSandboxResult {
  sandboxId: string;
  sandbox: Sandbox;
}

/**
 * Creates a sandbox for an account via POST /api/sandboxes
 * (which handles snapshot restoration internally) and connects to it.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The sandbox ID and connected Sandbox instance
 */
export async function getOrCreateSandbox(
  accountId: string,
): Promise<GetOrCreateSandboxResult> {
  const { token, teamId, projectId } = getVercelSandboxCredentials();

  logStep("Creating sandbox via API");

  const created = await createAccountSandbox(accountId);
  if (!created) {
    throw new Error(`Failed to create sandbox for account ${accountId}`);
  }

  const sandbox = await Sandbox.get({
    name: created.sandboxId,
    token,
    teamId,
    projectId,
  });

  logStep("Sandbox ready", true, { sandboxId: created.sandboxId });

  return { sandboxId: created.sandboxId, sandbox };
}
