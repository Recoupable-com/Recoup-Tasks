import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the tasks worker.
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment variables.
 * These must be set in the Trigger.dev dashboard under Environment Variables.
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Set them in the Trigger.dev dashboard."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}
