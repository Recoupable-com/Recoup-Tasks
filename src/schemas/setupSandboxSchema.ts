import { z } from "zod";

export const setupSandboxPayloadSchema = z.object({
  sandboxId: z.string().min(1, "sandboxId is required"),
  accountId: z.string().min(1, "accountId is required"),
});

export type SetupSandboxPayload = z.infer<typeof setupSandboxPayloadSchema>;
