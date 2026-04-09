import { fal as falClient } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY as string;

if (!FAL_KEY) {
  throw new Error("FAL_KEY must be set");
}

falClient.config({ credentials: FAL_KEY });

const fal = falClient;

export default fal;
