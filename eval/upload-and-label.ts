/**
 * Upload eval images to the project and generate ground truth from first-pass classification.
 *
 * Usage: npx tsx eval/upload-and-label.ts
 *
 * Requires the Next.js dev server running at http://localhost:3000
 */

import fs from "fs";
import path from "path";

const IMAGES_DIR = path.join(__dirname, "eval_images");
const GT_PATH = path.join(__dirname, "ground_truth.json");
const API_BASE = "http://localhost:3000";

interface GroundTruth {
  image: string;
  expected: Record<string, string>;
}

async function main() {
  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.endsWith(".jpg"))
    .sort()
    .slice(0, 50);

  console.log(`Processing ${files.length} images...\n`);

  const groundTruth: GroundTruth[] = [];
  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const filepath = path.join(IMAGES_DIR, file);
    const num = file.replace(".jpg", "");

    console.log(`  [${num}/${files.length}] Uploading ${file}...`);

    try {
      // Upload via the project's upload API with retry on rate limit
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const formData = new FormData();
        const blob = new Blob([fs.readFileSync(filepath)], { type: "image/jpeg" });
        formData.append("file", blob, file);
        formData.append("designer", "Pexels Eval");
        formData.append("model", "google/gemma-3-27b-it:free");

        res = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) break;

        const errBody = await res.text();
        if (res.status === 500 && errBody.includes("429")) {
          const wait = (attempt + 1) * 15;
          console.log(`    Rate limited, waiting ${wait}s...`);
          await new Promise(r => setTimeout(r, wait * 1000));
          continue;
        }

        console.log(`    FAILED: ${errBody}`);
        break;
      }

      if (!res || !res.ok) {
        failed++;
        continue;
      }

      // Delay between requests to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));

      const record = await res.json();
      const attrs = record.attributes;

      // Save as ground truth entry
      groundTruth.push({
        image: `eval_images/${file}`,
        expected: {
          garment_type: attrs.garment_type || "unknown",
          style: attrs.style || "unknown",
          material: attrs.material || "unknown",
          pattern: attrs.pattern || "unknown",
          season: attrs.season || "unknown",
          occasion: attrs.occasion || "unknown",
          location_continent: attrs.location_continent || "unknown",
        },
      });

      uploaded++;
      console.log(`    OK: ${attrs.garment_type} / ${attrs.style} / ${attrs.material}`);
    } catch (err) {
      console.log(`    ERROR: ${err}`);
      failed++;
    }
  }

  // Write ground truth
  fs.writeFileSync(GT_PATH, JSON.stringify(groundTruth, null, 2));
  console.log(`\n=== Summary ===`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Ground truth saved to eval/ground_truth.json`);
}

main().catch(console.error);
