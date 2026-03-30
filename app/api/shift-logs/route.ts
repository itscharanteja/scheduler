/*
  GET /api/shift-logs?locationId=xxx&limit=20
  Returns shift logs ordered by date desc
  with shift leader name joined
*/

import { NextRequest, NextResponse } from "next/server";
import { getShiftLogs } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId");
    const limitStr = request.nextUrl.searchParams.get("limit");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    const limit = Math.min(parseInt(limitStr || "20", 10) || 20, 50);

    const logs = await getShiftLogs(locationId, limit);

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("[shift-logs]", error);
    return NextResponse.json(
      { error: "Failed to fetch shift logs" },
      { status: 500 },
    );
  }
}
