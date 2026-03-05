import dotenv from "dotenv";
import fs from "node:fs";
import { fetchGithubFile } from "./fetchGithubFile.js";

dotenv.config({ path: ".env.local" });

const REPO = "https://github.com/recoupable/sidney-swift-1ca89eeb-14ab-4a4a-a1c5-2dd41663c039";

async function main() {
  console.log("Fetching face-guide from GitHub (with submodule check)...");
  const buf = await fetchGithubFile(REPO, "artists/gatsby-grace/context/images/face-guide.png");

  if (buf) {
    console.log("✅ Found! Size:", buf.length, "bytes");
    const header = buf.slice(0, 8).toString("hex");
    console.log("PNG header:", header.startsWith("89504e47") ? "✅ Valid PNG" : "❌ NOT PNG: " + header);
    fs.writeFileSync("/tmp/debug-face-guide.png", buf);
    console.log("Saved to /tmp/debug-face-guide.png — open it to verify it's the right face");
  } else {
    console.log("❌ NOT FOUND in main repo or submodules");
  }
}

main().catch(e => console.error("Error:", e.message));
