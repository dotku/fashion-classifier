/**
 * Evaluation script for the fashion garment classifier.
 *
 * Usage:
 *   npx tsx eval/evaluate.ts
 *
 * Prerequisites:
 *   - Place test images in eval/eval_images/ (numbered 001.jpg, 002.jpg, etc.)
 *   - Update eval/ground_truth.json with expected attributes for each image
 *   - Set ANTHROPIC_API_KEY in your environment
 *
 * The script:
 *   1. Reads ground truth labels from ground_truth.json
 *   2. Runs the classifier on each image
 *   3. Compares predicted vs. expected attributes
 *   4. Reports per-attribute accuracy and overall accuracy
 */

import fs from "fs";
import path from "path";
import { classifyImage } from "../lib/classifier";

interface GroundTruth {
  image: string;
  expected: Record<string, string>;
}

interface Result {
  image: string;
  attribute: string;
  expected: string;
  predicted: string;
  match: boolean;
}

const EVALUATED_ATTRIBUTES = [
  "garment_type",
  "style",
  "material",
  "pattern",
  "season",
  "occasion",
  "location_continent",
];

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "");
}

function isMatch(predicted: string, expected: string): boolean {
  const p = normalize(predicted);
  const e = normalize(expected);
  if (p === e) return true;
  // Partial match: one contains the other
  if (p.includes(e) || e.includes(p)) return true;
  return false;
}

async function main() {
  const gtPath = path.join(__dirname, "ground_truth.json");
  if (!fs.existsSync(gtPath)) {
    console.error("ground_truth.json not found. See README for setup instructions.");
    process.exit(1);
  }

  const groundTruth: GroundTruth[] = JSON.parse(fs.readFileSync(gtPath, "utf-8"));
  const results: Result[] = [];
  const errors: { image: string; error: string }[] = [];

  console.log(`Evaluating ${groundTruth.length} images...\n`);

  for (const gt of groundTruth) {
    const imagePath = path.join(__dirname, gt.image);
    if (!fs.existsSync(imagePath)) {
      console.log(`  SKIP ${gt.image} (file not found)`);
      continue;
    }

    console.log(`  Processing ${gt.image}...`);
    try {
      const classification = await classifyImage(imagePath, "gemini-2.5-flash");
      const attrs = classification.attributes as unknown as Record<string, unknown>;

      for (const attr of EVALUATED_ATTRIBUTES) {
        if (gt.expected[attr]) {
          const predicted = String(attrs[attr] || "unknown");
          const expected = gt.expected[attr];
          results.push({
            image: gt.image,
            attribute: attr,
            expected,
            predicted,
            match: isMatch(predicted, expected),
          });
        }
      }
    } catch (err) {
      errors.push({ image: gt.image, error: String(err) });
      console.log(`    ERROR: ${err}`);
    }
  }

  // Report per-attribute accuracy
  console.log("\n=== Per-Attribute Accuracy ===\n");
  const attrStats: Record<string, { total: number; correct: number }> = {};

  for (const r of results) {
    if (!attrStats[r.attribute]) attrStats[r.attribute] = { total: 0, correct: 0 };
    attrStats[r.attribute].total++;
    if (r.match) attrStats[r.attribute].correct++;
  }

  for (const [attr, stats] of Object.entries(attrStats)) {
    const pct = ((stats.correct / stats.total) * 100).toFixed(1);
    console.log(`  ${attr.padEnd(22)} ${stats.correct}/${stats.total} (${pct}%)`);
  }

  // Overall
  const totalCorrect = results.filter(r => r.match).length;
  const totalResults = results.length;
  const overallPct = totalResults > 0 ? ((totalCorrect / totalResults) * 100).toFixed(1) : "N/A";
  console.log(`\n  OVERALL:               ${totalCorrect}/${totalResults} (${overallPct}%)`);

  // Mismatches
  const mismatches = results.filter(r => !r.match);
  if (mismatches.length > 0) {
    console.log("\n=== Mismatches ===\n");
    for (const m of mismatches) {
      console.log(`  ${m.image} | ${m.attribute}: expected "${m.expected}", got "${m.predicted}"`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n=== Errors (${errors.length}) ===\n`);
    for (const e of errors) {
      console.log(`  ${e.image}: ${e.error}`);
    }
  }

  // Write report
  const report = {
    date: new Date().toISOString(),
    total_images: groundTruth.length,
    total_evaluated: results.length,
    overall_accuracy: overallPct + "%",
    per_attribute: Object.fromEntries(
      Object.entries(attrStats).map(([k, v]) => [k, `${v.correct}/${v.total} (${((v.correct / v.total) * 100).toFixed(1)}%)`])
    ),
    mismatches: mismatches.map(m => ({
      image: m.image,
      attribute: m.attribute,
      expected: m.expected,
      predicted: m.predicted,
    })),
    errors,
  };

  fs.writeFileSync(path.join(__dirname, "report.json"), JSON.stringify(report, null, 2));
  console.log("\nReport saved to eval/report.json");
}

main().catch(console.error);
