import { NextRequest, NextResponse } from "next/server";
import { getAllImpressions, setAdminOverride } from "@/lib/db";

export async function GET() {
  try {
    const impressions = await getAllImpressions();
    return NextResponse.json(impressions);
  } catch (error) {
    console.error("Admin feedback error:", error);
    return NextResponse.json({ error: "Failed to fetch impressions" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, image_id, action } = body;

    if (!query || !image_id || !action) {
      return NextResponse.json({ error: "query, image_id, and action required" }, { status: 400 });
    }

    const validActions = ["boost", "penalize", "remove", "none", "clear"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    // "clear" removes the admin override
    await setAdminOverride(query, image_id, action === "clear" ? null as unknown as string : action);
    return NextResponse.json({ success: true, query, image_id, action });
  } catch (error) {
    console.error("Admin override error:", error);
    return NextResponse.json({ error: "Failed to set override" }, { status: 500 });
  }
}
