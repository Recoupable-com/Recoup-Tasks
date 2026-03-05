import { fal } from "@fal-ai/client";
import { logger, metadata, schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createContentPayloadSchema } from "../schemas/contentCreationSchema";
import { fetchGithubFile } from "../content/fetchGithubFile";
import { generateContentImage } from "../content/generateContentImage";
import { generateContentVideo } from "../content/generateContentVideo";
import { generateAudioVideo } from "../content/generateAudioVideo";
import { upscaleImage } from "../content/upscaleImage";
import { upscaleVideo } from "../content/upscaleVideo";
import { selectAudioClip } from "../content/selectAudioClip";
import {
  generateCaption,
  fetchArtistContext,
  fetchAudienceContext,
} from "../content/generateCaption";
import { renderFinalVideo } from "../content/renderFinalVideo";
import { DEFAULT_PIPELINE_CONFIG } from "../content/defaultPipelineConfig";
import {
  loadTemplate,
  buildImagePrompt,
  buildMotionPrompt,
} from "../content/loadTemplate";
import { DEFAULT_IMAGE_PROMPT } from "../content/contentPrompts";

/**
 * Content-creation task — full pipeline that generates a social-ready video.
 *
 * Pipeline steps:
 *   1. Load template (style guide, reference images, moods)
 *   2. Fetch face-guide from artist's GitHub repo
 *   3. Select audio clip (fetch songs, transcribe, analyze, pick best clip)
 *   4. Fetch artist + audience context for caption generation
 *   5. Generate image (fal.ai — face-guide + reference + styled prompt)
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
  retry: {
    maxAttempts: 0,
  },
  run: async payload => {
    await tags.add(`account:${payload.accountId}`);
    metadata.set("currentStep", "Starting content pipeline");
    metadata.set("accountId", payload.accountId);
    metadata.set("artistSlug", payload.artistSlug);
    metadata.set("template", payload.template);
    metadata.set("lipsync", payload.lipsync);

    logger.log("create-content task started", payload);

    // --- Configure fal.ai ---
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    // --- Step 1: Load template ---
    metadata.set("currentStep", "Loading template");
    const template = await loadTemplate(payload.template);

    // --- Step 2: Fetch face-guide ---
    metadata.set("currentStep", "Fetching face-guide");
    const faceGuideBuffer = await fetchGithubFile(
      payload.githubRepo,
      `artists/${payload.artistSlug}/context/images/face-guide.png`,
    );
    if (!faceGuideBuffer) {
      throw new Error(`face-guide.png not found for artist ${payload.artistSlug}`);
    }
    const faceGuideFile = new File([faceGuideBuffer], "face-guide.png", { type: "image/png" });
    const faceGuideUrl = await fal.storage.upload(faceGuideFile);

    // --- Step 3: Select audio clip ---
    metadata.set("currentStep", "Selecting audio clip");
    const audioClip = await selectAudioClip({
      githubRepo: payload.githubRepo,
      artistSlug: payload.artistSlug,
      clipDuration: DEFAULT_PIPELINE_CONFIG.clipDuration,
      lipsync: payload.lipsync,
    });

    // --- Step 4: Fetch artist/audience context ---
    metadata.set("currentStep", "Fetching artist context");
    const artistContext = await fetchArtistContext(
      payload.githubRepo, payload.artistSlug, fetchGithubFile,
    );
    const audienceContext = await fetchAudienceContext(
      payload.githubRepo, payload.artistSlug, fetchGithubFile,
    );

    // --- Step 5: Generate image ---
    metadata.set("currentStep", "Generating image");
    const fullPrompt = buildImagePrompt(DEFAULT_IMAGE_PROMPT, template.styleGuide);
    let imageUrl = await generateContentImage({
      faceGuideUrl,
      prompt: fullPrompt,
    });

    // --- Step 6: Upscale image ---
    metadata.set("currentStep", "Upscaling image");
    imageUrl = await upscaleImage(imageUrl);

    // --- Step 7: Generate video ---
    let videoUrl: string;
    const motionPrompt = buildMotionPrompt(template);

    if (payload.lipsync) {
      // Lipsync path: audio baked into video
      metadata.set("currentStep", "Generating audio-to-video (lipsync)");
      videoUrl = await generateAudioVideo({
        imageUrl,
        songBuffer: audioClip.songBuffer,
        audioStartSeconds: audioClip.startSeconds,
        audioDurationSeconds: audioClip.durationSeconds,
        motionPrompt,
      });
    } else {
      // Normal path: image-to-video, audio added in post
      metadata.set("currentStep", "Generating video");
      videoUrl = await generateContentVideo({
        imageUrl,
        motionPrompt,
      });
    }

    // --- Step 8: Upscale video ---
    metadata.set("currentStep", "Upscaling video");
    videoUrl = await upscaleVideo(videoUrl);

    // --- Step 9: Generate caption ---
    metadata.set("currentStep", "Generating caption");
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
    metadata.set("currentStep", "Rendering final video (ffmpeg)");
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
      videoSourceUrl: finalVideo.dataUrl,
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

    metadata.set("currentStep", "Complete");
    logger.log("create-content task completed", {
      sizeBytes: finalVideo.sizeBytes,
      songTitle: audioClip.songTitle,
      captionText: captionText.slice(0, 80),
    });
    return result;
  },
});
