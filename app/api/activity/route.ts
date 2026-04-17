import { NextRequest, NextResponse } from "next/server";
import { getActivity } from "@/lib/supabase";
import { getCallerSession, unauthorized } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  const locationId = req.nextUrl.searchParams.get("locationId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    const activity = await getActivity(locationId, limit);
    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error("[api:activity]", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
