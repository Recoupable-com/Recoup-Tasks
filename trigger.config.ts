import { defineConfig } from "@trigger.dev/sdk/v3";
import { ffmpeg, additionalFiles, aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_pxwxehzmqaxylqhhkomn",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  machine: "micro",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["src"],
  build: {
    // Remotion packages use dynamic requires internally (e.g. @remotion/studio/renderEntry)
    // that break when bundled by esbuild. Mark them as external so they stay as
    // real node_modules in the container.
    external: [
      "@remotion/bundler",
      "@remotion/renderer",
      "@remotion/studio",
      "remotion",
    ],
    extensions: [
      // FFmpeg is required by Remotion for video encoding
      ffmpeg(),
      // System libraries required by Remotion's chrome-headless-shell
      aptGet({
        packages: [
          "libnss3",
          "libatk1.0-0",
          "libatk-bridge2.0-0",
          "libcups2",
          "libxkbcommon0",
          "libxcomposite1",
          "libxdamage1",
          "libxfixes3",
          "libxrandr2",
          "libgbm1",
          "libpango-1.0-0",
          "libcairo2",
          "libasound2",
        ],
      }),
      // Include the Remotion source files so bundle() can find them at runtime
      additionalFiles({
        files: [
          "./src/remotion/**",
        ],
      }),
    ],
  },
});
