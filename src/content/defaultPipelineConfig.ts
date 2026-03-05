/**
 * Default pipeline configuration for content creation.
 *
 * These are sensible defaults that work for any artist. An artist can
 * optionally override specific fields via config/content-creation/config.json
 * in their repo, but it's not required.
 */

export interface PipelineConfig {
  imageModel: string;
  videoModel: string;
  videoModelMaxSeconds: number;
  audioVideoModel: string;
  audioVideoModelMaxSeconds: number;
  upscaleModel: string;
  aspectRatio: string;
  resolution: string;
  artistImage: string;
  clipDuration: number;
  videoResolution: string;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  imageModel: "fal-ai/nano-banana-pro/edit",
  videoModel: "fal-ai/veo3.1/fast/image-to-video",
  videoModelMaxSeconds: 8,
  audioVideoModel: "fal-ai/ltx-2-19b/audio-to-video",
  audioVideoModelMaxSeconds: 19,
  upscaleModel: "fal-ai/seedvr/upscale/image",
  aspectRatio: "16:9",
  resolution: "2K",
  artistImage: "context/images/face-guide.png",
  clipDuration: 15,
  videoResolution: "720p",
};
