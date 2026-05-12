import { NextRequest, NextResponse } from "next/server";
import {
  getCallerSession,
  hasRole,
  resolveLocationId,
  unauthorized,
  forbidden,
  serviceClient,
} from "@/lib/api-auth";
import { submitForm } from "@/lib/supabase/forms";
import type { SubmitFormPayload } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/forms/[id]/submit
 * Submit a filled-out form. Validates the form belongs to the caller's location.
 * Auth: user_lead, admin, super_admin.
 * Body: SubmitFormPayload
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const caller = await getCallerSession(req);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  const locationId = resolveLocationId(caller, null);
  if (!locationId) {
    return NextResponse.json({ error: "No location associated with your account." }, { status: 403 });
  }

  const { id: formId } = await params;

  // Verify the form belongs to the caller's location
  const { data: formRow, error: formError } = await serviceClient()
    .from("custom_forms")
    .select("location_id")
    .eq("id", formId)
    .single();
  if (formError || !formRow) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }
  if ((formRow as { location_id: string }).location_id !== locationId) {
    return forbidden();
  }

  let body: SubmitFormPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { date, responses } = body;
  if (!date) {
    return NextResponse.json({ error: "date is required." }, { status: 400 });
  }

  try {
    const submissionId = await submitForm(
      formId,
      locationId,
      caller.employeeId,
      date,
      responses ?? [],
    );
    return NextResponse.json({ data: { submissionId } }, { status: 201 });
  } catch (error) {
    console.error("[api/forms/[id]/submit POST]", error);
    return NextResponse.json({ error: "Failed to submit form." }, { status: 500 });
  }
}
