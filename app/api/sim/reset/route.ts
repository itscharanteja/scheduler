import { NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";

export async function POST() {
  try {
    const sim = getSimulator();
    await sim.reset();
    return NextResponse.json({ success: true, message: "Simulation reset to 08:00 UTC with initial seed state" });
  } catch (error) {
    console.error("[api:sim:reset]", error);
    return NextResponse.json({ error: "Failed to reset simulation" }, { status: 500 });
  }
}
