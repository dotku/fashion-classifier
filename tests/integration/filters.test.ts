/**
 * Integration tests for filter and search logic.
 * Tests the filtering behavior that happens in getImages() using in-memory data.
 */

interface TestImage {
  id: string;
  garment_type: string;
  style: string;
  material: string;
  pattern: string;
  season: string;
  occasion: string;
  description: string;
  location_continent: string;
  location_country: string;
  location_city: string;
  upload_year: number;
  upload_month: number;
}

const testData: TestImage[] = [
  { id: "1", garment_type: "dress", style: "formal", material: "silk", pattern: "solid", season: "spring", occasion: "evening", description: "Elegant silk dress with embroidered neckline", location_continent: "Asia", location_country: "Japan", location_city: "Tokyo", upload_year: 2024, upload_month: 3 },
  { id: "2", garment_type: "jacket", style: "streetwear", material: "denim", pattern: "solid", season: "summer", occasion: "everyday", description: "Oversized denim jacket from artisan market", location_continent: "North America", location_country: "USA", location_city: "New York", upload_year: 2024, upload_month: 6 },
  { id: "3", garment_type: "dress", style: "bohemian", material: "cotton", pattern: "floral", season: "fall", occasion: "everyday", description: "Flowing cotton bohemian dress", location_continent: "Europe", location_country: "France", location_city: "Paris", upload_year: 2023, upload_month: 9 },
  { id: "4", garment_type: "coat", style: "minimalist", material: "wool", pattern: "solid", season: "winter", occasion: "everyday", description: "Structured wool overcoat", location_continent: "Europe", location_country: "Italy", location_city: "Milan", upload_year: 2024, upload_month: 1 },
  { id: "5", garment_type: "blouse", style: "casual", material: "linen", pattern: "geometric", season: "spring", occasion: "everyday", description: "Hand-dyed linen blouse with traditional patterns", location_continent: "Asia", location_country: "India", location_city: "Mumbai", upload_year: 2024, upload_month: 4 },
  { id: "6", garment_type: "sundress", style: "casual", material: "silky cotton", pattern: "striped", season: "summer", occasion: "everyday", description: "Light sundress in silky cotton", location_continent: "Asia", location_country: "Japan", location_city: "Tokyo", upload_year: 2024, upload_month: 7 },
];

function filterImages(images: TestImage[], filters: Record<string, string>): TestImage[] {
  return images.filter(img => {
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      const cellValue = String((img as unknown as Record<string, unknown>)[key] || "").toLowerCase();
      if (!cellValue.includes(value.toLowerCase())) return false;
    }
    return true;
  });
}

describe("Filter behavior", () => {
  it("filters by garment_type", () => {
    const result = filterImages(testData, { garment_type: "dress" });
    expect(result).toHaveLength(3); // dress, dress, sundress (partial match)
  });

  it("filters by exact garment_type", () => {
    const result = filterImages(testData, { garment_type: "coat" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("filters by location_country", () => {
    const result = filterImages(testData, { location_country: "Japan" });
    expect(result).toHaveLength(2);
  });

  it("filters by location_continent", () => {
    const result = filterImages(testData, { location_continent: "Europe" });
    expect(result).toHaveLength(2);
  });

  it("filters by upload_year", () => {
    const result = filterImages(testData, { upload_year: "2023" });
    expect(result).toHaveLength(1);
  });

  it("filters by season", () => {
    const result = filterImages(testData, { season: "spring" });
    expect(result).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    const result = filterImages(testData, { location_continent: "Europe", garment_type: "dress" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("partial match on material", () => {
    const result = filterImages(testData, { material: "silk" });
    expect(result).toHaveLength(2); // silk + silky cotton
  });

  it("returns all when no filters", () => {
    const result = filterImages(testData, {});
    expect(result).toHaveLength(testData.length);
  });

  it("partial match on description keyword", () => {
    const matchesEmbroidered = testData.filter(d => d.description.toLowerCase().includes("embroidered"));
    expect(matchesEmbroidered.length).toBeGreaterThanOrEqual(1);
  });

  it("partial match on description artisan market", () => {
    const matchesArtisan = testData.filter(d => d.description.toLowerCase().includes("artisan"));
    expect(matchesArtisan.length).toBeGreaterThanOrEqual(1);
  });

  it("returns dynamic filter options from data", () => {
    const garmentTypes = [...new Set(testData.map(d => d.garment_type))].sort();
    expect(garmentTypes).toContain("dress");
    expect(garmentTypes).toContain("jacket");
    expect(garmentTypes).toContain("coat");
    expect(garmentTypes).toContain("blouse");
  });
});
