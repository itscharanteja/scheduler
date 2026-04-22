import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "@/lib/supabase/attendance";

/**
 * GET /api/punch/status?loc=<locationId>&employeeId=<id>
 *
 * Public endpoint — no auth required. Returns the active session for an employee, or null.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const employeeId = req.nextUrl.searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId parameter." }, { status: 400 });
  }

  try {
    const session = await getActiveSession(employeeId);
    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    console.error("[api/punch/status]", error);
    return NextResponse.json({ error: "Failed to load punch status." }, { status: 500 });
  }
}
