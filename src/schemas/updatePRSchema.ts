import { z } from "zod";

export const updatePRPayloadSchema = z.object({
  feedback: z.string().min(1, "feedback is required"),
  snapshotId: z.string().min(1, "snapshotId is required"),
  branch: z.string().min(1, "branch is required"),
  repo: z.string().min(1, "repo is required"),
  callbackThreadId: z.string().optional(),
});

export type UpdatePRPayload = z.infer<typeof updatePRPayloadSchema>;
