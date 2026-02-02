import { z } from "zod";

export const runSandboxCommandPayloadSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  sandboxId: z.string().min(1, "sandboxId is required"),
});

export type RunSandboxCommandPayload = z.infer<
  typeof runSandboxCommandPayloadSchema
>;

export const sandboxResultSchema = z.object({
  sandboxId: z.string(),
  sandboxStatus: z.string(),
  timeout: z.number(),
  createdAt: z.string(),
});

export type SandboxResult = z.infer<typeof sandboxResultSchema>;
