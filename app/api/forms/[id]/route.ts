import { NextRequest, NextResponse } from "next/server";
import {
  getCallerSession,
  hasRole,
  unauthorized,
  forbidden,
} from "@/lib/api-auth";
import { getForm, updateForm, deleteForm } from "@/lib/supabase/forms";
import type { UpdateFormPayload } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/forms/[id]
 * Returns the form with all its fields.
 * Auth: user_lead, admin, super_admin.
 */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  const { id } = await params;
  try {
    const data = await getForm(id);
    if (!data) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("[api/forms/[id] GET]", error);
    return NextResponse.json({ error: "Failed to load form." }, { status: 500 });
  }
}

/**
 * PUT /api/forms/[id]
 * Update form metadata and/or replace all fields.
 * Auth: admin, super_admin.
 * Body: UpdateFormPayload
 */
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const { id } = await params;
  let body: UpdateFormPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await updateForm(id, body);
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error) {
    console.error("[api/forms/[id] PUT]", error);
    return NextResponse.json({ error: "Failed to update form." }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id]
 * Delete a form (cascades to fields, submissions, responses).
 * Auth: admin, super_admin.
 */
export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  const { id } = await params;
  try {
    await deleteForm(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[api/forms/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete form." }, { status: 500 });
  }
}
