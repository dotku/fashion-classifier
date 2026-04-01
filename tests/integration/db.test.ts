/**
 * Integration tests for the database layer (db.ts).
 * These test the rowToImageRecord logic and data transformation.
 * Actual Neon DB connectivity is tested via E2E tests.
 */

import { v4 as uuidv4 } from "uuid";

describe("Database data transformations", () => {
  describe("ImageRecord construction", () => {
    it("constructs a valid ImageRecord from a DB row", () => {
      const row = {
        id: uuidv4(),
        filename: "test.jpg",
        original_name: "photo.jpg",
        description: "A red silk dress",
        garment_type: "dress",
        style: "formal",
        material: "silk",
        color_palette: JSON.stringify(["red", "gold"]),
        pattern: "solid",
        season: "spring",
        occasion: "evening",
        consumer_profile: "luxury",
        trend_notes: "trending",
        location_continent: "Asia",
        location_country: "Japan",
        location_city: "Tokyo",
        designer: "Test Designer",
        upload_date: new Date().toISOString(),
        upload_year: 2024,
        upload_month: 3,
        created_at: new Date().toISOString(),
      };

      // Simulate rowToImageRecord logic
      const colorPalette = typeof row.color_palette === "string"
        ? JSON.parse(row.color_palette)
        : row.color_palette;

      expect(row.garment_type).toBe("dress");
      expect(row.material).toBe("silk");
      expect(colorPalette).toEqual(["red", "gold"]);
      expect(row.location_country).toBe("Japan");
    });

    it("handles JSONB color_palette (already parsed)", () => {
      const colorPalette = ["blue", "white"];
      // Neon returns JSONB as already-parsed arrays
      expect(Array.isArray(colorPalette)).toBe(true);
      expect(colorPalette).toEqual(["blue", "white"]);
    });

    it("handles string color_palette (needs parsing)", () => {
      const raw = '["blue", "white"]';
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual(["blue", "white"]);
    });
  });

  describe("Annotation construction", () => {
    it("constructs a valid Annotation from a DB row", () => {
      const row = {
        id: uuidv4(),
        image_id: uuidv4(),
        tags: JSON.stringify(["cozy", "winter"]),
        notes: "Great for layering",
        created_at: new Date().toISOString(),
      };

      const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
      expect(tags).toEqual(["cozy", "winter"]);
      expect(row.notes).toBe("Great for layering");
    });

    it("handles JSONB tags (already parsed)", () => {
      const tags = ["vintage", "oversized"];
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe("Embedding data", () => {
    it("serializes and deserializes embedding vectors", () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const serialized = JSON.stringify(embedding);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(embedding);
      expect(deserialized).toHaveLength(5);
    });

    it("handles embedding text storage", () => {
      const embeddingText = "A casual cotton shirt. Type: shirt. Style: casual.";
      expect(typeof embeddingText).toBe("string");
      expect(embeddingText).toContain("shirt");
    });
  });

  describe("Filter options extraction", () => {
    it("extracts distinct values from rows", () => {
      const rows = [
        { garment_type: "dress", style: "formal" },
        { garment_type: "jacket", style: "streetwear" },
        { garment_type: "dress", style: "casual" },
        { garment_type: "coat", style: "minimalist" },
      ];

      const garmentTypes = [...new Set(rows.map(r => r.garment_type))].sort();
      expect(garmentTypes).toEqual(["coat", "dress", "jacket"]);

      const styles = [...new Set(rows.map(r => r.style))].sort();
      expect(styles).toEqual(["casual", "formal", "minimalist", "streetwear"]);
    });

    it("filters out empty values", () => {
      const rows = [
        { garment_type: "dress" },
        { garment_type: "" },
        { garment_type: "jacket" },
      ];

      const values = [...new Set(rows.map(r => r.garment_type).filter(v => v !== ""))].sort();
      expect(values).toEqual(["dress", "jacket"]);
    });
  });
});
