import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { insertSearchFeedback, getSearchFeedback, recalculateImpression } from "@/lib/db";
import { SearchFeedback } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }
  const feedback = await getSearchFeedback(query);
  return NextResponse.json(feedback);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, image_id, rating, comment } = body;

    if (!query || !image_id || rating === undefined) {
      return NextResponse.json({ error: "query, image_id, and rating required" }, { status: 400 });
    }

    if (typeof rating !== "number" || rating < -2 || rating > 2) {
      return NextResponse.json({ error: "rating must be between -2 and 2" }, { status: 400 });
    }

    const feedback: SearchFeedback = {
      id: uuidv4(),
      query: query.toLowerCase().trim(),
      image_id,
      rating,
      comment: comment || "",
      created_at: new Date().toISOString(),
    };

    await insertSearchFeedback(feedback);

    // Recalculate impression stats and auto-firm if threshold met
    const impression = await recalculateImpression(feedback.query, feedback.image_id);

    return NextResponse.json({ ...feedback, impression }, { status: 201 });
  } catch (error) {
    console.error("Search feedback error:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
