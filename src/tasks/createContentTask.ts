import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createContentPayloadSchema } from "../schemas/contentCreationSchema";
import { logStep } from "../sandboxes/logStep";
import { fetchGithubFile } from "../content/fetchGithubFile";
import { generateContentImage } from "../content/generateContentImage";
import { generateContentVideo } from "../content/generateContentVideo";
import { generateAudioVideo } from "../content/generateAudioVideo";
import { upscaleImage } from "../content/upscaleImage";
import { upscaleVideo } from "../content/upscaleVideo";
import { resolveFaceGuide } from "../content/resolveFaceGuide";
import { resolveAudioClip } from "../content/resolveAudioClip";
import { generateCaption } from "../content/generateCaption";
import { fetchArtistContext } from "../content/fetchArtistContext";
import { fetchAudienceContext } from "../content/fetchAudienceContext";
import { renderFinalVideo } from "../content/renderFinalVideo";
import {
  loadTemplate,
  pickRandomReferenceImage,
  buildImagePrompt,
  buildMotionPrompt,
} from "../content/loadTemplate";
import { FACE_SWAP_INSTRUCTION, NO_FACE_INSTRUCTION } from "../content/contentPrompts";

/**
 * Content-creation task — full pipeline that generates a social-ready video.
 *
 * Pipeline steps:
 *   1. Load template (style guide, reference images, moods)
 *   2. Fetch face-guide from artist's GitHub repo
 *   3. Select audio clip (fetch songs, transcribe, analyze, pick best clip)
 *   4. Fetch artist + audience context for caption generation
 *   5. Generate image (fal.ai — face-guide + template prompt + style guide)
 *   6. Upscale image (fal.ai — 2x detail enhancement)
 *   7. Generate video (fal.ai — animate image, or audio-to-video for lipsync)
 *   8. Upscale video (fal.ai — 720p → 1080p)
 *   9. Generate caption (Recoup Chat API — TikTok-style text)
 *   10. Final render (ffmpeg — crop 16:9→9:16, overlay audio + caption)
 *   11. Return final video for API to persist
 *
 * No Supabase access — API handles all storage.
 */
export const createContentTask = schemaTask({
  id: "create-content",
  schema: createContentPayloadSchema,
  maxDuration: 60 * 10,
  machine: "medium-1x",
  retry: {
    maxAttempts: 0,
  },
  run: async payload => {
    await tags.add(`account:${payload.accountId}`);

    logStep("create-content task started", true, {
      accountId: payload.accountId,
      artistSlug: payload.artistSlug,
      template: payload.template,
      lipsync: payload.lipsync,
      captionLength: payload.captionLength,
      upscale: payload.upscale,
    });

    // --- Configure fal.ai ---
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    // --- Step 1: Load template ---
    logStep("Loading template");
    const template = await loadTemplate(payload.template);

    // --- Step 2: Fetch face-guide (only if template uses it) ---
    const faceGuideUrl = await resolveFaceGuide({
      usesFaceGuide: template.usesFaceGuide,
      images: payload.images,
      githubRepo: payload.githubRepo,
      artistSlug: payload.artistSlug,
    });

    // --- Step 3: Select audio clip ---
    const audioClip = await resolveAudioClip(payload);

    // --- Step 4: Fetch artist/audience context ---
    logStep("Fetching artist context");
    const artistContext = await fetchArtistContext(
      payload.githubRepo, payload.artistSlug, fetchGithubFile,
    );
    const audienceContext = await fetchAudienceContext(
      payload.githubRepo, payload.artistSlug, fetchGithubFile,
    );

    // --- Step 5: Generate image ---
    logStep("Generating image");
    const referenceImagePath = pickRandomReferenceImage(template);
    // Build prompt: face-swap instruction (if needed) + template scene + style guide
    const instruction = template.usesFaceGuide ? FACE_SWAP_INSTRUCTION : NO_FACE_INSTRUCTION;
    const basePrompt = `${instruction} ${template.imagePrompt}`;
    const fullPrompt = buildImagePrompt(basePrompt, template.styleGuide);
    let imageUrl = await generateContentImage({
      faceGuideUrl: faceGuideUrl ?? undefined,
      referenceImagePath,
      prompt: fullPrompt,
    });

    // --- Step 6: Upscale image (optional) ---
    if (payload.upscale) {
      logStep("Upscaling image");
      imageUrl = await upscaleImage(imageUrl);
    }

    // --- Step 7: Generate video ---
    let videoUrl: string;
    const motionPrompt = buildMotionPrompt(template);

    if (payload.lipsync) {
      // Lipsync path: audio baked into video
      logStep("Generating audio-to-video (lipsync)");
      videoUrl = await generateAudioVideo({
        imageUrl,
        songBuffer: audioClip.songBuffer,
        audioStartSeconds: audioClip.startSeconds,
        audioDurationSeconds: audioClip.durationSeconds,
        motionPrompt,
      });
    } else {
      // Normal path: image-to-video, audio added in post
      logStep("Generating video");
      videoUrl = await generateContentVideo({
        imageUrl,
        motionPrompt,
      });
    }

    // --- Step 8: Upscale video (optional) ---
    if (payload.upscale) {
      logStep("Upscaling video");
      videoUrl = await upscaleVideo(videoUrl);
    }

    // --- Step 9: Generate caption ---
    logStep("Generating caption");
    const captionText = await generateCaption({
      template,
      songTitle: audioClip.songTitle,
      fullLyrics: audioClip.lyrics.fullLyrics,
      clipLyrics: audioClip.clipLyrics,
      artistContext,
      audienceContext,
      captionLength: payload.captionLength,
    });

    // --- Step 10: Final render (ffmpeg) ---
    logStep("Rendering final video (ffmpeg)");
    const finalVideo = await renderFinalVideo({
      videoUrl,
      songBuffer: audioClip.songBuffer,
      audioStartSeconds: audioClip.startSeconds,
      audioDurationSeconds: audioClip.durationSeconds,
      captionText,
      hasAudio: payload.lipsync,
    });

    // --- Return result ---
    const result = {
      status: "completed",
      accountId: payload.accountId,
      artistSlug: payload.artistSlug,
      template: payload.template,
      lipsync: payload.lipsync,
      videoSourceUrl: finalVideo.videoUrl,
      renderedVideoBytes: finalVideo.sizeBytes,
      imageUrl,
      video: null,
      audio: {
        songTitle: audioClip.songTitle,
        songFilename: audioClip.songFilename,
        startSeconds: audioClip.startSeconds,
        durationSeconds: audioClip.durationSeconds,
        clipLyrics: audioClip.clipLyrics,
        clipMood: audioClip.clipMood,
      },
      captionText,
      message: "Full content pipeline complete — AI image + video + audio + caption",
    };

    logStep("Complete", true, {
      sizeBytes: finalVideo.sizeBytes,
      songTitle: audioClip.songTitle,
      captionText: captionText.slice(0, 80),
    });
    return result;
  },
});
