import { NextRequest, NextResponse } from "next/server";
import { getCallerSession, hasRole, resolveLocationId, unauthorized, forbidden } from "@/lib/api-auth";
import { getAttendanceSessions } from "@/lib/supabase/attendance";

/**
 * GET /api/attendance/report?from=<ISO>&to=<ISO>&employeeId=<uuid>
 *
 * Admin-only. Returns attendance sessions for the caller's location.
 * - from / to: ISO date strings (optional, defaults to current week if omitted)
 * - employeeId: filter to a single employee (optional)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const params = req.nextUrl.searchParams;
  const locationId = resolveLocationId(caller, params.get("locationId"));

  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const employeeId = params.get("employeeId") ?? undefined;

  try {
    const sessions = await getAttendanceSessions(locationId, { from, to, employeeId });
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
    console.error("[api/attendance/report]", error);
    return NextResponse.json({ error: "Failed to load attendance report." }, { status: 500 });
  }
}
