import { logger } from "@trigger.dev/sdk/v3";
import { getSupabaseClient } from "./supabaseClient";
import * as fs from "node:fs";

/** The Supabase storage bucket for user files (matches api/lib/const.ts) */
const SUPABASE_STORAGE_BUCKET = "user-files";

interface UploadResult {
  /** Signed URL of the uploaded video (expires in 7 days) */
  videoUrl: string;
  /** Storage key (path within the bucket) — use this to create a new signed URL later */
  storageKey: string;
}

/**
 * Uploads a rendered video file to Supabase Storage.
 *
 * The file is stored at: renders/<accountId>/<compositionId>/<timestamp>.mp4
 *
 * @param filePath - Local path to the rendered .mp4 file
 * @param accountId - The account that owns this render
 * @param compositionId - The Remotion composition that was rendered
 * @returns The public URL and storage key of the uploaded video
 */
export async function uploadRenderedVideo(
  filePath: string,
  accountId: string,
  compositionId: string
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const storageKey = `renders/${accountId}/${compositionId}/${timestamp}.mp4`;

  logger.log("Uploading rendered video to Supabase", {
    storageKey,
    filePath,
  });

  // Read the file as a Uint8Array (avoids Buffer/Blob type mismatch)
  const fileBuffer = fs.readFileSync(filePath);
  const fileData = new Uint8Array(fileBuffer);

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storageKey, fileData, {
      contentType: "video/mp4",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload video to Supabase: ${error.message}`);
  }

  // Create a signed URL (bucket is private, so public URLs won't work)
  // 7 days expiry — callers can refresh via the API if needed
  const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Upload succeeded but failed to create signed URL: ${signedUrlError?.message ?? "unknown error"}`
    );
  }

  logger.log("Video uploaded successfully", {
    storageKey,
    signedUrl: signedUrlData.signedUrl,
  });

  return {
    videoUrl: signedUrlData.signedUrl,
    storageKey,
  };
}
