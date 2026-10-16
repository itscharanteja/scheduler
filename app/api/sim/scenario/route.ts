import { NextRequest, NextResponse } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";
import type { SimScenarioName } from "@/lib/simulator/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name as SimScenarioName;
    const durationMinutes = Number(body.durationMinutes ?? 45);

    if (!name || !["rush_hour", "weather_spike", "stockout", "call_out"].includes(name)) {
      return NextResponse.json({ error: "Invalid scenario name. Allowed: rush_hour, weather_spike, stockout, call_out" }, { status: 400 });
    }

    const sim = getSimulator();
    sim.activateScenario(name, durationMinutes);

    return NextResponse.json({
      success: true,
      message: `Scenario ${name} triggered`,
      scenarios: {
        rushHour: sim.isRushActive(),
        weatherSpike: sim.isWeatherActive(),
      },
    });
  } catch (error) {
    console.error("[api:sim:scenario]", error);
    return NextResponse.json({ error: "Failed to trigger scenario" }, { status: 500 });
  }
}
