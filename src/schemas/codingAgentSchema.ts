import { z } from "zod";

export const codingAgentPayloadSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  callbackThreadId: z.string().optional(),
});

export type CodingAgentPayload = z.infer<typeof codingAgentPayloadSchema>;

export interface CodingAgentResult {
  branch: string;
  snapshotId: string;
  prs: { repo: string; number: number; url: string; baseBranch: string }[];
  stdout: string;
  stderr: string;
}
