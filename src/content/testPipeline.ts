#!/usr/bin/env npx tsx
/**
 * Local pipeline tester — run individual steps without Trigger.dev.
 *
 * Usage:
 *   npx tsx src/content/testPipeline.ts image         # test image generation only
 *   npx tsx src/content/testPipeline.ts video         # test video from saved image
 *   npx tsx src/content/testPipeline.ts upscale-image # test image upscale
 *   npx tsx src/content/testPipeline.ts upscale-video # test video upscale
 *   npx tsx src/content/testPipeline.ts audio         # test audio selection
 *   npx tsx src/content/testPipeline.ts caption       # test caption generation
 *   npx tsx src/content/testPipeline.ts render        # test ffmpeg final render
 *   npx tsx src/content/testPipeline.ts render-only   # test ffmpeg with a sample video URL
 *
 * Each step saves its output to .pipeline-state.json so the next step can use it.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fal } from "@fal-ai/client";
import dotenv from "dotenv";

// Load env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const STATE_FILE = path.resolve(process.cwd(), ".pipeline-state.json");
const GITHUB_REPO =
  "https://github.com/recoupable/sidney-swift-1ca89eeb-14ab-4a4a-a1c5-2dd41663c039";
const ARTIST_SLUG = "gatsby-grace";
const TEMPLATE_NAME = "artist-caption-bedroom";

// --- State management ---
interface PipelineState {
  faceGuideUrl?: string;
  referenceImageUrl?: string;
  imageUrl?: string;
  upscaledImageUrl?: string;
  videoUrl?: string;
  upscaledVideoUrl?: string;
  songBuffer?: string; // base64
  songTitle?: string;
  audioStartSeconds?: number;
  clipLyrics?: string;
  fullLyrics?: string;
  captionText?: string;
  finalVideoPath?: string;
}

/**
 *
 */
async function loadState(): Promise<PipelineState> {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

/**
 *
 * @param state
 */
async function saveState(state: PipelineState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`  💾 State saved to ${STATE_FILE}`);
}

// --- Configure fal ---
/**
 *
 */
function setupFal(): void {
  if (!process.env.FAL_KEY) {
    console.error("❌ FAL_KEY not set in .env.local");
    process.exit(1);
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

// --- Steps ---

/**
 *
 */
async function testImage(): Promise<void> {
  setupFal();
  const { fetchGithubFile } = await import("./fetchGithubFile.js");
  const { generateContentImage } = await import("./generateContentImage.js");
  const { loadTemplate, pickRandomReferenceImage, buildImagePrompt } = await import(
    "./loadTemplate.js"
  );
  const { FACE_SWAP_INSTRUCTION } = await import("./contentPrompts.js");

  console.log("\n🎨 Testing: Image Generation\n");

  const template = await loadTemplate(TEMPLATE_NAME);
  console.log(`  Template: ${template.name}`);

  // Fetch face-guide
  console.log("  Fetching face-guide...");
  const faceGuideBuffer = await fetchGithubFile(
    GITHUB_REPO,
    `artists/${ARTIST_SLUG}/context/images/face-guide.png`,
  );
  if (!faceGuideBuffer) throw new Error("face-guide.png not found");
  const faceGuideFile = new File([faceGuideBuffer], "face-guide.png", { type: "image/png" });
  const faceGuideUrl = await fal.storage.upload(faceGuideFile);
  console.log(`  ✅ Face-guide uploaded: ${faceGuideUrl.slice(0, 60)}...`);

  // Pick reference image
  const refPath = pickRandomReferenceImage(template);
  console.log(`  Reference: ${refPath ? path.basename(refPath) : "none"}`);

  // Generate image — face-swap instruction + template's scene prompt + style guide
  const basePrompt = `${FACE_SWAP_INSTRUCTION} ${template.imagePrompt}`;
  const prompt = buildImagePrompt(basePrompt, template.styleGuide);
  console.log(`  Prompt: "${prompt.slice(0, 80)}..."`);
  console.log("  🔄 Generating image...\n");

  const imageUrl = await generateContentImage({
    faceGuideUrl,
    referenceImagePath: refPath,
    prompt,
  });

  console.log(`\n  ✅ Image generated!`);
  console.log(`  🔗 ${imageUrl}`);

  const state = await loadState();
  await saveState({ ...state, faceGuideUrl, imageUrl });
}

/**
 *
 */
async function testVideo(): Promise<void> {
  setupFal();
  const { generateContentVideo } = await import("./generateContentVideo.js");
  const { loadTemplate, buildMotionPrompt } = await import("./loadTemplate.js");

  const state = await loadState();
  const imageUrl = state.upscaledImageUrl ?? state.imageUrl;
  if (!imageUrl) {
    console.error("❌ No image URL in state. Run: image first");
    process.exit(1);
  }

  console.log("\n🎬 Testing: Video Generation\n");
  console.log(`  Image: ${imageUrl.slice(0, 60)}...`);

  const template = await loadTemplate(TEMPLATE_NAME);
  const motionPrompt = buildMotionPrompt(template);
  console.log(`  Motion: "${motionPrompt.slice(0, 80)}..."`);
  console.log("  🔄 Generating video (2-5 min)...\n");

  const videoUrl = await generateContentVideo({ imageUrl, motionPrompt });

  console.log(`\n  ✅ Video generated!`);
  console.log(`  🔗 ${videoUrl}`);

  await saveState({ ...state, videoUrl });
}

/**
 *
 */
async function testUpscaleImage(): Promise<void> {
  setupFal();
  const { upscaleImage } = await import("./upscaleImage.js");

  const state = await loadState();
  if (!state.imageUrl) {
    console.error("❌ No image URL in state. Run: image first");
    process.exit(1);
  }

  console.log("\n🔍 Testing: Image Upscale\n");
  console.log(`  Input: ${state.imageUrl.slice(0, 60)}...`);
  console.log("  🔄 Upscaling...\n");

  const upscaledImageUrl = await upscaleImage(state.imageUrl);

  console.log(`\n  ✅ Upscaled!`);
  console.log(`  🔗 ${upscaledImageUrl}`);

  await saveState({ ...state, upscaledImageUrl });
}

/**
 *
 */
async function testUpscaleVideo(): Promise<void> {
  setupFal();
  const { upscaleVideo } = await import("./upscaleVideo.js");

  const state = await loadState();
  if (!state.videoUrl) {
    console.error("❌ No video URL in state. Run: video first");
    process.exit(1);
  }

  console.log("\n🔍 Testing: Video Upscale\n");
  console.log(`  Input: ${state.videoUrl.slice(0, 60)}...`);
  console.log("  🔄 Upscaling (this takes a while)...\n");

  const upscaledVideoUrl = await upscaleVideo(state.videoUrl);

  console.log(`\n  ✅ Upscaled!`);
  console.log(`  🔗 ${upscaledVideoUrl}`);

  await saveState({ ...state, upscaledVideoUrl });
}

/**
 *
 */
async function testAudio(): Promise<void> {
  setupFal();
  const { selectAudioClip } = await import("./selectAudioClip.js");
  const { DEFAULT_PIPELINE_CONFIG } = await import("./defaultPipelineConfig.js");

  console.log("\n🎵 Testing: Audio Selection\n");
  console.log("  🔄 Finding songs, transcribing, analyzing...\n");

  const clip = await selectAudioClip({
    githubRepo: GITHUB_REPO,
    artistSlug: ARTIST_SLUG,
    clipDuration: DEFAULT_PIPELINE_CONFIG.clipDuration,
    lipsync: false,
  });

  console.log(`\n  ✅ Audio selected!`);
  console.log(`  🎵 Song: "${clip.songTitle}"`);
  console.log(`  ⏱️  Clip: ${clip.startSeconds}s (${clip.durationSeconds}s)`);
  console.log(`  📝 Lyrics: "${clip.clipLyrics.slice(0, 80)}..."`);
  console.log(`  🎭 Mood: ${clip.clipMood}`);

  const state = await loadState();
  await saveState({
    ...state,
    songBuffer: clip.songBuffer.toString("base64"),
    songTitle: clip.songTitle,
    audioStartSeconds: clip.startSeconds,
    clipLyrics: clip.clipLyrics,
    fullLyrics: clip.lyrics.fullLyrics,
  });
}

/**
 *
 */
async function testCaption(): Promise<void> {
  const { generateCaption, fetchArtistContext, fetchAudienceContext } = await import(
    "./generateCaption.js"
  );
  const { fetchGithubFile } = await import("./fetchGithubFile.js");
  const { loadTemplate } = await import("./loadTemplate.js");

  const state = await loadState();
  if (!state.songTitle) {
    console.error("❌ No song in state. Run: audio first");
    process.exit(1);
  }

  console.log("\n✍️  Testing: Caption Generation\n");

  const template = await loadTemplate(TEMPLATE_NAME);
  const artistContext = await fetchArtistContext(GITHUB_REPO, ARTIST_SLUG, fetchGithubFile);
  const audienceContext = await fetchAudienceContext(GITHUB_REPO, ARTIST_SLUG, fetchGithubFile);

  console.log(`  Artist context: ${artistContext.slice(0, 60)}...`);
  console.log(`  Audience context: ${audienceContext.slice(0, 60)}...`);
  console.log("  🔄 Generating caption...\n");

  const captionText = await generateCaption({
    template,
    songTitle: state.songTitle,
    fullLyrics: state.fullLyrics ?? "",
    clipLyrics: state.clipLyrics ?? "",
    artistContext,
    audienceContext,
  });

  console.log(`\n  ✅ Caption: "${captionText}"`);

  await saveState({ ...state, captionText });
}

/**
 *
 */
async function testRender(): Promise<void> {
  const { renderFinalVideo } = await import("./renderFinalVideo.js");

  const state = await loadState();
  const videoUrl = state.upscaledVideoUrl ?? state.videoUrl;
  if (!videoUrl) {
    console.error("❌ No video URL. Run: video first");
    process.exit(1);
  }
  if (!state.songBuffer) {
    console.error("❌ No audio. Run: audio first");
    process.exit(1);
  }

  console.log("\n🎬 Testing: ffmpeg Final Render\n");
  console.log(`  Video: ${videoUrl.slice(0, 60)}...`);
  console.log(`  Caption: "${(state.captionText ?? "test caption").slice(0, 60)}"`);
  console.log(`  Audio: ${state.songTitle} @ ${state.audioStartSeconds}s`);
  console.log("  🔄 Rendering...\n");

  const result = await renderFinalVideo({
    videoUrl,
    songBuffer: Buffer.from(state.songBuffer, "base64"),
    audioStartSeconds: state.audioStartSeconds ?? 0,
    audioDurationSeconds: 8,
    captionText: state.captionText ?? "test caption for the video",
    hasAudio: false,
  });

  const outPath = path.resolve(process.cwd(), "test-output.mp4");
  const videoBuffer = Buffer.from(result.dataUrl.split(",")[1], "base64");
  await fs.writeFile(outPath, videoBuffer);

  console.log(`\n  ✅ Final video rendered!`);
  console.log(`  📁 ${outPath} (${(result.sizeBytes / 1024).toFixed(0)} KB)`);
  console.log(`  👀 Open: open test-output.mp4`);

  await saveState({ ...state, finalVideoPath: outPath });
}

/**
 *
 */
async function testRenderOnly(): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const {
    writeFile: writeFileFn,
    readFile: readFileFn,
    unlink: unlinkFn,
    mkdir: mkdirFn,
  } = await import("node:fs/promises");
  const { randomUUID } = await import("node:crypto");
  const { tmpdir } = await import("node:os");
  const execFileAsync = promisify(execFile);

  console.log("\n🎬 Testing: ffmpeg Render (local test video)\n");

  // Create test video (colored bars, 3 seconds, 16:9)
  const tempDir = path.join(tmpdir(), `render-test-${randomUUID()}`);
  await mkdirFn(tempDir, { recursive: true });
  const testVideoPath = path.join(tempDir, "test-video.mp4");
  const silentPath = path.join(tempDir, "silent.mp3");
  const outputPath = path.join(tempDir, "final.mp4");

  console.log("  Creating test video...");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=s=1280x720:d=3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    testVideoPath,
  ]);

  console.log("  Creating test audio...");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-t",
    "3",
    silentPath,
  ]);

  // Test with a LONG caption to verify adaptive sizing works
  const testCaption =
    process.argv[3] === "long"
      ? "sometimes you just gotta sit in the dark and let the playlist do the talking because words ain't gonna fix what's broken inside but at least the bass hits right where it hurts and you wonder if anyone else is sitting in their room right now feeling the exact same thing scrolling through old photos at 3am knowing you should sleep but the music won't let you go"
      : process.argv[3] === "medium"
        ? "sometimes you just gotta sit in the dark and let the playlist do the talking because words ain't gonna fix what's broken inside"
        : "that one drawer holding all the memories you just can't throw away";

  console.log(`  Caption: "${testCaption.slice(0, 60)}${testCaption.length > 60 ? "..." : ""}"`);
  console.log("  🔄 Rendering...\n");

  // Inline the adaptive layout logic for the test
  const FRAME_W = 720;
  const FRAME_H = 1280;
  const MAX_H_RATIO = 0.4;
  const MIN_FS = 20;
  const MAX_FS = 42;
  const BOTTOM_M = 120;

  /**
   *
   * @param text
   * @param maxChars
   */
  function wrapLocal(text: string, maxChars: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (cur.length + w.length + 1 > maxChars && cur.length > 0) {
        lines.push(cur);
        cur = w;
      } else {
        cur = cur ? `${cur} ${w}` : w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  let chosenFs = MAX_FS;
  let chosenLh = chosenFs + 10;
  let chosenLines: string[] = [];
  for (let fs = MAX_FS; fs >= MIN_FS; fs -= 2) {
    const cpl = Math.floor((FRAME_W * 0.85) / (fs * 0.55));
    const lh = fs + 10;
    const lines = wrapLocal(testCaption.replace(/'/g, "\u2019"), cpl);
    if (lines.length * lh <= FRAME_H * MAX_H_RATIO) {
      chosenFs = fs;
      chosenLh = lh;
      chosenLines = lines;
      break;
    }
    chosenFs = fs;
    chosenLh = lh;
    chosenLines = lines;
  }

  // Determine position based on line count
  const position = chosenLines.length <= 3 ? "bottom" : chosenLines.length <= 6 ? "center" : "top";
  console.log(`  Font size: ${chosenFs}px, Lines: ${chosenLines.length}, Position: ${position}`);

  const FH = 1280;
  const totalTH = chosenLines.length * chosenLh;
  let blockStartY: number;
  if (position === "bottom") {
    blockStartY = FH - BOTTOM_M - totalTH;
  } else if (position === "center") {
    blockStartY = Math.round((FH - totalTH) / 2);
  } else {
    blockStartY = 180;
  }

  const cropFilter = "crop=ih*9/16:ih";
  const scaleFilter = "scale=720:1280";
  const bw = Math.max(2, Math.round(chosenFs / 14));
  const captionFilters = chosenLines.map((line, i) => {
    const yPos = blockStartY + i * chosenLh;
    return `drawtext=text='${line}':fontsize=${chosenFs}:fontcolor=white:borderw=${bw}:bordercolor=black:x=(w-tw)/2:y=${yPos}`;
  });

  const videoFilter = [cropFilter, scaleFilter, ...captionFilters].join(",");

  console.log(`  Filter: ${videoFilter.slice(0, 100)}...`);
  console.log("  🔄 Running ffmpeg...\n");

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      testVideoPath,
      "-t",
      "3",
      "-i",
      silentPath,
      "-vf",
      videoFilter,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    ]);

    const stat = await fs.stat(outputPath);
    const outFile = path.resolve(process.cwd(), "test-output.mp4");
    await fs.copyFile(outputPath, outFile);

    console.log(`  ✅ Rendered! ${(stat.size / 1024).toFixed(0)} KB`);
    console.log(`  📁 ${outFile}`);
    console.log(`  👀 Run: open test-output.mp4`);
  } catch (err) {
    console.error(`  ❌ ffmpeg failed:`, (err as Error).message);
    // Show stderr for debugging
    const e = err as { stderr?: string };
    if (e.stderr) console.error(e.stderr.slice(-500));
  } finally {
    await unlinkFn(testVideoPath).catch(() => {});
    await unlinkFn(silentPath).catch(() => {});
    await unlinkFn(outputPath).catch(() => {});
  }
}

// --- Main ---
const step = process.argv[2];
const steps: Record<string, () => Promise<void>> = {
  image: testImage,
  video: testVideo,
  "upscale-image": testUpscaleImage,
  "upscale-video": testUpscaleVideo,
  audio: testAudio,
  caption: testCaption,
  render: testRender,
  "render-only": testRenderOnly,
};

if (!step || !steps[step]) {
  console.log(`
Usage: npx tsx src/content/testPipeline.ts <step>

Steps (run in order, each saves state for the next):
  image          Generate AI image from face-guide
  upscale-image  Upscale the generated image
  video          Generate video from image
  upscale-video  Upscale the video
  audio          Select audio clip from GitHub songs
  caption        Generate TikTok caption
  render         Final ffmpeg render (crop + audio + caption)
  render-only    Quick test ffmpeg with a sample video
`);
  process.exit(0);
}

steps[step]().catch(err => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
