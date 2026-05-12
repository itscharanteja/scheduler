import { NextRequest, NextResponse } from "next/server";
import {
  getCallerSession,
  hasRole,
  resolveLocationId,
  unauthorized,
  forbidden,
} from "@/lib/api-auth";
import { getForms, createForm } from "@/lib/supabase/forms";

/**
 * GET /api/forms
 * Returns all active forms for the caller's location.
 * Auth: all authenticated roles.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();

  const locationId = resolveLocationId(caller, req.nextUrl.searchParams.get("locationId"));
  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  try {
    const data = await getForms(locationId);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("[api/forms GET]", error);
    return NextResponse.json({ error: "Failed to load forms." }, { status: 500 });
  }
}

/**
 * POST /api/forms
 * Create a new form.
 * Auth: admin, super_admin.
 * Body: { name, description? }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const locationId = resolveLocationId(caller, null);
  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, description = "" } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Form name is required." }, { status: 400 });
  }

  try {
    const id = await createForm(locationId, name.trim(), description, caller.employeeId);
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error("[api/forms POST]", error);
    return NextResponse.json({ error: "Failed to create form." }, { status: 500 });
  }
}
