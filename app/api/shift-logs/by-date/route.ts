/*
  GET /api/shift-logs/by-date
  ?locationId=xxx&date=2025-06-09
  Returns all logs for a specific date
*/

import { NextRequest, NextResponse } from "next/server";
import { getShiftLogsByDate } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  try {
    const locationId = request.nextUrl.searchParams.get("locationId");
    const date = request.nextUrl.searchParams.get("date");

    if (!locationId || !date) {
      return NextResponse.json(
        { error: "locationId and date are required" },
        { status: 400 },
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const logs = await getShiftLogsByDate(date, locationId);

    return NextResponse.json({
      logs,
      date,
      count: logs.length,
    });
  } catch (error) {
    console.error("[shift-logs/by-date]", error);
    return NextResponse.json(
      { error: "Failed to fetch shift logs" },
      { status: 500 },
    );
  }
}
