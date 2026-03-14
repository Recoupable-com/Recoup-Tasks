import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const orgSchema = z.object({
  organization_id: z.string(),
  organization_name: z.string().nullable(),
});

const orgsResponseSchema = z.object({
  status: z.literal("success"),
  organizations: z.array(orgSchema),
});

export interface OrgInfo {
  organizationId: string;
  organizationName: string;
}

/**
 * Fetches organizations for an account via GET /api/organizations?account_id={id}.
 *
 * @param accountId - The account ID to look up orgs for
 * @returns Array of org id/name pairs, or undefined on error
 */
export async function getAccountOrgs(accountId: string): Promise<OrgInfo[] | undefined> {
  const url = `${NEW_API_BASE_URL}/api/organizations?account_id=${encodeURIComponent(accountId)}`;

  logger.log("Fetching account organizations", { accountId, url });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to fetch account organizations", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = orgsResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid organizations response", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    const orgs = validation.data.organizations
      .filter(org => org.organization_id && org.organization_name)
      .map(org => ({
        organizationId: org.organization_id,
        organizationName: org.organization_name!,
      }));

    logger.log("Account organizations fetched", {
      accountId,
      count: orgs.length,
    });

    return orgs;
  } catch (error) {
    logger.error("Error fetching account organizations", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
