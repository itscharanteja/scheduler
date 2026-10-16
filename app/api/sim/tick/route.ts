import { NextRequest, NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const minutes = Number(body.minutes ?? 1);
    const sim = getSimulator();
    const events = await sim.tick(minutes);
    return NextResponse.json({
      success: true,
      currentTime: sim.currentTime.toISOString(),
      eventsCount: events.length,
    });
  } catch (error) {
    console.error("[api:sim:tick]", error);
    return NextResponse.json({ error: "Failed to tick simulation" }, { status: 500 });
  }
}
