import { z } from "zod";

export const runSandboxCommandPayloadSchema = z.object({
  command: z.string().min(1, "command is required"),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  sandboxId: z.string().min(1, "sandboxId is required"),
  accountId: z.string().min(1, "accountId is required"),
});

export type RunSandboxCommandPayload = z.infer<
  typeof runSandboxCommandPayloadSchema
>;

export const snapshotSchema = z.object({
  id: z.string(),
  expiresAt: z.string(),
});

export type Snapshot = z.infer<typeof snapshotSchema>;

export const sandboxResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  snapshot: snapshotSchema,
});

export type SandboxResult = z.infer<typeof sandboxResultSchema>;
