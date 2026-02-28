import { z } from "zod";

const prSchema = z.object({
  repo: z.string(),
  number: z.number(),
  url: z.string(),
  baseBranch: z.string(),
});

export const updatePRPayloadSchema = z.object({
  feedback: z.string().min(1, "feedback is required"),
  snapshotId: z.string().min(1, "snapshotId is required"),
  branch: z.string().min(1, "branch is required"),
  prs: z.array(prSchema).min(1, "at least one PR is required"),
  callbackThreadId: z.string().min(1, "callbackThreadId is required"),
});

export type UpdatePRPayload = z.infer<typeof updatePRPayloadSchema>;
