import { NextRequest, NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const multiplier = Number(body.multiplier ?? 1.0);
    const sim = getSimulator();
    sim.setSpeed(multiplier);
    return NextResponse.json({ success: true, speed: sim.speed });
  } catch (error) {
    console.error("[api:sim:speed]", error);
    return NextResponse.json({ error: "Failed to update speed" }, { status: 500 });
  }
}
