import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

const faceDetectionSchema = z.object({
  hasFace: z.boolean(),
});

const instructions = `You analyze images to determine if they contain a human face or portrait.

Given an image URL, determine if the image is a headshot, selfie, press photo, or portrait of a person.

Return hasFace: true if the image contains a clear human face as the primary subject.
Return hasFace: false if the image is an album cover, playlist cover, logo, graphic, landscape, or any non-portrait image.`;

/**
 * Creates a ToolLoopAgent configured for face detection in images.
 * Uses Output.object with a Zod schema for structured boolean response.
 *
 * @returns A configured ToolLoopAgent using Google Gemini via AI Gateway.
 */
export function createFaceDetectionAgent() {
  return new ToolLoopAgent({
    model: "google/gemini-2.5-flash",
    instructions,
    output: Output.object({ schema: faceDetectionSchema }),
    stopWhen: stepCountIs(1),
  });
}
