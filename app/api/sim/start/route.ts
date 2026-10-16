import { NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function POST() {
  try {
    const sim = getSimulator();
    sim.resume();
    return NextResponse.json({ success: true, message: "Simulation started", running: true });
  } catch (error) {
    console.error("[api:sim:start]", error);
    return NextResponse.json({ error: "Failed to start simulation" }, { status: 500 });
  }
}
