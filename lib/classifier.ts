import OpenAI from "openai";
import { ClassificationResult, GarmentAttributes } from "./types";
import fs from "fs";

const openrouterClient = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const geminiClient = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: process.env.GEMINI_API_KEY,
});

function getClient(model: string): { client: OpenAI; modelId: string } {
  if (model.startsWith("gemini-")) {
    return { client: geminiClient, modelId: model };
  }
  return { client: openrouterClient, modelId: model };
}

const CLASSIFICATION_PROMPT = `You are a fashion garment classifier. Analyze this image and return a JSON object with two fields:

1. "description": A rich natural-language description (2-4 sentences) covering the garment's design, construction details, fabric impression, styling context, and any notable elements.

2. "attributes": An object with these exact keys:
  - "garment_type": e.g. "dress", "jacket", "pants", "skirt", "blouse", "coat", "sweater", "shirt", "shorts", "suit"
  - "style": e.g. "casual", "formal", "streetwear", "bohemian", "minimalist", "vintage", "athletic", "avant-garde"
  - "material": e.g. "cotton", "silk", "denim", "leather", "wool", "polyester", "linen", "knit"
  - "color_palette": array of primary colors, e.g. ["black", "white"] or ["navy", "gold"]
  - "pattern": e.g. "solid", "striped", "floral", "plaid", "geometric", "abstract", "animal print"
  - "season": e.g. "spring", "summer", "fall", "winter", "all-season"
  - "occasion": e.g. "everyday", "workwear", "evening", "wedding", "festival", "resort", "athletic"
  - "consumer_profile": e.g. "young professional", "Gen Z", "luxury", "budget-conscious", "mature"
  - "trend_notes": brief note on trend relevance, e.g. "oversized silhouette trending in 2024"
  - "location_continent": if you can infer from context, e.g. "Asia", "Europe"; otherwise "unknown"
  - "location_country": if you can infer, e.g. "Japan", "Italy"; otherwise "unknown"
  - "location_city": if you can infer, e.g. "Tokyo", "Milan"; otherwise "unknown"

Return ONLY valid JSON. No markdown code fences, no extra text.`;

export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Free)", provider: "gemini" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", provider: "openrouter" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "openrouter" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "openrouter" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "openrouter" },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano VL (Free)", provider: "openrouter" },
] as const;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;

export async function classifyImage(imagePath: string, model: string = DEFAULT_MODEL): Promise<ClassificationResult> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = imagePath.split(".").pop()?.toLowerCase() || "jpeg";
  const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

  const { client, modelId } = getClient(model);
  const response = await client.chat.completions.create({
    model: modelId,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${base64}` },
          },
          { type: "text", text: CLASSIFICATION_PROMPT },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  const finishReason = response.choices[0]?.finish_reason;
  if (!text) {
    throw new Error("No text response from classifier");
  }

  if (finishReason === "length") {
    console.warn("Classifier response was truncated (finish_reason: length). Raw:", text.slice(-100));
  }

  return parseClassificationOutput(text);
}

export function parseClassificationOutput(raw: string): ClassificationResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Try to extract JSON object if there's extra text around it
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse classifier output. Raw response:", raw);
    throw new Error("Invalid JSON from classifier");
  }

  if (!parsed.description || typeof parsed.description !== "string") {
    throw new Error("Missing or invalid 'description' field");
  }
  if (!parsed.attributes || typeof parsed.attributes !== "object") {
    throw new Error("Missing or invalid 'attributes' field");
  }

  const attrs = parsed.attributes;
  const result: ClassificationResult = {
    description: parsed.description,
    attributes: {
      garment_type: String(attrs.garment_type || "unknown"),
      style: String(attrs.style || "unknown"),
      material: String(attrs.material || "unknown"),
      color_palette: Array.isArray(attrs.color_palette) ? attrs.color_palette.map(String) : [],
      pattern: String(attrs.pattern || "unknown"),
      season: String(attrs.season || "unknown"),
      occasion: String(attrs.occasion || "unknown"),
      consumer_profile: String(attrs.consumer_profile || "unknown"),
      trend_notes: String(attrs.trend_notes || ""),
      location_continent: String(attrs.location_continent || "unknown"),
      location_country: String(attrs.location_country || "unknown"),
      location_city: String(attrs.location_city || "unknown"),
    },
  };

  return result;
}
