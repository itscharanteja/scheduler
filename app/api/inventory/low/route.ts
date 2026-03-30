/*
  GET /api/inventory/low?locationId=xxx
  Returns only items that are low
  or critical — used for dashboard alerts
*/

import { NextRequest, NextResponse } from "next/server";
import { getLowStockItems } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 },
      );
    }

    const items = await getLowStockItems(locationId);

    const criticalCount = items.filter((i) => i.status === "critical").length;
    const lowCount = items.filter((i) => i.status === "low").length;
    const hasAlerts = items.length > 0;

    return NextResponse.json(
      {
        items,
        criticalCount,
        lowCount,
        hasAlerts,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[inventory/low]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
