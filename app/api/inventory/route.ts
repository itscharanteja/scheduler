/*
  GET /api/inventory?locationId=xxx
  Returns all inventory items for a location
  sorted by status: critical first,
  low second, ok last
*/

import { NextRequest, NextResponse } from "next/server";
import { getInventory } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    const items = await getInventory(locationId);

    // Count by status
    const criticalCount = items.filter((i) => i.status === "critical").length;
    const lowCount = items.filter((i) => i.status === "low").length;
    const okCount = items.filter((i) => i.status === "ok").length;

    return NextResponse.json(
      {
        items,
        summary: {
          total: items.length,
          critical: criticalCount,
          low: lowCount,
          ok: okCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[inventory]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
