import OpenAI from "openai";
import { ImageRecord } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _client;
}

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const RERANK_MODEL = "anthropic/claude-haiku-4-5";
const TRANSLATE_MODEL = "anthropic/claude-haiku-4-5";

/**
 * Detect if text contains non-English characters and translate to English if needed.
 */
export async function translateToEnglish(text: string): Promise<string> {
  // Quick check: if text is mostly ASCII, skip translation
  const nonAscii = text.replace(/[\x00-\x7F]/g, "").length;
  if (nonAscii === 0) return text;

  try {
    const response = await getClient().chat.completions.create({
      model: TRANSLATE_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Translate the following fashion search query to English. Return ONLY the English translation, nothing else.\n\n"${text}"`,
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

/**
 * Build a single text blob from an image record for embedding.
 */
export function buildEmbeddingText(record: {
  description: string;
  attributes: Record<string, unknown>;
  annotations?: { tags: string[]; notes: string }[];
}): string {
  const attrs = record.attributes;
  const parts = [
    record.description,
    `Type: ${attrs.garment_type}`,
    `Style: ${attrs.style}`,
    `Material: ${attrs.material}`,
    `Colors: ${Array.isArray(attrs.color_palette) ? (attrs.color_palette as string[]).join(", ") : attrs.color_palette}`,
    `Pattern: ${attrs.pattern}`,
    `Season: ${attrs.season}`,
    `Occasion: ${attrs.occasion}`,
    `Consumer: ${attrs.consumer_profile}`,
    `Trends: ${attrs.trend_notes}`,
  ];
  if (record.annotations?.length) {
    const tagStr = record.annotations.flatMap(a => a.tags).join(", ");
    const noteStr = record.annotations.map(a => a.notes).filter(Boolean).join(". ");
    if (tagStr) parts.push(`Tags: ${tagStr}`);
    if (noteStr) parts.push(`Notes: ${noteStr}`);
  }
  return parts.filter(Boolean).join(". ");
}

/**
 * Generate an embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Keyword boost: adds score when search terms appear in the embedding text.
 * Maps common terms across languages (Chinese → English).
 */
const TERM_MAP: Record<string, string[]> = {
  // Colors
  "红": ["red"], "红色": ["red"], "蓝": ["blue"], "蓝色": ["blue"],
  "绿": ["green"], "绿色": ["green"], "黄": ["yellow"], "黄色": ["yellow"],
  "黑": ["black"], "黑色": ["black"], "白": ["white"], "白色": ["white"],
  "粉": ["pink"], "粉色": ["pink"], "紫": ["purple"], "紫色": ["purple"],
  "橙": ["orange"], "橙色": ["orange"], "灰": ["gray", "grey"], "灰色": ["gray", "grey"],
  "棕": ["brown"], "棕色": ["brown"], "金": ["gold"], "金色": ["gold"],
  "银": ["silver"], "银色": ["silver"], "米": ["beige", "cream"], "米色": ["beige", "cream"],
  // Garment types
  "裙": ["dress", "skirt"], "裙子": ["dress", "skirt"], "连衣裙": ["dress"],
  "外套": ["jacket", "coat"], "夹克": ["jacket"], "大衣": ["coat"],
  "裤": ["pants", "trousers"], "裤子": ["pants", "trousers"], "短裤": ["shorts"],
  "衬衫": ["shirt", "blouse"], "T恤": ["t-shirt"], "毛衣": ["sweater"],
  "西装": ["suit"], "背心": ["vest"],
  // Styles
  "休闲": ["casual"], "正式": ["formal"], "运动": ["athletic", "sport"],
  "复古": ["vintage", "retro"], "简约": ["minimalist"],
  "街头": ["streetwear", "street"], "波西米亚": ["bohemian"],
  // Materials
  "棉": ["cotton"], "丝": ["silk"], "丝绸": ["silk"],
  "牛仔": ["denim"], "皮": ["leather"], "皮革": ["leather"],
  "羊毛": ["wool"], "亚麻": ["linen"], "针织": ["knit"],
  // Patterns
  "条纹": ["striped", "stripe"], "花": ["floral", "flower"],
  "格子": ["plaid", "check"], "纯色": ["solid"],
  "几何": ["geometric"], "豹纹": ["leopard", "animal print"],
  // Seasons
  "春": ["spring"], "夏": ["summer"], "秋": ["fall", "autumn"], "冬": ["winter"],
  // Occasions
  "日常": ["everyday", "casual"], "晚装": ["evening"], "婚礼": ["wedding"],
  "工作": ["work", "workwear"], "运动": ["athletic"],
};

/**
 * Check if a word appears in text (partial match counts).
 */
function matchesKeyword(text: string, word: string): boolean {
  return text.toLowerCase().includes(word.toLowerCase());
}

export function keywordBoost(query: string, embeddingText: string): number {
  const lowerText = embeddingText.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  let boost = 0;

  // Direct whole-word match in embedding text
  if (matchesKeyword(lowerText, lowerQuery)) {
    boost += 0.3;
  }

  // Multilingual term mapping
  const mappedTerms = TERM_MAP[lowerQuery];
  if (mappedTerms && mappedTerms.some(t => matchesKeyword(lowerText, t))) {
    boost += 0.3;
  }

  // Check each word individually (both single and multi-word queries)
  const words = lowerQuery.split(/\s+/).filter(Boolean);
  let matchCount = 0;
  for (const w of words) {
    const mapped = TERM_MAP[w];
    if (matchesKeyword(lowerText, w) || (mapped && mapped.some(t => matchesKeyword(lowerText, t)))) {
      matchCount++;
    }
  }
  if (matchCount > 0) {
    boost += (matchCount / words.length) * 0.3;
  }

  return Math.min(boost, 0.5);
}

/**
 * Rerank top candidates using an LLM for relevance scoring.
 */
export async function rerankResults(
  query: string,
  candidates: { id: string; description: string; score: number }[],
  topK: number = 20
): Promise<string[]> {
  if (candidates.length === 0) return [];

  // Take more candidates than needed for reranking
  const toRerank = candidates.slice(0, Math.min(candidates.length, topK * 2));

  const prompt = `You are a strict fashion search relevance ranker. Given a search query and a list of garment descriptions, return ONLY the IDs that genuinely match the query. Exclude items that do not match.

Rules:
- If the query mentions a color, the garment MUST contain that color
- If the query mentions a garment type, the item MUST be that type
- Do NOT include loosely related items — only include clear matches
- If no candidates match, return an empty array []

Search query: "${query}"

Candidates:
${toRerank.map((c, i) => `[${c.id}] ${c.description}`).join("\n")}

Return ONLY a JSON array of matching IDs in order of relevance (most relevant first). Return at most ${topK} IDs. No extra text.`;

  try {
    const response = await getClient().chat.completions.create({
      model: RERANK_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content || "[]";
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const rankedIds: string[] = JSON.parse(cleaned);
    return rankedIds.slice(0, topK);
  } catch (err) {
    console.error("Rerank failed, falling back to embedding order:", err);
    return toRerank.slice(0, topK).map(c => c.id);
  }
}
