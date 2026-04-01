import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/db";

export async function GET() {
  try {
    const options = await getFilterOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error("Get filters error:", error);
    return NextResponse.json({ error: "Failed to fetch filters" }, { status: 500 });
  }
}
