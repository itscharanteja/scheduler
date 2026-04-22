import { NextRequest, NextResponse } from "next/server";
import { getEmployeesForKiosk } from "@/lib/supabase/attendance";

/**
 * GET /api/punch/employees?loc=<locationId>
 *
 * Public endpoint — no auth required. Returns the employee list for the kiosk grid.
 * Scoped to the given locationId so only that branch's employees are visible.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get("loc");

  if (!locationId) {
    return NextResponse.json({ error: "Missing loc parameter." }, { status: 400 });
  }

  try {
    const employees = await getEmployeesForKiosk(locationId);
    return NextResponse.json({ employees }, { status: 200 });
  } catch (error) {
    console.error("[api/punch/employees]", error);
    return NextResponse.json({ error: "Failed to load employees." }, { status: 500 });
  }
}
