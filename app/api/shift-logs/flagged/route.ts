/*
  GET /api/shift-logs/flagged
  ?locationId=xxx&limit=10
  Returns only logs with issues_flagged=true
  Used for manager attention dashboard
*/

import { NextRequest, NextResponse } from "next/server";
import { getFlaggedLogs } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  try {
    const locationId = request.nextUrl.searchParams.get("locationId");
    const limitStr = request.nextUrl.searchParams.get("limit");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    const limit = parseInt(limitStr || "10", 10) || 10;

    const logs = await getFlaggedLogs(locationId, limit);

    return NextResponse.json({
      logs,
      count: logs.length,
      hasIssues: logs.length > 0,
    });
  } catch (error) {
    console.error("[shift-logs/flagged]", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged logs" },
      { status: 500 },
    );
  }
}
