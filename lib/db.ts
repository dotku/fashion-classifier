import Database from "better-sqlite3";
import path from "path";
import { ImageRecord, Annotation, GarmentAttributes, FilterOptions } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "fashion.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
    migrate(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      garment_type TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      color_palette TEXT NOT NULL DEFAULT '[]',
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
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
      id,
      description,
      garment_type,
      style,
      material,
      color_palette,
      pattern,
      occasion,
      consumer_profile,
      trend_notes,
      location_country,
      location_city
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS annotations_fts USING fts5(
      id,
      image_id,
      tags,
      notes
    );
  `);
}

export function insertImage(record: ImageRecord): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO images (id, filename, original_name, description, garment_type, style, material,
      color_palette, pattern, season, occasion, consumer_profile, trend_notes,
      location_continent, location_country, location_city, designer,
      upload_date, upload_year, upload_month, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    record.id, record.filename, record.original_name, record.description,
    record.attributes.garment_type, record.attributes.style, record.attributes.material,
    JSON.stringify(record.attributes.color_palette), record.attributes.pattern,
    record.attributes.season, record.attributes.occasion, record.attributes.consumer_profile,
    record.attributes.trend_notes, record.attributes.location_continent,
    record.attributes.location_country, record.attributes.location_city,
    record.designer, record.upload_date, record.upload_year, record.upload_month, record.created_at
  );

  const insertFts = db.prepare(`
    INSERT INTO images_fts (id, description, garment_type, style, material, color_palette, pattern, occasion,
      consumer_profile, trend_notes, location_country, location_city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertFts.run(
    record.id, record.description, record.attributes.garment_type, record.attributes.style,
    record.attributes.material, record.attributes.color_palette.join(" "),
    record.attributes.pattern, record.attributes.occasion,
    record.attributes.consumer_profile, record.attributes.trend_notes,
    record.attributes.location_country, record.attributes.location_city
  );
}

export function getImage(id: string): ImageRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM images WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToImageRecord(row);
}

export function getImagesWithoutEmbeddings(): ImageRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM images WHERE embedding IS NULL").all() as Record<string, unknown>[];
  return rows.map(rowToImageRecord);
}

export function getImages(filters: Record<string, string> = {}): ImageRecord[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value && FILTERABLE_COLUMNS.includes(key)) {
      conditions.push(`${key} LIKE ?`);
      params.push(`%${value}%`);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM images ${where} ORDER BY created_at DESC`).all(...params) as Record<string, unknown>[];
  return rows.map(rowToImageRecord);
}

const FILTERABLE_COLUMNS = [
  "garment_type", "style", "material", "pattern", "season", "occasion",
  "consumer_profile", "trend_notes", "location_continent", "location_country",
  "location_city", "designer", "upload_year", "upload_month",
];

export function getFilterOptions(): FilterOptions {
  const db = getDb();
  const options: FilterOptions = {};
  for (const col of FILTERABLE_COLUMNS) {
    const rows = db.prepare(
      `SELECT DISTINCT ${col} FROM images WHERE ${col} != '' ORDER BY ${col}`
    ).all() as Record<string, string>[];
    const values = rows.map(r => String(r[col]));
    if (values.length > 0) {
      options[col] = values;
    }
  }
  return options;
}

export function insertAnnotation(annotation: Annotation): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO annotations (id, image_id, tags, notes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(annotation.id, annotation.image_id, JSON.stringify(annotation.tags), annotation.notes, annotation.created_at);

  db.prepare(`
    INSERT INTO annotations_fts (id, image_id, tags, notes)
    VALUES (?, ?, ?, ?)
  `).run(annotation.id, annotation.image_id, annotation.tags.join(" "), annotation.notes);
}

export function getAnnotations(imageId: string): Annotation[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at DESC").all(imageId) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    image_id: row.image_id as string,
    tags: JSON.parse(row.tags as string),
    notes: row.notes as string,
    created_at: row.created_at as string,
  }));
}

export function deleteImage(id: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT filename FROM images WHERE id = ?").get(id) as { filename: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM images WHERE id = ?").run(id);
  db.prepare("DELETE FROM images_fts WHERE id = ?").run(id);
  db.prepare("DELETE FROM annotations WHERE image_id = ?").run(id);
  db.prepare("DELETE FROM annotations_fts WHERE image_id = ?").run(id);
  return row.filename;
}

function migrate(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(images)").all() as { name: string }[];
  const hasEmbedding = columns.some(c => c.name === "embedding");
  if (!hasEmbedding) {
    db.exec("ALTER TABLE images ADD COLUMN embedding TEXT");
  }
  const hasEmbeddingText = columns.some(c => c.name === "embedding_text");
  if (!hasEmbeddingText) {
    db.exec("ALTER TABLE images ADD COLUMN embedding_text TEXT");
  }

  // Rebuild FTS index to include color_palette (added in migration)
  try {
    const ftsColumns = db.prepare("PRAGMA table_info(images_fts)").all() as { name: string }[];
    const hasColorInFts = ftsColumns.some(c => c.name === "color_palette");
    if (!hasColorInFts) {
      db.exec("DROP TABLE IF EXISTS images_fts");
      db.exec(`
        CREATE VIRTUAL TABLE images_fts USING fts5(
          id, description, garment_type, style, material, color_palette,
          pattern, occasion, consumer_profile, trend_notes, location_country, location_city
        )
      `);
      // Re-index existing images
      const rows = db.prepare("SELECT id, description, garment_type, style, material, color_palette, pattern, occasion, consumer_profile, trend_notes, location_country, location_city FROM images").all() as Record<string, string>[];
      const insertFts = db.prepare(`
        INSERT INTO images_fts (id, description, garment_type, style, material, color_palette, pattern, occasion,
          consumer_profile, trend_notes, location_country, location_city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rows) {
        const colors = (() => { try { return JSON.parse(r.color_palette).join(" "); } catch { return r.color_palette || ""; } })();
        insertFts.run(r.id, r.description, r.garment_type, r.style, r.material, colors, r.pattern, r.occasion, r.consumer_profile, r.trend_notes, r.location_country, r.location_city);
      }
    }
  } catch {
    // FTS virtual tables don't support PRAGMA table_info on all SQLite versions — skip if check fails
  }
}

export function updateImageEmbedding(id: string, embedding: number[], embeddingText?: string): void {
  const db = getDb();
  if (embeddingText) {
    db.prepare("UPDATE images SET embedding = ?, embedding_text = ? WHERE id = ?").run(JSON.stringify(embedding), embeddingText, id);
  } else {
    db.prepare("UPDATE images SET embedding = ? WHERE id = ?").run(JSON.stringify(embedding), id);
  }
}

export function getAllImageEmbeddings(): { id: string; description: string; embeddingText: string; embedding: number[] }[] {
  const db = getDb();
  const rows = db.prepare("SELECT id, description, embedding_text, embedding FROM images WHERE embedding IS NOT NULL").all() as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    description: r.description as string,
    embeddingText: (r.embedding_text as string) || r.description as string,
    embedding: JSON.parse(r.embedding as string),
  }));
}

function rowToImageRecord(row: Record<string, unknown>): ImageRecord {
  const attributes: GarmentAttributes = {
    garment_type: row.garment_type as string,
    style: row.style as string,
    material: row.material as string,
    color_palette: JSON.parse(row.color_palette as string),
    pattern: row.pattern as string,
    season: row.season as string,
    occasion: row.occasion as string,
    consumer_profile: row.consumer_profile as string,
    trend_notes: row.trend_notes as string,
    location_continent: row.location_continent as string,
    location_country: row.location_country as string,
    location_city: row.location_city as string,
  };
  return {
    id: row.id as string,
    filename: row.filename as string,
    original_name: row.original_name as string,
    description: row.description as string,
    attributes,
    designer: row.designer as string,
    upload_date: row.upload_date as string,
    upload_year: row.upload_year as number,
    upload_month: row.upload_month as number,
    created_at: row.created_at as string,
  };
}
