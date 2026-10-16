import { NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function POST() {
  try {
    const sim = getSimulator();
    sim.pause();
    return NextResponse.json({ success: true, message: "Simulation paused", running: false });
  } catch (error) {
    console.error("[api:sim:pause]", error);
    return NextResponse.json({ error: "Failed to pause simulation" }, { status: 500 });
  }
}
