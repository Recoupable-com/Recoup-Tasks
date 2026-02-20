import React from "react";
import { Composition } from "remotion";
import { SocialPost, SocialPostProps } from "./components/SocialPost";
import { CroppedVideo, CroppedVideoProps } from "./components/CroppedVideo";

/**
 * Remotion Root — registers all compositions available for server-side rendering.
 *
 * Every composition registered here can be rendered via POST /api/video/render
 * by passing its `id` as the `compositionId` parameter.
 *
 * To add a new renderable video type:
 * 1. Create a new component in ./components/
 * 2. Register it as a <Composition> below
 * 3. Deploy the tasks worker
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SocialPost"
        component={SocialPost}
        durationInFrames={240}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoUrl: "https://example.com/placeholder.mp4",
          audioSrc: "",
          captionText: "",
          hasAudio: false,
          audioStartSeconds: 0,
        } satisfies SocialPostProps}
      />
      <Composition
        id="CropPreview"
        component={CroppedVideo}
        durationInFrames={240}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoUrl: "https://example.com/placeholder.mp4",
        } satisfies CroppedVideoProps}
      />
    </>
  );
};
