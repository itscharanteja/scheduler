import { NextRequest, NextResponse } from "next/server";
import { getActiveSession, clockIn, clockOut } from "@/lib/supabase/attendance";
import { serviceClient } from "@/lib/api-auth";

/**
 * POST /api/punch
 *
 * Public endpoint — no auth required. Handles clock-in and clock-out for the kiosk.
 *
 * Body: { locationId: string; employeeId: string; action: "clock_in" | "clock_out" }
 *
 * Security: validates that the employee belongs to the given locationId before writing,
 * preventing cross-location abuse of the public endpoint.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { locationId?: string; employeeId?: string; action?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { locationId, employeeId, action } = body;

  if (!locationId || !employeeId || !action) {
    return NextResponse.json(
      { error: "locationId, employeeId, and action are required." },
      { status: 400 },
    );
  }

  if (action !== "clock_in" && action !== "clock_out") {
    return NextResponse.json({ error: "action must be clock_in or clock_out." }, { status: 400 });
  }

  try {
    // Validate employee belongs to this location (prevents cross-location abuse)
    const { data: emp, error: empError } = await serviceClient()
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (empError) throw empError;
    if (!emp) {
      return NextResponse.json({ error: "Employee not found at this location." }, { status: 404 });
    }

    const activeSession = await getActiveSession(employeeId);

    if (action === "clock_in") {
      if (activeSession) {
        return NextResponse.json(
          { error: "Already clocked in.", session: activeSession },
          { status: 409 },
        );
      }
      const session = await clockIn(employeeId, locationId);
      return NextResponse.json({ session }, { status: 201 });
    }

    // clock_out
    if (!activeSession) {
      return NextResponse.json({ error: "Not currently clocked in." }, { status: 409 });
    }
    const session = await clockOut(activeSession.id);
    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    console.error("[api/punch]", error);
    return NextResponse.json({ error: "Punch action failed." }, { status: 500 });
  }
}
