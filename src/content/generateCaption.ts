import { logger } from "@trigger.dev/sdk/v3";
import type { TemplateData } from "./loadTemplate";
import type { SongLyrics } from "./transcribeSong";
import type { CaptionLength } from "../schemas/contentCreationSchema";

const CAPTION_LENGTH_INSTRUCTIONS: Record<CaptionLength, string> = {
  short: "Write a SHORT caption (max 10 words). Punchy, minimal, like a text message. Think: one phrase that hits.",
  medium: "Write a MEDIUM caption (15-30 words). A complete thought with feeling. 1-2 sentences max.",
  long: "Write a LONG caption (40-80 words). A mini-story or stream of consciousness. Vulnerable, raw, the kind of caption people screenshot.",
};

/**
 * Generates a TikTok-style caption using the Recoup Chat API.
 * Combines template style, artist context, song lyrics, and audience data.
 *
 * Matches the content-creation-app's generateCaption.ts behavior.
 */
export async function generateCaption({
  template,
  songTitle,
  fullLyrics,
  clipLyrics,
  artistContext,
  audienceContext,
  captionLength = "short",
}: {
  template: TemplateData;
  songTitle: string;
  fullLyrics: string;
  clipLyrics: string;
  artistContext: string;
  audienceContext: string;
  captionLength?: CaptionLength;
}): Promise<string> {
  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) {
    throw new Error("RECOUP_API_KEY is required for caption generation");
  }

  const captionGuide = template.captionGuide
    ? JSON.stringify(template.captionGuide, null, 2)
    : "(no caption guide)";

  const examples = template.captionExamples.length > 0
    ? template.captionExamples.map(c => `- "${c}"`).join("\n")
    : "(no examples)";

  const lengthInstruction = CAPTION_LENGTH_INSTRUCTIONS[captionLength];

  const prompt = `Generate ONE caption for a TikTok post.

## LENGTH REQUIREMENT
${lengthInstruction}

## Content Style
${captionGuide}

## Reference Captions (these are examples of what GOOD looks like for this style)
${examples}

## Artist
${artistContext}

## Audience
${audienceContext}

## Song Playing: "${songTitle}"
Full lyrics: ${fullLyrics}
What the viewer hears (first 8 seconds): "${clipLyrics}"

Generate ONE caption. ${lengthInstruction} Return ONLY the caption text, nothing else. No quotes around it. No hashtags unless the caption naturally calls for them.`;

  logger.log("Generating caption", { songTitle });

  const recoupApiUrl = process.env.RECOUP_API_URL ?? "https://recoup-api.vercel.app";
  const response = await fetch(`${recoupApiUrl}/api/chat/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": recoupApiKey,
    },
    body: JSON.stringify({
      prompt,
      model: "google/gemini-2.5-flash",
      excludeTools: ["create_task"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Recoup Chat API error: ${response.status}`);
  }

  const json = (await response.json()) as {
    text?: string | Array<{ type: string; text?: string }>;
  };

  let captionText: string;
  if (typeof json.text === "string") {
    captionText = json.text.trim();
  } else if (Array.isArray(json.text)) {
    captionText = json.text
      .filter(p => p.type === "text" && p.text)
      .map(p => p.text!)
      .join("")
      .trim();
  } else {
    captionText = "";
  }

  // Clean up — remove quotes if the model wrapped it
  captionText = captionText.replace(/^["']|["']$/g, "").trim();

  if (!captionText) {
    throw new Error("Caption generation returned empty text");
  }

  logger.log("Caption generated", { caption: captionText.slice(0, 80) });
  return captionText;
}

/**
 * Fetches artist context (artist.md) from GitHub.
 * Returns placeholder if not found.
 */
export async function fetchArtistContext(
  githubRepo: string,
  artistSlug: string,
  fetchFile: (repo: string, path: string) => Promise<Buffer | null>,
): Promise<string> {
  const buffer = await fetchFile(
    githubRepo,
    `artists/${artistSlug}/context/artist.md`,
  );
  if (!buffer) return "(no artist identity available)";
  const content = buffer.toString("utf-8");
  // Strip frontmatter if present
  return content.replace(/^---[\s\S]*?---\s*/, "").trim();
}

/**
 * Fetches audience context (audience.md) from GitHub.
 * Returns placeholder if not found.
 */
export async function fetchAudienceContext(
  githubRepo: string,
  artistSlug: string,
  fetchFile: (repo: string, path: string) => Promise<Buffer | null>,
): Promise<string> {
  const buffer = await fetchFile(
    githubRepo,
    `artists/${artistSlug}/context/audience.md`,
  );
  if (!buffer) return "(no audience context available)";
  return buffer.toString("utf-8").replace(/^---[\s\S]*?---\s*/, "").trim();
}
