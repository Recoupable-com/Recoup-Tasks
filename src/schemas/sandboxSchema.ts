import { z } from "zod";

export const runSandboxCommandPayloadSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  accountId: z.string().uuid("accountId must be a valid UUID"),
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
