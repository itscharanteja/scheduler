import { NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function GET() {
  try {
    const sim = getSimulator();
    const status = sim.getStatus();
    return NextResponse.json({
      success: true,
      ...status,
      inventory: Array.from(sim.inventory.values()),
      topSellingItems: Array.from(sim.topSellingItems.values()).sort((a, b) => b.revenue - a.revenue),
    });
  } catch (error) {
    console.error("[api:sim:status]", error);
    return NextResponse.json({ error: "Failed to get simulation status" }, { status: 500 });
  }
}
