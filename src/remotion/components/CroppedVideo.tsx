import React from "react";
import { AbsoluteFill, OffthreadVideo } from "remotion";

export interface CroppedVideoProps {
  /** URL of the 16:9 source video */
  videoUrl: string;
}

/**
 * Center-crops a 16:9 landscape video to 9:16 portrait.
 *
 * The video is scaled so its height fills the 1280px canvas,
 * then horizontally centered so the subject (who should be centered
 * in the original) stays in frame.
 */
export const CroppedVideo: React.FC<CroppedVideoProps> = ({ videoUrl }) => {
  // 16:9 source scaled to fill 1280px height:
  // width = 1280 * (16/9) ≈ 2276px
  // Offset to center: -(2276 - 720) / 2 ≈ -778px
  const scaledWidth = 1280 * (16 / 9);
  const offsetX = -(scaledWidth - 720) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
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
    </AbsoluteFill>
  );
};
