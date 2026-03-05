import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import { fal } from "@fal-ai/client";
import { fetchGithubFile } from "./fetchGithubFile.js";
import { loadTemplate, pickRandomReferenceImage } from "./loadTemplate.js";

fal.config({ credentials: process.env.FAL_KEY! });

const REPO = "https://github.com/recoupable/sidney-swift-1ca89eeb-14ab-4a4a-a1c5-2dd41663c039";
const ARTIST = "gatsby-grace";
const PROMPT = "A candid front-facing selfie in a dimly lit bedroom with purple LED lighting. Phone camera, low light, grainy. Deadpan expression.";

async function generate(label: string, imageUrls: string[]): Promise<string> {
  console.log(`\n🔄 ${label} (${imageUrls.length} images)...`);

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: PROMPT,
      image_urls: imageUrls,
      aspect_ratio: "16:9" as const,
      resolution: "2K" as const,
      output_format: "png",
      num_images: 1,
    },
  });

  const data = result.data as Record<string, unknown>;
  let url: string | undefined;
  if (data.images && Array.isArray(data.images)) {
    url = (data.images[0] as Record<string, string>)?.url;
  }
  console.log(`  ✅ ${label}: ${url}`);
  return url ?? "";
}

async function main() {
  const template = await loadTemplate("artist-caption-bedroom");

  // Upload face-guide
  console.log("Uploading face-guide...");
  const fgBuf = await fetchGithubFile(REPO, `artists/${ARTIST}/context/images/face-guide.png`);
  if (!fgBuf) throw new Error("face-guide not found");
  const fgUrl = await fal.storage.upload(new File([fgBuf], "face-guide.png", { type: "image/png" }));

  // Upload reference image
  const refPath = pickRandomReferenceImage(template);
  let refUrl = "";
  if (refPath) {
    const refBuf = fs.readFileSync(refPath);
    refUrl = await fal.storage.upload(new File([refBuf], "reference.png", { type: "image/png" }));
  }

  console.log("\nFace-guide:", fgUrl.slice(0, 60));
  console.log("Reference:", refUrl.slice(0, 60));

  // Test 1: Only face-guide
  const url1 = await generate("TEST 1: Face-guide ONLY", [fgUrl]);

  // Test 2: Face-guide first, reference second (current order)
  const url2 = await generate("TEST 2: Face-guide FIRST, reference second", [fgUrl, refUrl]);

  // Test 3: Reference first, face-guide second (swapped)
  const url3 = await generate("TEST 3: Reference FIRST, face-guide second", [refUrl, fgUrl]);

  console.log("\n\n=== RESULTS ===");
  console.log("Test 1 (face only):", url1);
  console.log("Test 2 (face, ref):", url2);
  console.log("Test 3 (ref, face):", url3);
  console.log("\n👀 Open all 3 URLs and compare which face matches gatsby-grace");
}

main().catch(e => console.error("Error:", e.message));
