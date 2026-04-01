import { NextRequest, NextResponse } from "next/server";
import { getImages, getImage, getAllImageEmbeddings, getSearchFeedback, getFirmedImpressions, recordImpressions } from "@/lib/db";
import { generateEmbedding, cosineSimilarity, rerankResults } from "@/lib/embeddings";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const image = await getImage(id);
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
      const allEmbeddings = await getAllImageEmbeddings();
      const allFiltered = await getImages(filters);

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
          const score = cosineSimilarity(queryEmbedding, e.embedding);
          return {
            id: img.id,
            description: e.description,
            embeddingText: e.embeddingText,
            score,
          };
        });
      scored.sort((a, b) => b.score - a.score);

      // Take top candidates by semantic score for LLM reranking
      const topCandidates = scored.slice(0, 40);

      // Stage 3: Rerank — LLM filters and ranks by true relevance
      const rerankedIds = await rerankResults(
        search,
        topCandidates.map(s => ({ id: s.id, description: s.embeddingText, score: s.score })),
        20
      );

      // Stage 4: Apply firmed impressions (auto-firm or admin override)
      const firmed = await getFirmedImpressions(search);
      const firmedMap = new Map(firmed.map(f => [f.image_id, f]));

      // Stage 5: Apply per-user feedback on top
      const feedback = await getSearchFeedback(search);
      const feedbackMap = new Map(feedback.map(f => [f.image_id, f]));

      const imageMap = new Map(allFiltered.map(img => [img.id, img]));
      const scoreMap = new Map(scored.map(s => [s.id, { score: s.score, embeddingText: s.embeddingText }]));

      const results = rerankedIds
        .map(id => {
          // Check firmed action first (admin override takes priority)
          const firm = firmedMap.get(id);
          const firmAction = firm?.admin_override || firm?.firm_action;
          if (firmAction === "remove") return null;

          const fb = feedbackMap.get(id);
          // Individual rating -2 also removes
          if (fb && fb.rating <= -2) return null;

          const img = imageMap.get(id);
          if (!img) return null;
          const scoreData = scoreMap.get(id);
          let adjustedScore = scoreData?.score ?? 0;

          // Apply firmed adjustments
          if (firmAction === "penalize") adjustedScore -= 0.2;
          else if (firmAction === "boost") adjustedScore += 0.2;

          // Apply individual feedback on top
          if (fb) adjustedScore += fb.rating * 0.15;

          return {
            ...img,
            _score: adjustedScore,
            _embeddingText: scoreData?.embeddingText ?? null,
            _feedback: fb ? { rating: fb.rating, comment: fb.comment } : null,
            _firm: firm ? { action: firmAction, avgRating: firm.avg_rating, feedbackCount: firm.feedback_count, displayCount: firm.display_count } : null,
          };
        })
        .filter(Boolean);

      // Re-sort by adjusted score
      results.sort((a, b) => (b as { _score: number })._score - (a as { _score: number })._score);

      // Record impressions for all displayed results
      const displayedIds = results.map(r => (r as { id: string }).id);
      recordImpressions(search, displayedIds).catch(err =>
        console.error("Failed to record impressions:", err)
      );

      console.log("Search:", {
        query: search,
        candidates: topCandidates.length,
        reranked: rerankedIds.length,
        firmedApplied: firmed.length,
        feedbackApplied: feedback.length,
        finalResults: results.length,
      });

      return NextResponse.json(results);
    }

    const images = await getImages(filters);
    return NextResponse.json(images);
  } catch (error) {
    console.error("Get images error:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}
