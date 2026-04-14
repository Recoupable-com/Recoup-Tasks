import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createContentPayloadSchema } from "../schemas/contentCreationSchema";
import { logStep } from "../sandboxes/logStep";
import { fetchGithubFile } from "../content/fetchGithubFile";
import { resolveFaceGuide } from "../content/resolveFaceGuide";
import { resolveAudioClip } from "../content/resolveAudioClip";
import { fetchArtistContext } from "../content/fetchArtistContext";
import { fetchAudienceContext } from "../content/fetchAudienceContext";
import { renderFinalVideo } from "../content/renderFinalVideo";
import { resolveBaseImage } from "../content/resolveBaseImage";
import { loadTemplate, buildMotionPrompt } from "../content/loadTemplate";
import {
  upscaleMedia,
  generateVideo,
} from "../recoup/contentApi";
import { resolveCaptionText } from "../content/resolveCaptionText";
import { resolveOverlayPosition } from "../content/resolveOverlayPosition";

/**
 * Content-creation task — full pipeline that generates a social-ready video.
 *
 * Pipeline steps:
 *   1. Load template (style guide, reference images, moods)
 *   2. Fetch face-guide from artist's GitHub repo
 *   3. Select audio clip (fetch songs, transcribe, analyze, pick best clip)
 *   4. Fetch artist + audience context for caption generation
 *   5. Generate image (via POST /api/content/image)
 *   6. Upscale image (via POST /api/content/upscale)
 *   7. Generate video (via POST /api/content/video)
 *   8. Upscale video (via POST /api/content/upscale)
 *   9. Generate caption (via POST /api/content/caption)
 *   10. Final render (ffmpeg — crop 16:9→9:16, overlay audio + caption)
 *
 * No Supabase access — API handles all storage.
 */
export const createContentTask = schemaTask({
  id: "create-content",
  schema: createContentPayloadSchema,
  maxDuration: 60 * 30,
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

    // --- Step 2: Resolve face-guide, editorial image, and classify attached images ---
    const { faceGuideUrl, editorialImageUrl, additionalImageUrls } = await resolveFaceGuide({
      usesFaceGuide: template.usesFaceGuide,
      usesEditorialImage: template.usesImageOverlay,
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

    // --- Steps 5–6: Resolve base image (editorial → use as-is, otherwise generate + optional upscale) ---
    const imageUrl = await resolveBaseImage({
      editorialImageUrl,
      faceGuideUrl,
      additionalImageUrls,
      template,
      upscale: payload.upscale,
    });

    // --- Step 6b: Resolve overlay position (AI-based, editorial templates only) ---
    const overlayPosition = template.usesImageOverlay && editorialImageUrl
      ? await resolveOverlayPosition(editorialImageUrl)
      : undefined;

    // --- Step 7: Generate video (API) ---
    const motionPrompt = buildMotionPrompt(template);
    let audioUrl: string | undefined;

    if (payload.lipsync) {
      logStep("Uploading audio for lipsync");
      const audioFile = new File([audioClip.songBuffer], "song.mp3", { type: "audio/mpeg" });
      audioUrl = await fal.storage.upload(audioFile);
    }

    logStep("Generating video via API");
    let videoUrl = await generateVideo({
      imageUrl,
      prompt: motionPrompt,
      audioUrl,
    });

    // --- Step 8: Upscale video (API, optional) ---
    if (payload.upscale) {
      logStep("Upscaling video via API");
      videoUrl = await upscaleMedia(videoUrl, "video");
    }

    // --- Step 9: Resolve caption text (skipped when captionLength === "none") ---
    logStep("Resolving caption", true, { captionLength: payload.captionLength });
    const captionTopic = [
      `Song: "${audioClip.songTitle}"`,
      audioClip.clipLyrics ? `Lyrics: "${audioClip.clipLyrics}"` : null,
      audioClip.clipMood ? `Mood: ${audioClip.clipMood}` : null,
      artistContext ? `Artist: ${artistContext}` : null,
      audienceContext ? `Audience: ${audienceContext}` : null,
    ].filter(Boolean).join(". ");

    const captionText = await resolveCaptionText({
      captionLength: payload.captionLength,
      topic: captionTopic,
      template: payload.template,
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
      overlayImageUrls: template.usesImageOverlay ? additionalImageUrls : undefined,
      overlayPosition,
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
