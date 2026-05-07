import { NextRequest, NextResponse } from "next/server";
import { getCallerSession, hasRole, resolveLocationId, unauthorized, forbidden } from "@/lib/api-auth";
import { getAttendanceSessions, updateAttendanceSession } from "@/lib/supabase/attendance";

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

/**
 * PATCH /api/attendance/report
 * Body: { sessionId, clockedInAt?, clockedOutAt? }
 *
 * Admin-only. Updates clock-in and/or clock-out times for a session.
 * Only updates sessions belonging to the caller's location.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const locationId = resolveLocationId(caller, null);
  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  let body: { sessionId?: string; clockedInAt?: string; clockedOutAt?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { sessionId, clockedInAt, clockedOutAt } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const session = await updateAttendanceSession(sessionId, locationId, {
      ...(clockedInAt !== undefined && { clockedInAt }),
      ...(clockedOutAt !== undefined && { clockedOutAt }),
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found or access denied." }, { status: 404 });
    }
    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    console.error("[api/attendance/report PATCH]", error);
    return NextResponse.json({ error: "Failed to update session." }, { status: 500 });
  }
}
