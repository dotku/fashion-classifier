import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { insertAnnotation, getAnnotations, getImage, updateImageEmbedding } from "@/lib/db";
import { generateEmbedding, buildEmbeddingText } from "@/lib/embeddings";
import { Annotation } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("image_id");
  if (!imageId) {
    return NextResponse.json({ error: "image_id required" }, { status: 400 });
  }
  const annotations = await getAnnotations(imageId);
  return NextResponse.json(annotations);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_id, tags, notes } = body;

    if (!image_id) {
      return NextResponse.json({ error: "image_id required" }, { status: 400 });
    }

    const image = await getImage(image_id);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const annotation: Annotation = {
      id: uuidv4(),
      image_id,
      tags: Array.isArray(tags) ? tags : [],
      notes: notes || "",
      created_at: new Date().toISOString(),
    };

    await insertAnnotation(annotation);

    // Regenerate embedding to include the new annotation
    try {
      const allAnnotations = await getAnnotations(image_id);
      const text = buildEmbeddingText({
        description: image.description,
        attributes: image.attributes,
        annotations: allAnnotations.map(a => ({ tags: a.tags, notes: a.notes })),
      });
      const embedding = await generateEmbedding(text);
      await updateImageEmbedding(image_id, embedding, text);
    } catch (err) {
      console.error("Failed to update embedding after annotation (non-fatal):", err);
    }

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error("Annotation error:", error);
    return NextResponse.json({ error: "Failed to save annotation" }, { status: 500 });
  }
}
