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

    let items = await getInventory(locationId);

    // If database has no inventory rows yet, serve from simulator inventory
    if (!items || items.length === 0) {
      const { getSimulator } = await import("@/lib/simulator/engine");
      const sim = getSimulator();
      items = Array.from(sim.inventory.values()).map((inv) => ({
        id: inv.id,
        locationId,
        itemName: inv.name,
        currentStock: inv.currentStock,
        criticalThreshold: inv.criticalThreshold,
        lowThreshold: inv.lowThreshold,
        unit: inv.unit,
        status: inv.status,
        updatedBy: "simulation",
        lastUpdated: new Date().toISOString(),
      }));
    }

    // Count by status
    const criticalCount = items.filter((i: any) => i.status === "critical").length;
    const lowCount = items.filter((i: any) => i.status === "low").length;
    const okCount = items.filter((i: any) => i.status === "ok").length;

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
