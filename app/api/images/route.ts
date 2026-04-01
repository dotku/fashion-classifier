import { NextRequest, NextResponse } from "next/server";
import { getImages, getImage, getAllImageEmbeddings } from "@/lib/db";
import { generateEmbedding, cosineSimilarity, rerankResults, translateToEnglish, keywordBoost } from "@/lib/embeddings";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const image = getImage(id);
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      return NextResponse.json(image);
    }

    const search = searchParams.get("search") || undefined;
    const filters: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "search" && key !== "id") {
        filters[key] = value;
      }
    }

    // If search query exists, use RAG pipeline: translate → embed → retrieve → rerank
    if (search) {
      const allEmbeddings = getAllImageEmbeddings();
      const allFiltered = getImages(filters);

      if (allEmbeddings.length === 0) {
        // No embeddings yet — return filtered results without search ranking
        return NextResponse.json(allFiltered);
      }

      // Stage 1: Embed the query (multilingual model — no translation needed)
      const queryEmbedding = await generateEmbedding(search);

      // Stage 2: Retrieve — compute cosine similarity for all images
      const embeddingMap = new Map(allEmbeddings.map(e => [e.id, e]));
      const scored = allFiltered
        .filter(img => embeddingMap.has(img.id))
        .map(img => {
          const e = embeddingMap.get(img.id)!;
          const semanticScore = cosineSimilarity(queryEmbedding, e.embedding);
          const boost = keywordBoost(search, e.embeddingText);
          return {
            id: img.id,
            description: e.description,
            embeddingText: e.embeddingText,
            score: semanticScore + boost,
          };
        });
      scored.sort((a, b) => b.score - a.score);

      // Log scores with embedding text for debugging
      console.log("Search scores:", scored.map(s => ({
        id: s.id,
        score: s.score.toFixed(4),
        embeddingText: s.embeddingText.slice(0, 120),
      })));

      // Return all results above threshold, sorted by score (hybrid: semantic + keyword)
      const orderedIds = scored.filter(s => s.score > 0.15).map(s => s.id);

      const imageMap = new Map(allFiltered.map(img => [img.id, img]));
      const scoreMap = new Map(scored.map(s => [s.id, { score: s.score, embeddingText: s.embeddingText }]));
      const results = orderedIds
        .map(id => {
          const img = imageMap.get(id);
          if (!img) return null;
          const scoreData = scoreMap.get(id);
          return { ...img, _score: scoreData?.score ?? null, _embeddingText: scoreData?.embeddingText ?? null };
        })
        .filter(Boolean);
      return NextResponse.json(results);
    }

    const images = getImages(filters);
    return NextResponse.json(images);
  } catch (error) {
    console.error("Get images error:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}
