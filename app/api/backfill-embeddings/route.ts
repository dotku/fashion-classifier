import { NextResponse } from "next/server";
import { getImages, getAnnotations, updateImageEmbedding } from "@/lib/db";
import { generateEmbedding, buildEmbeddingText } from "@/lib/embeddings";

export async function POST() {
  try {
    // Re-embed ALL images to include any annotations
    const images = await getImages();

    if (images.length === 0) {
      return NextResponse.json({ message: "No images to embed", updated: 0 });
    }

    let updated = 0;
    for (const image of images) {
      try {
        const annotations = await getAnnotations(image.id);
        const text = buildEmbeddingText({
          description: image.description,
          attributes: image.attributes,
          annotations: annotations.map(a => ({ tags: a.tags, notes: a.notes })),
        });
        const embedding = await generateEmbedding(text);
        await updateImageEmbedding(image.id, embedding, text);
        updated++;
      } catch (err) {
        console.error(`Failed to generate embedding for ${image.id}:`, err);
      }
    }

    return NextResponse.json({ message: `Embedded ${updated}/${images.length} images (with annotations)`, updated });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
