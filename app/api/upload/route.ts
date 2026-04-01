import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { insertImage, updateImageEmbedding } from "@/lib/db";
import { classifyImage } from "@/lib/classifier";
import { generateEmbedding, buildEmbeddingText } from "@/lib/embeddings";
import { ImageRecord } from "@/lib/types";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const designer = (formData.get("designer") as string) || "Unknown";
    const model = (formData.get("model") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const id = uuidv4();
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${id}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Classify with AI
    const classification = await classifyImage(filepath, model);

    const now = new Date();
    const record: ImageRecord = {
      id,
      filename,
      original_name: file.name,
      description: classification.description,
      attributes: classification.attributes,
      designer,
      upload_date: now.toISOString(),
      upload_year: now.getFullYear(),
      upload_month: now.getMonth() + 1,
      created_at: now.toISOString(),
    };

    await insertImage(record);

    // Generate and store embedding for similarity search
    try {
      const embeddingText = buildEmbeddingText({ description: classification.description, attributes: classification.attributes });
      const embedding = await generateEmbedding(embeddingText);
      await updateImageEmbedding(id, embedding, embeddingText);
    } catch (err) {
      console.error("Embedding generation failed (non-fatal):", err);
    }

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: String(error) },
      { status: 500 }
    );
  }
}
