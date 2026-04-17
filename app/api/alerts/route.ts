/*
  GET   /api/alerts?locationId=xxx   — fetch alerts (user_lead+)
  PATCH /api/alerts                  — resolve an alert (admin+)
  Body: { alertId }
*/

import { NextRequest, NextResponse } from "next/server";
import { getAlerts, resolveAlert } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    const alerts = await getAlerts(locationId);
    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("[api:alerts GET]", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const { alertId } = await req.json() as { alertId: string };
    if (!alertId) {
      return NextResponse.json({ error: "alertId is required" }, { status: 400 });
    }
    await resolveAlert(alertId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api:alerts PATCH]", error);
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });
  }
}
