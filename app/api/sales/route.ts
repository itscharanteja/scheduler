import { NextRequest, NextResponse } from "next/server";
import { getSales } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden, resolveLocationId } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();
  const locationId = resolveLocationId(caller, req.nextUrl.searchParams.get("locationId"));
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "7", 10);

  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  try {
    const sales = await getSales(locationId, limit);
    const { getSimulator } = await import("@/lib/simulator/engine");
    const sim = getSimulator();
    const simMetrics = sim.getStatus().metrics;
    const todayStr = sim.currentTime.toISOString().split("T")[0];

    // If today is in the list, overlay live simulator stats
    const todayIndex = sales.findIndex((s) => s.date === todayStr);
    if (todayIndex >= 0) {
      sales[todayIndex] = {
        ...sales[todayIndex],
        revenue: simMetrics.todayRevenue,
        orders: simMetrics.todayOrders,
        averageOrderValue: simMetrics.averageOrderValue,
        laborCost: simMetrics.laborCost,
        peakLabel: simMetrics.peakLabel,
        hourlyRevenue: simMetrics.hourlyRevenue,
      };
    } else if (sales.length < limit) {
      sales.unshift({
        id: "sim-today",
        date: todayStr,
        revenue: simMetrics.todayRevenue,
        orders: simMetrics.todayOrders,
        averageOrderValue: simMetrics.averageOrderValue,
        laborCost: simMetrics.laborCost,
        comparisonRevenue: sim.comparisonRevenue,
        peakLabel: simMetrics.peakLabel,
        hourlyRevenue: simMetrics.hourlyRevenue,
      });
    }

    return NextResponse.json({ success: true, sales });
  } catch (error) {
    console.error("[api:sales]", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}
