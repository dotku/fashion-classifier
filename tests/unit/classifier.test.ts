import { parseClassificationOutput } from "../../lib/classifier";

describe("parseClassificationOutput", () => {
  it("parses valid JSON output into structured attributes", () => {
    const raw = JSON.stringify({
      description: "A beautiful red silk dress with floral embroidery, suitable for evening events.",
      attributes: {
        garment_type: "dress",
        style: "formal",
        material: "silk",
        color_palette: ["red", "gold"],
        pattern: "floral",
        season: "spring",
        occasion: "evening",
        consumer_profile: "luxury",
        trend_notes: "embroidered details trending in 2024",
        location_continent: "Asia",
        location_country: "Japan",
        location_city: "Tokyo",
      },
    });

    const result = parseClassificationOutput(raw);

    expect(result.description).toBe(
      "A beautiful red silk dress with floral embroidery, suitable for evening events."
    );
    expect(result.attributes.garment_type).toBe("dress");
    expect(result.attributes.style).toBe("formal");
    expect(result.attributes.material).toBe("silk");
    expect(result.attributes.color_palette).toEqual(["red", "gold"]);
    expect(result.attributes.pattern).toBe("floral");
    expect(result.attributes.season).toBe("spring");
    expect(result.attributes.occasion).toBe("evening");
    expect(result.attributes.consumer_profile).toBe("luxury");
    expect(result.attributes.trend_notes).toBe("embroidered details trending in 2024");
    expect(result.attributes.location_continent).toBe("Asia");
    expect(result.attributes.location_country).toBe("Japan");
    expect(result.attributes.location_city).toBe("Tokyo");
  });

  it("strips markdown code fences from output", () => {
    const raw = '```json\n{"description":"A denim jacket.","attributes":{"garment_type":"jacket","style":"streetwear","material":"denim","color_palette":["blue"],"pattern":"solid","season":"fall","occasion":"everyday","consumer_profile":"Gen Z","trend_notes":"","location_continent":"unknown","location_country":"unknown","location_city":"unknown"}}\n```';

    const result = parseClassificationOutput(raw);
    expect(result.attributes.garment_type).toBe("jacket");
    expect(result.attributes.material).toBe("denim");
  });

  it("handles missing attributes with defaults", () => {
    const raw = JSON.stringify({
      description: "A garment photo.",
      attributes: {
        garment_type: "shirt",
      },
    });

    const result = parseClassificationOutput(raw);
    expect(result.attributes.garment_type).toBe("shirt");
    expect(result.attributes.style).toBe("unknown");
    expect(result.attributes.material).toBe("unknown");
    expect(result.attributes.color_palette).toEqual([]);
    expect(result.attributes.pattern).toBe("unknown");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseClassificationOutput("not json")).toThrow();
  });

  it("throws when description is missing", () => {
    const raw = JSON.stringify({ attributes: { garment_type: "dress" } });
    expect(() => parseClassificationOutput(raw)).toThrow("Missing or invalid 'description' field");
  });

  it("throws when attributes is missing", () => {
    const raw = JSON.stringify({ description: "A dress." });
    expect(() => parseClassificationOutput(raw)).toThrow("Missing or invalid 'attributes' field");
  });
});
