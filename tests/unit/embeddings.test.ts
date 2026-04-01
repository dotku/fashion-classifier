import { buildEmbeddingText, cosineSimilarity, keywordBoost } from "../../lib/embeddings";

describe("buildEmbeddingText", () => {
  it("builds text from description and attributes", () => {
    const text = buildEmbeddingText({
      description: "A red silk dress.",
      attributes: {
        garment_type: "dress",
        style: "formal",
        material: "silk",
        color_palette: ["red", "gold"],
        pattern: "solid",
        season: "spring",
        occasion: "evening",
        consumer_profile: "luxury",
        trend_notes: "trending",
      },
    });

    expect(text).toContain("A red silk dress.");
    expect(text).toContain("Type: dress");
    expect(text).toContain("Style: formal");
    expect(text).toContain("Material: silk");
    expect(text).toContain("Colors: red, gold");
    expect(text).toContain("Pattern: solid");
    expect(text).toContain("Season: spring");
    expect(text).toContain("Occasion: evening");
    expect(text).toContain("Consumer: luxury");
    expect(text).toContain("Trends: trending");
  });

  it("includes annotations when provided", () => {
    const text = buildEmbeddingText({
      description: "A jacket.",
      attributes: { garment_type: "jacket" },
      annotations: [
        { tags: ["vintage", "oversized"], notes: "Great for layering" },
      ],
    });

    expect(text).toContain("Tags: vintage, oversized");
    expect(text).toContain("Notes: Great for layering");
  });

  it("handles empty annotations", () => {
    const text = buildEmbeddingText({
      description: "A jacket.",
      attributes: { garment_type: "jacket" },
      annotations: [],
    });

    expect(text).not.toContain("Tags:");
    expect(text).not.toContain("Notes:");
  });

  it("handles color_palette as string (non-array)", () => {
    const text = buildEmbeddingText({
      description: "A shirt.",
      attributes: {
        garment_type: "shirt",
        color_palette: "blue" as unknown,
      },
    });

    expect(text).toContain("Colors: blue");
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it("computes correct similarity for arbitrary vectors", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 32, |a| = sqrt(14), |b| = sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected);
  });
});

describe("keywordBoost", () => {
  const sampleText = "Type: dress. Style: formal. Material: silk. Colors: red, gold. Pattern: floral. Season: spring. Occasion: evening.";

  it("boosts for exact keyword match", () => {
    expect(keywordBoost("dress", sampleText)).toBeGreaterThan(0);
  });

  it("boosts for partial keyword match", () => {
    expect(keywordBoost("silk", sampleText)).toBeGreaterThan(0);
  });

  it("returns 0 for non-matching keyword", () => {
    expect(keywordBoost("denim", sampleText)).toBe(0);
  });

  it("boosts for Chinese color term", () => {
    expect(keywordBoost("红", sampleText)).toBeGreaterThan(0);
  });

  it("boosts for Chinese garment type", () => {
    expect(keywordBoost("裙", sampleText)).toBeGreaterThan(0);
  });

  it("handles multi-word queries", () => {
    expect(keywordBoost("red dress", sampleText)).toBeGreaterThan(0);
  });

  it("caps boost at 0.5", () => {
    expect(keywordBoost("dress", sampleText)).toBeLessThanOrEqual(0.5);
    expect(keywordBoost("red dress formal silk", sampleText)).toBeLessThanOrEqual(0.5);
  });

  it("partial match works for substrings", () => {
    const text = "Type: sundress. Material: silky cotton.";
    expect(keywordBoost("dress", text)).toBeGreaterThan(0);
    expect(keywordBoost("silk", text)).toBeGreaterThan(0);
  });
});
