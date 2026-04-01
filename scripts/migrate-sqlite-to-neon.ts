/**
 * One-time migration script: SQLite → Neon Postgres
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite-to-neon.ts
 *
 * Prerequisites:
 *   - data/fashion.db exists (source)
 *   - DATABASE_URL set in .env.local (target)
 */

import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DB_PATH = path.join(process.cwd(), "data", "fashion.db");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in .env.local");
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`SQLite database not found at ${DB_PATH}`);
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const sqlite = new Database(DB_PATH, { readonly: true });

async function main() {
  console.log("Starting migration: SQLite → Neon Postgres\n");

  // 1. Create tables in Neon
  console.log("Creating tables...");
  await sql`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      garment_type TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      color_palette JSONB NOT NULL DEFAULT '[]',
      pattern TEXT NOT NULL DEFAULT '',
      season TEXT NOT NULL DEFAULT '',
      occasion TEXT NOT NULL DEFAULT '',
      consumer_profile TEXT NOT NULL DEFAULT '',
      trend_notes TEXT NOT NULL DEFAULT '',
      location_continent TEXT NOT NULL DEFAULT '',
      location_country TEXT NOT NULL DEFAULT '',
      location_city TEXT NOT NULL DEFAULT '',
      designer TEXT NOT NULL DEFAULT '',
      embedding TEXT,
      embedding_text TEXT,
      upload_date TEXT NOT NULL,
      upload_year INTEGER NOT NULL,
      upload_month INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      tags JSONB NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_images_fts ON images
    USING GIN (to_tsvector('english',
      coalesce(description, '') || ' ' ||
      coalesce(garment_type, '') || ' ' ||
      coalesce(style, '') || ' ' ||
      coalesce(material, '') || ' ' ||
      coalesce(pattern, '') || ' ' ||
      coalesce(occasion, '') || ' ' ||
      coalesce(consumer_profile, '') || ' ' ||
      coalesce(trend_notes, '') || ' ' ||
      coalesce(location_country, '') || ' ' ||
      coalesce(location_city, '')
    ))
  `;
  console.log("  Tables created.\n");

  // 2. Migrate images
  const images = sqlite.prepare("SELECT * FROM images").all() as Record<string, unknown>[];
  console.log(`Migrating ${images.length} images...`);

  let imgSuccess = 0;
  let imgSkipped = 0;
  for (const img of images) {
    try {
      // Check if already exists (for re-runnable migration)
      const existing = await sql`SELECT id FROM images WHERE id = ${img.id as string}`;
      if (existing.length > 0) {
        imgSkipped++;
        continue;
      }

      // Ensure color_palette is valid JSON
      let colorPalette: string;
      try {
        const parsed = JSON.parse(img.color_palette as string);
        colorPalette = JSON.stringify(parsed);
      } catch {
        colorPalette = "[]";
      }

      await sql`
        INSERT INTO images (id, filename, original_name, description, garment_type, style, material,
          color_palette, pattern, season, occasion, consumer_profile, trend_notes,
          location_continent, location_country, location_city, designer,
          embedding, embedding_text,
          upload_date, upload_year, upload_month, created_at)
        VALUES (
          ${img.id as string}, ${img.filename as string}, ${img.original_name as string},
          ${img.description as string}, ${img.garment_type as string}, ${img.style as string},
          ${img.material as string}, ${colorPalette}::jsonb, ${img.pattern as string},
          ${img.season as string}, ${img.occasion as string}, ${img.consumer_profile as string},
          ${img.trend_notes as string}, ${img.location_continent as string},
          ${img.location_country as string}, ${img.location_city as string},
          ${img.designer as string},
          ${(img.embedding as string) || null}, ${(img.embedding_text as string) || null},
          ${img.upload_date as string}, ${img.upload_year as number}, ${img.upload_month as number},
          ${img.created_at as string}
        )
      `;
      imgSuccess++;
      process.stdout.write(`  ${imgSuccess}/${images.length} images migrated\r`);
    } catch (err) {
      console.error(`\n  Failed to migrate image ${img.id}: ${err}`);
    }
  }
  console.log(`\n  Images: ${imgSuccess} migrated, ${imgSkipped} skipped (already exist)\n`);

  // 3. Migrate annotations
  const annotations = sqlite.prepare("SELECT * FROM annotations").all() as Record<string, unknown>[];
  console.log(`Migrating ${annotations.length} annotations...`);

  let annSuccess = 0;
  let annSkipped = 0;
  for (const ann of annotations) {
    try {
      const existing = await sql`SELECT id FROM annotations WHERE id = ${ann.id as string}`;
      if (existing.length > 0) {
        annSkipped++;
        continue;
      }

      // Ensure tags is valid JSON
      let tags: string;
      try {
        const parsed = JSON.parse(ann.tags as string);
        tags = JSON.stringify(parsed);
      } catch {
        tags = "[]";
      }

      await sql`
        INSERT INTO annotations (id, image_id, tags, notes, created_at)
        VALUES (
          ${ann.id as string}, ${ann.image_id as string}, ${tags}::jsonb,
          ${ann.notes as string}, ${ann.created_at as string}
        )
      `;
      annSuccess++;
    } catch (err) {
      console.error(`  Failed to migrate annotation ${ann.id}: ${err}`);
    }
  }
  console.log(`  Annotations: ${annSuccess} migrated, ${annSkipped} skipped\n`);

  // 4. Verify
  const imgCount = await sql`SELECT COUNT(*) as count FROM images`;
  const annCount = await sql`SELECT COUNT(*) as count FROM annotations`;
  console.log("=== Migration Complete ===");
  console.log(`  Images in Neon:      ${imgCount[0].count}`);
  console.log(`  Annotations in Neon: ${annCount[0].count}`);

  sqlite.close();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
