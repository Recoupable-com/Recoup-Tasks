import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Audio,
  Sequence,
  staticFile,
} from "remotion";

// Load TikTok Sans Regular — the actual TikTok caption font
// Guard against server-side execution (FontFace is a browser-only API)
if (typeof globalThis.FontFace !== "undefined") {
  const fontFace = new FontFace("TikTok Sans", `url(${staticFile("TikTokSans-Regular.ttf")})`);
  fontFace.load().then((f) => { document.fonts.add(f); }).catch(() => {});
}

export interface SocialPostProps {
  /** URL of the 16:9 source video */
  videoUrl: string;
  /** Filename of the audio in Remotion's public dir (empty = no audio) */
  audioSrc: string;
  /** Caption text to overlay */
  captionText: string;
  /** Whether the source video already has audio (lip-sync path) */
  hasAudio: boolean;
  /** Start offset into the audio file in seconds (default 0) */
  audioStartSeconds: number;
}

/**
 * Full social post composition:
 * 1. Center-crop 16:9 → 9:16
 * 2. Song audio (if not lip-sync)
 * 3. TikTok-style caption text (white with black stroke, bottom center)
 */
export const SocialPost: React.FC<SocialPostProps> = ({
  videoUrl,
  audioSrc,
  captionText,
  hasAudio,
  audioStartSeconds = 0,
}) => {
  // Convert audio start offset from seconds to frames (audio is 30fps in Remotion)
  const audioStartFrame = Math.round(audioStartSeconds * 30);

  // Caption visible immediately
  const captionOpacity = 1;

  // Crop math: 16:9 → 9:16 center crop
  const scaledWidth = 1280 * (16 / 9);
  const offsetX = -(scaledWidth - 720) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* Layer 1: Cropped video */}
      <OffthreadVideo
        src={videoUrl}
        style={{
          position: "absolute",
          top: 0,
          left: offsetX,
          width: scaledWidth,
          height: 1280,
          objectFit: "cover",
        }}
      />

      {/* Layer 2: Audio (skip if video already has it) */}
      {!hasAudio && audioSrc && (
        <Sequence from={0}>
          <Audio src={staticFile(audioSrc)} volume={0.85} startFrom={audioStartFrame} />
        </Sequence>
      )}

      {/* Layer 3: TikTok-style caption — white text, black stroke, bottom center */}
      {captionText && (
        <div
          style={{
            position: "absolute",
            bottom: "18%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            padding: "0 80px",
            opacity: captionOpacity,
          }}
        >
          <p
            style={{
              color: "#FFFFFF",
              fontFamily: "'TikTok Sans', system-ui, sans-serif",
              fontSize: 46,
              fontWeight: 400,
              textAlign: "center",
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.02em",
              wordWrap: "break-word",
              maxWidth: "100%",
              // Text outline via text-shadow
              textShadow: [
                "-4px -4px 0 #000", "4px -4px 0 #000", "-4px 4px 0 #000", "4px 4px 0 #000",
                "0 -4px 0 #000", "0 4px 0 #000", "-4px 0 0 #000", "4px 0 0 #000",
                "-3px -3px 0 #000", "3px -3px 0 #000", "-3px 3px 0 #000", "3px 3px 0 #000",
                "-2px -2px 0 #000", "2px -2px 0 #000", "-2px 2px 0 #000", "2px 2px 0 #000",
              ].join(", "),
            }}
          >
            {captionText}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
