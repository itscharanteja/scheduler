import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/services/dashboard-snapshot";
import { LOCATION_ID } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get("locationId") || LOCATION_ID;
  const weekStart = searchParams.get("weekStart") || undefined;
  const userId = searchParams.get("userId") || undefined;

  try {
    const snapshot = await getDashboardSnapshot(locationId, weekStart, userId);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[api/dashboard/snapshot] Failed to generate snapshot:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard snapshot" },
      { status: 500 }
    );
  }
}
