import { logger, schedules } from "@trigger.dev/sdk/v3";
import { fetchActivePulses } from "../recoup/fetchActivePulses";
import { executePulseInSandbox } from "../pulse/executePulseInSandbox";

const DEFAULT_PULSE_PROMPT = `You are sending a daily Pulse email. Your job is to surface what's MOST RELEVANT RIGHT NOW and deliver genuine value.

STEP 1: GATHER INITIAL CONTEXT
- Get conversations from the past 7 days (get_chats)
- Get the user's artists list (get_artists)
- Check what connections the user has (COMPOSIO_SEARCH_TOOLS) - e.g., Google Drive, Docs, Sheets

STEP 2: DETERMINE PRIORITY ARTISTS
Review the data you just gathered. An artist is HIGH PRIORITY if:

FROM CONVERSATIONS:
- They were discussed in recent conversations
- There was unfinished work mentioned about them
- The user asked questions about them or mentioned deadlines

FROM ARTIST DATA:
- They have a recent release (check release dates in artist data)

HIGHEST PRIORITY = Artist appears in BOTH recent conversations AND has recent activity.

STEP 3: GET DETAILS FOR PRIORITY ARTISTS ONLY
Now that you know which 1-3 artists matter most, get deeper data:
- Get their social stats (get_artist_socials) for those specific artists
- Look for any metric changes worth mentioning
- Search for a relevant image of the priority artist (google_images) to include in the email

DON'T get stats for every artist - only the priority ones.

STEP 3B: CHECK CONNECTED SERVICES (if available)
If the user has Google Drive/Docs/Sheets connected:
- Use COMPOSIO_MULTI_EXECUTE_TOOL to check their most recent documents
- Look for documents related to their priority artists (e.g., marketing plans, release schedules, strategy docs)
- ONLY surface insights if the document is RELEVANT to current priorities
- Don't just list documents - extract specific, actionable insights from them

Example: If they have a "Q1 Release Schedule" doc and an artist has an upcoming release, mention it.

STEP 4: ACT ON TOP 1-3 PRIORITIES
For each priority item, do ONE of:
a) Report on real data (streaming stats, social metrics) - only if you have actual numbers
b) Complete unfinished work from a conversation (research, draft, analysis)
c) Surface a specific, actionable insight

FALLBACK: If no priority artists or conversations exist, search for recent music industry news (search_web) relevant to the user's genre or market. Always deliver something valuable - never send an empty or "all quiet" email.

STEP 5: FORMAT THE EMAIL

Use this HTML structure for consistency. IMPORTANT: Only include elements when you have real data for them.

<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
    [Personal greeting using their name if available. One sentence context setter.]
  </p>

  <!-- ONLY include this image block if you successfully found an artist image via google_images. 
       If no image was found, OMIT this entire img tag - do not include placeholder or broken images. -->
  <img src="[ACTUAL_IMAGE_URL]" alt="[Artist Name]" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin-bottom: 24px;" />

  <div style="background: #f8f9fa; border-left: 4px solid #345A5D; padding: 16px 20px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #345A5D; letter-spacing: 0.5px;">
      [Section Title - e.g., "Release Update" or "From Your Conversations"]
    </h3>
    <p style="margin: 0; font-size: 15px; line-height: 1.5;">
      [Specific insight or update. Include numbers if you have them.]
    </p>
    <!-- ONLY include this link if there's a relevant chat to link to.
         If no chat_link exists for this section, OMIT this entire anchor tag. -->
    <a href="[ACTUAL_CHAT_URL]" style="display: inline-block; margin-top: 12px; color: #345A5D; font-size: 14px;">
      Continue this conversation →
    </a>
  </div>

  <!-- Repeat section block for additional items (max 3) -->

  <p style="font-size: 14px; color: #666; margin-top: 32px;">
    — Recoup
  </p>

</div>

CONDITIONAL ELEMENTS RULE:
- Image block: ONLY include if you have a real image URL from google_images. No placeholders.
- Chat link: ONLY include if the insight came from a specific conversation you can link to. No dead links.
- If you don't have the data, simply omit the element entirely - don't render empty containers.

SUBJECT LINE:
- Be specific to content, not generic
- Good: "Luna's release is up 23% this week"
- Good: "Following up on your playlist strategy"
- Bad: "Your Daily Pulse"
- Bad: "Updates from Recoup"

NEVER DO THIS:
- List every artist or every conversation
- Generic summaries with no specific insight
- Vague phrases like "stay on top of" or "keep momentum"
- Pretend to have data you don't have
- Send walls of text - keep it scannable

Use send_email with the html parameter to deliver.`;

/**
 * Scheduled task that sends pulses to all accounts with active pulse subscriptions.
 * Runs daily and generates personalized pulse content for each active account.
 */
export const sendPulsesTask = schedules.task({
  id: "send-pulses-task",
  cron: { pattern: "0 9 * * *", timezone: "America/New_York" }, // Run daily at 9 AM ET
  run: async (payload) => {
    logger.log("Starting send pulses task", {
      timestamp: payload.timestamp,
      timezone: payload.timezone,
      externalId: payload.externalId,
    });

    // If externalId is provided, only process that specific account (for testing)
    // Otherwise, fetch all active pulses
    let accountIds: string[];

    if (payload.externalId) {
      logger.log("Test mode: processing single account", { accountId: payload.externalId });
      accountIds = [payload.externalId];
    } else {
      const activePulses = await fetchActivePulses();

      if (activePulses.length === 0) {
        logger.log("No active pulses found, skipping");
        return { sent: 0, failed: 0 };
      }

      logger.log("Processing active pulses", { count: activePulses.length });
      accountIds = activePulses.map((pulse) => pulse.account_id);
    }

    let sent = 0;
    let failed = 0;

    for (const accountId of accountIds) {
      logger.log("Processing pulse for account", { accountId });

      try {
        const result = await executePulseInSandbox({
          accountId,
          prompt: DEFAULT_PULSE_PROMPT,
        });

        if (result) {
          sent++;
        } else {
          logger.error("Failed to execute pulse in sandbox", { accountId });
          failed++;
        }
      } catch (error) {
        logger.error("Exception while processing pulse", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    logger.log("Send pulses task completed", { sent, failed });

    return { sent, failed };
  },
});
