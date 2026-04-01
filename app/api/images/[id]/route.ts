import { NextRequest, NextResponse } from "next/server";
import { deleteImage } from "@/lib/db";
import path from "path";
import fs from "fs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const filename = await deleteImage(id);

    if (!filename) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Remove file from disk
    const filepath = path.join(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
