import { z } from "zod";

export const setupSandboxPayloadSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
});

export type SetupSandboxPayload = z.infer<typeof setupSandboxPayloadSchema>;
