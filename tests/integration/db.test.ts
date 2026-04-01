import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

/**
 * Integration tests for the database layer.
 * Uses a temporary SQLite database that's created and destroyed per test suite.
 */

const TEST_DB_PATH = path.join(__dirname, "test_db.db");

// We test against a real DB but bypass the singleton in lib/db.ts
// to avoid polluting the dev database. We replicate the schema here.
function createTestDb(): Database.Database {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE images (
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

    CREATE TABLE annotations (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE images_fts USING fts5(
      id, description, garment_type, style, material, color_palette,
      pattern, occasion, consumer_profile, trend_notes, location_country, location_city
    );

    CREATE VIRTUAL TABLE annotations_fts USING fts5(
      id, image_id, tags, notes
    );
  `);

  return db;
}

function insertTestImage(db: Database.Database, overrides: Partial<{
  id: string; garment_type: string; style: string; material: string;
  pattern: string; season: string; occasion: string; description: string;
  location_continent: string; location_country: string; location_city: string;
  designer: string; upload_year: number; upload_month: number;
}> = {}) {
  const id = overrides.id || uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO images (id, filename, original_name, description, garment_type, style, material,
      color_palette, pattern, season, occasion, consumer_profile, trend_notes,
      location_continent, location_country, location_city, designer,
      upload_date, upload_year, upload_month, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, `${id}.jpg`, "test.jpg",
    overrides.description || "Test garment",
    overrides.garment_type || "dress",
    overrides.style || "casual",
    overrides.material || "cotton",
    '["black"]',
    overrides.pattern || "solid",
    overrides.season || "spring",
    overrides.occasion || "everyday",
    "young professional", "",
    overrides.location_continent || "Asia",
    overrides.location_country || "Japan",
    overrides.location_city || "Tokyo",
    overrides.designer || "Test Designer",
    now,
    overrides.upload_year || 2024,
    overrides.upload_month || 3,
    now
  );

  db.prepare(`
    INSERT INTO images_fts (id, description, garment_type, style, material, color_palette, pattern, occasion,
      consumer_profile, trend_notes, location_country, location_city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, overrides.description || "Test garment",
    overrides.garment_type || "dress",
    overrides.style || "casual",
    overrides.material || "cotton",
    "black",
    overrides.pattern || "solid",
    overrides.occasion || "everyday",
    "young professional", "",
    overrides.location_country || "Japan",
    overrides.location_city || "Tokyo"
  );

  return id;
}

describe("Database layer", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  describe("insertImage and getImage", () => {
    it("inserts and retrieves an image by id", () => {
      const id = insertTestImage(db, { garment_type: "jacket", material: "denim" });
      const row = db.prepare("SELECT * FROM images WHERE id = ?").get(id) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.garment_type).toBe("jacket");
      expect(row.material).toBe("denim");
    });

    it("returns undefined for non-existent id", () => {
      const row = db.prepare("SELECT * FROM images WHERE id = ?").get("nonexistent");
      expect(row).toBeUndefined();
    });
  });

  describe("getImages with filters", () => {
    beforeAll(() => {
      insertTestImage(db, { garment_type: "coat", style: "minimalist", material: "wool", location_country: "Italy" });
      insertTestImage(db, { garment_type: "blouse", style: "bohemian", material: "linen", location_country: "India" });
      insertTestImage(db, { garment_type: "dress", style: "formal", material: "silk", location_country: "Japan" });
    });

    it("returns all images with no filters", () => {
      const rows = db.prepare("SELECT * FROM images").all();
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it("filters by garment_type with LIKE (partial match)", () => {
      const rows = db.prepare("SELECT * FROM images WHERE garment_type LIKE ?").all("%dress%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by material with LIKE (partial match)", () => {
      const rows = db.prepare("SELECT * FROM images WHERE material LIKE ?").all("%silk%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("combines multiple LIKE filters", () => {
      const rows = db.prepare(
        "SELECT * FROM images WHERE garment_type LIKE ? AND location_country LIKE ?"
      ).all("%dress%", "%Japan%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("deleteImage", () => {
    it("deletes an image and its FTS entry", () => {
      const id = insertTestImage(db, { garment_type: "shorts" });

      // Verify it exists
      expect(db.prepare("SELECT * FROM images WHERE id = ?").get(id)).toBeDefined();
      expect(db.prepare("SELECT * FROM images_fts WHERE id = ?").get(id)).toBeDefined();

      // Delete
      db.prepare("DELETE FROM images WHERE id = ?").run(id);
      db.prepare("DELETE FROM images_fts WHERE id = ?").run(id);

      // Verify deletion
      expect(db.prepare("SELECT * FROM images WHERE id = ?").get(id)).toBeUndefined();
      expect(db.prepare("SELECT * FROM images_fts WHERE id = ?").get(id)).toBeUndefined();
    });
  });

  describe("annotations", () => {
    it("inserts and retrieves annotations for an image", () => {
      const imageId = insertTestImage(db, { garment_type: "sweater" });
      const annotId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO annotations (id, image_id, tags, notes, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(annotId, imageId, JSON.stringify(["cozy", "winter"]), "Great for layering", now);

      const rows = db.prepare("SELECT * FROM annotations WHERE image_id = ?").all(imageId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].tags as string)).toEqual(["cozy", "winter"]);
      expect(rows[0].notes).toBe("Great for layering");
    });
  });

  describe("embeddings", () => {
    it("stores and retrieves embedding data", () => {
      const id = insertTestImage(db, { garment_type: "shirt" });
      const embedding = [0.1, 0.2, 0.3, 0.4];
      const embeddingText = "A casual cotton shirt";

      db.prepare("UPDATE images SET embedding = ?, embedding_text = ? WHERE id = ?")
        .run(JSON.stringify(embedding), embeddingText, id);

      const row = db.prepare("SELECT embedding, embedding_text FROM images WHERE id = ?").get(id) as Record<string, unknown>;
      expect(JSON.parse(row.embedding as string)).toEqual(embedding);
      expect(row.embedding_text).toBe(embeddingText);
    });

    it("can query images with embeddings", () => {
      const rows = db.prepare("SELECT id FROM images WHERE embedding IS NOT NULL").all();
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getFilterOptions (DISTINCT queries)", () => {
    it("returns distinct garment types", () => {
      const rows = db.prepare(
        "SELECT DISTINCT garment_type FROM images WHERE garment_type != '' ORDER BY garment_type"
      ).all() as { garment_type: string }[];
      const values = rows.map(r => r.garment_type);
      expect(values).toContain("dress");
      expect(values).toContain("coat");
      expect(values).toContain("blouse");
    });

    it("returns distinct materials", () => {
      const rows = db.prepare(
        "SELECT DISTINCT material FROM images WHERE material != '' ORDER BY material"
      ).all() as { material: string }[];
      const values = rows.map(r => r.material);
      expect(values).toContain("cotton");
      expect(values).toContain("silk");
      expect(values).toContain("wool");
    });

    it("returns distinct countries", () => {
      const rows = db.prepare(
        "SELECT DISTINCT location_country FROM images WHERE location_country != '' ORDER BY location_country"
      ).all() as { location_country: string }[];
      const values = rows.map(r => r.location_country);
      expect(values).toContain("Japan");
      expect(values).toContain("Italy");
    });
  });

  describe("full-text search", () => {
    it("finds images by description keyword", () => {
      insertTestImage(db, { description: "Elegant embroidered evening gown with sequins" });
      const rows = db.prepare("SELECT id FROM images_fts WHERE images_fts MATCH ?").all("embroidered");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("finds images by garment type in FTS", () => {
      const rows = db.prepare("SELECT id FROM images_fts WHERE images_fts MATCH ?").all("blouse");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
