import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// We test the database layer directly for integration tests
// We need to set up a temporary database for testing

describe("Filter behavior", () => {
  let db: Database.Database;

  beforeAll(() => {
    const testDbPath = path.join(__dirname, "test_filters.db");
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    db.pragma("journal_mode = WAL");

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
        upload_date TEXT NOT NULL,
        upload_year INTEGER NOT NULL,
        upload_month INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
        id, description, garment_type, style, material, pattern, occasion,
        consumer_profile, trend_notes, location_country, location_city
      );
    `);

    // Insert test data
    const insertImage = db.prepare(`
      INSERT INTO images (id, filename, original_name, description, garment_type, style, material,
        color_palette, pattern, season, occasion, consumer_profile, trend_notes,
        location_continent, location_country, location_city, designer,
        upload_date, upload_year, upload_month, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFts = db.prepare(`
      INSERT INTO images_fts (id, description, garment_type, style, material, pattern, occasion,
        consumer_profile, trend_notes, location_country, location_city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testData = [
      { type: "dress", style: "formal", material: "silk", continent: "Asia", country: "Japan", city: "Tokyo", year: 2024, month: 3, season: "spring", desc: "Elegant silk dress with embroidered neckline" },
      { type: "jacket", style: "streetwear", material: "denim", continent: "North America", country: "USA", city: "New York", year: 2024, month: 6, season: "summer", desc: "Oversized denim jacket from artisan market" },
      { type: "dress", style: "bohemian", material: "cotton", continent: "Europe", country: "France", city: "Paris", year: 2023, month: 9, season: "fall", desc: "Flowing cotton bohemian dress" },
      { type: "coat", style: "minimalist", material: "wool", continent: "Europe", country: "Italy", city: "Milan", year: 2024, month: 1, season: "winter", desc: "Structured wool overcoat" },
      { type: "blouse", style: "casual", material: "linen", continent: "Asia", country: "India", city: "Mumbai", year: 2024, month: 4, season: "spring", desc: "Hand-dyed linen blouse with traditional patterns" },
    ];

    for (const d of testData) {
      const id = uuidv4();
      insertImage.run(id, `${id}.jpg`, "test.jpg", d.desc, d.type, d.style, d.material,
        '["black"]', "solid", d.season, "everyday", "young professional", "",
        d.continent, d.country, d.city, "Test Designer",
        new Date().toISOString(), d.year, d.month, new Date().toISOString());
      insertFts.run(id, d.desc, d.type, d.style, d.material, "solid", "everyday",
        "young professional", "", d.country, d.city);
    }
  });

  afterAll(() => {
    db.close();
    const testDbPath = path.join(__dirname, "test_filters.db");
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it("filters by garment_type", () => {
    const rows = db.prepare("SELECT * FROM images WHERE garment_type = ?").all("dress");
    expect(rows).toHaveLength(2);
  });

  it("filters by location_country", () => {
    const rows = db.prepare("SELECT * FROM images WHERE location_country = ?").all("Japan");
    expect(rows).toHaveLength(1);
  });

  it("filters by location_continent", () => {
    const rows = db.prepare("SELECT * FROM images WHERE location_continent = ?").all("Europe");
    expect(rows).toHaveLength(2);
  });

  it("filters by upload_year (time filter)", () => {
    const rows = db.prepare("SELECT * FROM images WHERE upload_year = ?").all(2023);
    expect(rows).toHaveLength(1);
  });

  it("filters by season", () => {
    const rows = db.prepare("SELECT * FROM images WHERE season = ?").all("spring");
    expect(rows).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    const rows = db.prepare(
      "SELECT * FROM images WHERE location_continent = ? AND garment_type = ?"
    ).all("Europe", "dress");
    expect(rows).toHaveLength(1);
  });

  it("supports full-text search on descriptions", () => {
    const rows = db.prepare(
      "SELECT id FROM images_fts WHERE images_fts MATCH ?"
    ).all("embroidered neckline");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("supports full-text search for artisan market", () => {
    const rows = db.prepare(
      "SELECT id FROM images_fts WHERE images_fts MATCH ?"
    ).all("artisan market");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("returns dynamic filter options from data", () => {
    const garmentTypes = db.prepare(
      "SELECT DISTINCT garment_type FROM images WHERE garment_type != '' ORDER BY garment_type"
    ).all() as { garment_type: string }[];
    const values = garmentTypes.map(r => r.garment_type);
    expect(values).toContain("dress");
    expect(values).toContain("jacket");
    expect(values).toContain("coat");
    expect(values).toContain("blouse");
  });
});
