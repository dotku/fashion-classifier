/**
 * Download fashion images from Pexels API for evaluation.
 *
 * Usage: npx tsx eval/download-pexels.ts
 */

import fs from "fs";
import path from "path";
import https from "https";

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("PEXELS_API_KEY not set in environment");
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, "eval_images");
const TOTAL_IMAGES = 50;
const PER_PAGE = 50;

interface PexelsPhoto {
  id: number;
  src: { medium: string };
}

async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: API_KEY! } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    });
    req.on("error", reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Fetching ${TOTAL_IMAGES} fashion images from Pexels...\n`);

  const url = `https://api.pexels.com/v1/search?query=fashion+clothing+outfit&per_page=${PER_PAGE}&page=1`;
  const data = await fetchJson(url) as { photos: PexelsPhoto[] };

  if (!data.photos || data.photos.length === 0) {
    console.error("No photos returned from Pexels API");
    process.exit(1);
  }

  const photos = data.photos.slice(0, TOTAL_IMAGES);
  console.log(`Got ${photos.length} photos. Downloading...\n`);

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const num = String(i + 1).padStart(3, "0");
    const dest = path.join(OUTPUT_DIR, `${num}.jpg`);

    if (fs.existsSync(dest)) {
      console.log(`  ${num}.jpg already exists, skipping`);
      continue;
    }

    console.log(`  Downloading ${num}.jpg (pexels id: ${photo.id})...`);
    await downloadFile(photo.src.medium, dest);
  }

  console.log(`\nDone! ${photos.length} images saved to eval/eval_images/`);
}

main().catch(console.error);
