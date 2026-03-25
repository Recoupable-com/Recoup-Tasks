import { z } from "zod";

export const pollContentRunPayloadSchema = z.object({
  runIds: z.array(z.string()).min(1),
  callbackThreadId: z.string().min(1),
});
