import { NextRequest, NextResponse } from "next/server";
import { getSales } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "7", 10);

  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    const sales = await getSales(locationId, limit);
    return NextResponse.json({ success: true, sales });
  } catch (error) {
    console.error("[api:sales]", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}
